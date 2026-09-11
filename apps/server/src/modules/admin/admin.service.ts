/**
 * Admin operations.
 *
 * Every function here is reachable only through `requireAuth` + `requireAdmin`.
 * That is the entire difference from the legacy admin API, which had **no check
 * at all**: `DELETE /api/admin/users/:email` was callable by anyone with curl,
 * and the "login" compared a hardcoded string in the browser.
 *
 * Three safety rules are enforced in this file rather than in the UI, because
 * the UI is not what protects them:
 *
 *   1. An admin cannot delete their own account here.
 *   2. The last remaining admin cannot be demoted or deleted.
 *   3. `email` is not editable by an admin at all — it is what the Google
 *      identity is matched against.
 *
 * Every mutation is logged with the acting admin's id.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  sendAccountDeleted,
  sendPlanChanged,
  sendReportUpdate,
  sendSessionsRevoked,
} from '../../emails/index.js';
import { notify } from '../notifications/notify.js';
import { createLogger } from '../../config/logger.js';
import type { Pagination } from '../../middleware/validate.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type {
  ListAdminPaymentsQuery,
  ListReportsQuery,
  ListUsersQuery,
  UpdateReportInput,
  UpdateUserInput,
} from './admin.schema.js';

const log = createLogger('admin');

/** An explicit allowlist, so a new column is never exposed by accident. */
const adminUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  plan: true,
  timezone: true,
  subscriptionEndsAt: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  _count: {
    select: {
      ownedProjects: true,
      ideas: true,
      notes: true,
      deadlines: true,
      literature: true,
      careerGoals: true,
      calendarEvents: true,
    },
  },
} as const;

// ── Users ─────────────────────────────────────────────────────────────────────

const USER_ORDER: Record<ListUsersQuery['sort'], Prisma.UserOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  oldest: [{ createdAt: 'asc' }],
  lastLogin: [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }],
  email: [{ email: 'asc' }],
};

export async function listUsers(query: ListUsersQuery): Promise<Paginated<unknown>> {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.plan ? { plan: query.plan } : {}),
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: USER_ORDER[query.sort],
      ...toSkipTake(pagination),
    }),
    prisma.user.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...adminUserSelect,
      accounts: { select: { provider: true, createdAt: true } },
      sessions: { select: { id: true, createdAt: true, lastUsedAt: true, ipAddress: true } },
      payments: {
        select: { id: true, plan: true, amount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!user) throw new NotFoundError('User');
  return user;
}

/** Count of admins, used to protect against removing the last one. */
async function adminCount(): Promise<number> {
  return prisma.user.count({ where: { role: 'ADMIN' } });
}

export async function updateUser(actingAdminId: string, id: string, input: UpdateUserInput) {
  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      email: true,
      name: true,
      plan: true,
      subscriptionEndsAt: true,
      timezone: true,
    },
  });

  if (!target) throw new NotFoundError('User');

  // Demoting the last admin would lock everyone out of the admin panel with no
  // way back in short of editing the database by hand.
  if (input.role === 'USER' && target.role === 'ADMIN' && (await adminCount()) <= 1) {
    throw new ConflictError('This is the only administrator — promote someone else first');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name ?? null } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.plan !== undefined ? { plan: input.plan } : {}),
      ...(input.subscriptionEndsAt !== undefined
        ? { subscriptionEndsAt: input.subscriptionEndsAt ?? null }
        : {}),
    },
    select: adminUserSelect,
  });

  // A plan or role change made by hand is exactly the sort of thing that needs
  // to be findable afterwards.
  log.warn(
    { actingAdminId, targetUserId: id, changes: Object.keys(input) },
    'Admin modified a user account',
  );

  // The person whose account it is hears about it — in the bell for a role,
  // on both channels for a plan, since a plan is something they may have paid
  // for. Their own admin changes are not announced to themselves.
  if (id !== actingAdminId) {
    if (input.role !== undefined && input.role !== target.role) {
      await notify(id, {
        type: 'SYSTEM',
        title:
          input.role === 'ADMIN'
            ? 'You are now an administrator'
            : 'You are no longer an administrator',
        message:
          input.role === 'ADMIN'
            ? 'The Admin panel is in your sidebar. Sign out and back in to see it.'
            : 'Your account is a regular one again. Sign out and back in to refresh it.',
        link: input.role === 'ADMIN' ? '/admin' : '/dashboard',
      });
    }

    const planChanged = input.plan !== undefined && input.plan !== target.plan;
    const endChanged =
      input.subscriptionEndsAt !== undefined &&
      (input.subscriptionEndsAt?.getTime() ?? null) !==
        (target.subscriptionEndsAt?.getTime() ?? null);
    if (planChanged || endChanged) {
      const plan = updated.plan;
      const endsAt = updated.subscriptionEndsAt;
      await notify(id, {
        type: 'SUBSCRIPTION',
        title: plan === 'PRO' ? 'PRO was added to your account' : 'Your plan was changed to Free',
        message:
          plan === 'PRO'
            ? endsAt
              ? `It runs until ${endsAt.toISOString().slice(0, 10)}. There is nothing to pay.`
              : 'There is no end date and nothing to pay.'
            : 'The free limits apply from now on.',
        link: '/upgrade',
      });
      sendPlanChanged(target.email, {
        name: target.name ?? target.email,
        plan,
        endsAt,
        timezone: target.timezone,
      });
    }
  }

  return updated;
}

/**
 * Delete a user and everything they own.
 *
 * The cascade rules in the schema do the work: projects, events, notes,
 * sessions and the rest go with them. Reports keep their content with the
 * author unlinked (`SetNull`), so feedback is not lost.
 */
export async function deleteUser(actingAdminId: string, id: string): Promise<void> {
  if (id === actingAdminId) {
    throw new BadRequestError('You cannot delete your own account from the admin panel');
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!target) throw new NotFoundError('User');

  if (target.role === 'ADMIN' && (await adminCount()) <= 1) {
    throw new ConflictError('This is the only administrator and cannot be deleted');
  }

  // Sent before the row goes: after, there is no account to send it to. The
  // dispatch is fire-and-forget, and the address is captured above.
  sendAccountDeleted(target.email, target.name ?? target.email);

  await prisma.user.delete({ where: { id } });

  log.warn({ actingAdminId, deletedUserId: id, email: target.email }, 'Admin deleted a user');
}

/** Sign a user out everywhere — for a compromised account. */
export async function revokeUserSessions(actingAdminId: string, id: string): Promise<number> {
  const target = await prisma.user.findUnique({
    where: { id },
    select: { email: true, name: true },
  });
  if (!target) throw new NotFoundError('User');

  const result = await prisma.session.deleteMany({ where: { userId: id } });
  log.warn({ actingAdminId, targetUserId: id, revoked: result.count }, 'Admin revoked sessions');

  // A security action they will notice. Told by email, since they are no
  // longer signed in to see a bell — and so it does not look like a bug.
  if (result.count > 0) sendSessionsRevoked(target.email, target.name ?? target.email);

  return result.count;
}

// ── Subscriptions and payments ────────────────────────────────────────────────

export async function listSubscriptions(pagination: Pagination): Promise<Paginated<unknown>> {
  const where: Prisma.UserWhereInput = { plan: 'PRO' };

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionEndsAt: true,
        createdAt: true,
      },
      // Soonest to lapse first — that is the list worth acting on.
      orderBy: { subscriptionEndsAt: { sort: 'asc', nulls: 'last' } },
      ...toSkipTake(pagination),
    }),
    prisma.user.count({ where }),
  ]);

  const now = new Date();
  const decorated = data.map((u) => ({
    ...u,
    isExpired: u.subscriptionEndsAt !== null && u.subscriptionEndsAt <= now,
    /** Null for a lifetime grant. */
    daysRemaining: u.subscriptionEndsAt
      ? Math.ceil((u.subscriptionEndsAt.getTime() - now.getTime()) / 86_400_000)
      : null,
  }));

  return paginate(decorated, total, pagination);
}

export async function listPayments(query: ListAdminPaymentsQuery): Promise<Paginated<unknown>> {
  const where: Prisma.PaymentWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { razorpayOrderId: { contains: query.search, mode: 'insensitive' } },
            { razorpayPaymentId: { contains: query.search, mode: 'insensitive' } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        plan: true,
        amount: true,
        currency: true,
        status: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        periodEnd: true,
        failureReason: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.payment.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

// ── Report triage ─────────────────────────────────────────────────────────────

const reportSelect = {
  id: true,
  type: true,
  featurePage: true,
  title: true,
  description: true,
  status: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, name: true } },
  resolvedBy: { select: { id: true, email: true, name: true } },
} as const;

export async function listReports(
  query: ListReportsQuery,
): Promise<Paginated<unknown> & { statusCounts: Record<string, number> }> {
  const where: Prisma.ReportWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total, open, inProgress, resolved, dismissed] = await prisma.$transaction([
    prisma.report.findMany({
      where,
      select: reportSelect,
      orderBy: { createdAt: query.sort === 'newest' ? 'desc' : 'asc' },
      ...toSkipTake(pagination),
    }),
    prisma.report.count({ where }),
    // Tab counts, deliberately across *all* reports rather than the current
    // filter — a tab showing "Resolved (0)" because you are filtered to Open
    // would be actively misleading.
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.report.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.report.count({ where: { status: 'RESOLVED' } }),
    prisma.report.count({ where: { status: 'DISMISSED' } }),
  ]);

  return {
    ...paginate(data, total, pagination),
    statusCounts: { OPEN: open, IN_PROGRESS: inProgress, RESOLVED: resolved, DISMISSED: dismissed },
  };
}

export async function getReport(id: string) {
  const report = await prisma.report.findUnique({ where: { id }, select: reportSelect });
  if (!report) throw new NotFoundError('Report');
  return report;
}

export async function updateReport(actingAdminId: string, id: string, input: UpdateReportInput) {
  const existing = await prisma.report.findUnique({
    where: { id },
    select: {
      status: true,
      title: true,
      type: true,
      description: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!existing) throw new NotFoundError('Report');

  // Closing a report stamps who closed it and when; reopening clears both, so
  // the fields never describe a state the report is no longer in.
  const closing = input.status === 'RESOLVED' || input.status === 'DISMISSED';
  const reopening =
    input.status !== undefined && !closing && ['RESOLVED', 'DISMISSED'].includes(existing.status);

  const updated = await prisma.report.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.resolution !== undefined ? { resolution: input.resolution ?? null } : {}),
      ...(closing ? { resolvedAt: new Date(), resolvedById: actingAdminId } : {}),
      ...(reopening ? { resolvedAt: null, resolvedById: null } : {}),
    },
    select: reportSelect,
  });

  // The submitter hears when it is closed — always in the bell, and by email
  // when the admin wrote something, since the note is the reply and would
  // otherwise be invisible to them. Reopening and taking on are silent.
  const justClosed = closing && input.status !== existing.status;
  if (justClosed && existing.user) {
    const status = input.status as 'RESOLVED' | 'DISMISSED';
    const title = existing.title ?? `Your ${existing.type.toLowerCase()} report`;
    await notify(existing.user.id, {
      type: 'REPORT',
      title: status === 'RESOLVED' ? `Resolved: ${title}` : `Closed: ${title}`,
      message: updated.resolution,
      link: '/help',
    });
    if (updated.resolution) {
      sendReportUpdate(existing.user.email, {
        name: existing.user.name ?? existing.user.email,
        title,
        status,
        resolution: updated.resolution,
      });
    }
  }

  return updated;
}
