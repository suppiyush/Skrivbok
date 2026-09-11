/**
 * Calendar access: requests, grants and revocation.
 *
 * Two tables, deliberately separate:
 *
 *   • `CalendarAccess`        — a live grant. Its existence *is* the permission.
 *   • `CalendarAccessRequest` — the conversation that led to it, kept for
 *                               history so a revoked grant leaves a trail and a
 *                               rejection is not silently re-askable forever.
 *
 * The grant is what every read consults. Revoking deletes the grant row, so
 * access stops immediately — there is no cached copy anywhere.
 */
import type { CalendarAccessLevel, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { createLogger } from '../../config/logger.js';
import { sendCalendarAccessRequest } from '../../emails/index.js';
import { notify } from '../notifications/notify.js';
import type { Pagination } from '../../middleware/validate.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type { CreateAccessRequestInput, ListAccessRequestsQuery } from './access.schema.js';

const log = createLogger('calendar-access');

const party = { select: { id: true, name: true, email: true } } as const;

const requestSelect = {
  id: true,
  requesterId: true,
  targetId: true,
  status: true,
  message: true,
  respondedAt: true,
  createdAt: true,
  requester: party,
  target: party,
} as const;

const grantSelect = {
  id: true,
  ownerId: true,
  viewerId: true,
  level: true,
  createdAt: true,
  owner: party,
  viewer: party,
} as const;

type AccessRequest = Prisma.CalendarAccessRequestGetPayload<{ select: typeof requestSelect }>;

export interface AccessRequestView extends AccessRequest {
  /** True when the caller is the one asking. */
  isRequester: boolean;
}

function decorate(request: AccessRequest, userId: string): AccessRequestView {
  return { ...request, isRequester: request.requesterId === userId };
}

// ── The permission check every shared read depends on ─────────────────────────

/**
 * What level of access does `viewerId` hold on `ownerId`'s calendar?
 *
 * Returns null when there is none. A user always has full VIEW of their own
 * calendar, handled here so callers never have to special-case themselves and
 * accidentally get it wrong in one place.
 */
export async function accessLevelFor(
  viewerId: string,
  ownerId: string,
): Promise<CalendarAccessLevel | null> {
  if (viewerId === ownerId) return 'VIEW';

  const grant = await prisma.calendarAccess.findUnique({
    where: { ownerId_viewerId: { ownerId, viewerId } },
    select: { level: true },
  });

  return grant?.level ?? null;
}

/** Resolve an email to a user, or 404. Used by the shared-calendar endpoints. */
export async function resolveUserByEmail(
  email: string,
): Promise<{ id: string; email: string; name: string | null; timezone: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, timezone: true },
  });

  if (!user) throw new NotFoundError('An account with that email address');
  return user;
}

// ── Requests ──────────────────────────────────────────────────────────────────

export async function createRequest(
  userId: string,
  input: CreateAccessRequestInput,
): Promise<AccessRequestView> {
  const target = await prisma.user.findUnique({
    where: { email: input.targetEmail },
    select: { id: true },
  });

  if (!target) throw new NotFoundError('An account with that email address');
  if (target.id === userId) {
    throw new BadRequestError('You already have access to your own calendar');
  }

  const existingGrant = await prisma.calendarAccess.findUnique({
    where: { ownerId_viewerId: { ownerId: target.id, viewerId: userId } },
    select: { id: true },
  });

  if (existingGrant) {
    throw new ConflictError('You already have access to that calendar');
  }

  // The schema has a partial unique index on (requester, target) WHERE
  // status = 'PENDING', so a duplicate pending request is impossible even under
  // a race. This check exists to return a useful message rather than a raw
  // constraint violation.
  const pending = await prisma.calendarAccessRequest.findFirst({
    where: { requesterId: userId, targetId: target.id, status: 'PENDING' },
    select: { id: true },
  });

  if (pending) {
    throw new ConflictError('You already have a pending request for that calendar');
  }

  const request = await prisma.calendarAccessRequest.create({
    data: {
      requesterId: userId,
      targetId: target.id,
      message: input.message ?? null,
    },
    select: requestSelect,
  });

  const requesterName = request.requester.name ?? request.requester.email;
  await notify(target.id, {
    type: 'CALENDAR_ACCESS_REQUEST',
    title: `${requesterName} asked to see your calendar`,
    message: input.message ?? null,
    link: `/calendar?accessRequest=${request.id}`,
  });
  // The target may not sign in for days; a request that sits unseen looks
  // ignored, so it goes by email as well.
  sendCalendarAccessRequest(target.id, request.target.email, {
    requesterName,
    message: input.message ?? null,
  });

  log.info({ requestId: request.id }, 'Calendar access requested');
  return decorate(request, userId);
}

export async function listRequests(
  userId: string,
  query: ListAccessRequestsQuery,
): Promise<Paginated<AccessRequestView>> {
  const mine: Prisma.CalendarAccessRequestWhereInput =
    query.box === 'incoming'
      ? { targetId: userId }
      : query.box === 'outgoing'
        ? { requesterId: userId }
        : { OR: [{ requesterId: userId }, { targetId: userId }] };

  const where: Prisma.CalendarAccessRequestWhereInput = {
    ...mine,
    ...(query.status ? { status: query.status } : {}),
  };

  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [rows, total] = await prisma.$transaction([
    prisma.calendarAccessRequest.findMany({
      where,
      select: requestSelect,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.calendarAccessRequest.count({ where }),
  ]);

  return paginate(
    rows.map((row) => decorate(row, userId)),
    total,
    pagination,
  );
}

async function getOwnedRequest(userId: string, id: string): Promise<AccessRequest> {
  const request = await prisma.calendarAccessRequest.findFirst({
    where: { id, OR: [{ requesterId: userId }, { targetId: userId }] },
    select: requestSelect,
  });

  if (!request) throw new NotFoundError('Access request');
  return request;
}

/**
 * Approve, creating the grant. Only the calendar's owner may do this, and only
 * they choose the level — the requester does not get to ask for VIEW.
 */
export async function approveRequest(
  userId: string,
  id: string,
  level: CalendarAccessLevel,
): Promise<AccessRequestView> {
  const request = await getOwnedRequest(userId, id);

  if (request.targetId !== userId) {
    throw new ForbiddenError('Only the calendar owner can approve this request');
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError(`This request has already been ${request.status.toLowerCase()}`);
  }

  await prisma.$transaction([
    prisma.calendarAccessRequest.update({
      where: { id },
      data: { status: 'APPROVED', respondedAt: new Date() },
    }),
    // `upsert`, not `create`: a grant may already exist from an earlier
    // approval that was revoked and then re-requested.
    prisma.calendarAccess.upsert({
      where: { ownerId_viewerId: { ownerId: userId, viewerId: request.requesterId } },
      create: { ownerId: userId, viewerId: request.requesterId, level },
      update: { level },
    }),
  ]);

  await notify(request.requesterId, {
    type: 'CALENDAR_ACCESS_GRANTED',
    title: `${request.target.name ?? request.target.email} shared their calendar with you`,
    message: level === 'VIEW' ? 'You can see event details.' : 'You can see when they are busy.',
    link: `/calendar?shared=${request.target.email}`,
  });

  log.info({ requestId: id, level }, 'Calendar access granted');
  return decorate(await getOwnedRequest(userId, id), userId);
}

export async function rejectRequest(userId: string, id: string): Promise<AccessRequestView> {
  const request = await getOwnedRequest(userId, id);

  if (request.targetId !== userId) {
    throw new ForbiddenError('Only the calendar owner can reject this request');
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError(`This request has already been ${request.status.toLowerCase()}`);
  }

  await prisma.calendarAccessRequest.update({
    where: { id },
    data: { status: 'REJECTED', respondedAt: new Date() },
  });

  await notify(request.requesterId, {
    type: 'CALENDAR_ACCESS_REQUEST',
    title: `${request.target.name ?? request.target.email} declined to share their calendar`,
    link: '/calendar',
  });

  return decorate(await getOwnedRequest(userId, id), userId);
}

/** The requester withdrawing their own pending request. */
export async function withdrawRequest(userId: string, id: string): Promise<void> {
  const request = await getOwnedRequest(userId, id);

  if (request.requesterId !== userId) {
    throw new ForbiddenError('Only the requester can withdraw this request');
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError('Only a pending request can be withdrawn');
  }

  await prisma.calendarAccessRequest.delete({ where: { id } });
}

// ── Grants ────────────────────────────────────────────────────────────────────

/** People who can see the caller's calendar. */
export async function listGranted(userId: string) {
  return prisma.calendarAccess.findMany({
    where: { ownerId: userId },
    select: grantSelect,
    orderBy: { createdAt: 'desc' },
  });
}

/** Calendars the caller can see. */
export async function listHeld(userId: string) {
  return prisma.calendarAccess.findMany({
    where: { viewerId: userId },
    select: grantSelect,
    orderBy: { createdAt: 'desc' },
  });
}

/** Change a grant's level. Owner only — a viewer cannot promote themselves. */
export async function updateGrant(userId: string, id: string, level: CalendarAccessLevel) {
  const grant = await prisma.calendarAccess.findFirst({
    where: { id, ownerId: userId },
    select: { id: true },
  });

  if (!grant) throw new NotFoundError('Calendar access grant');

  const updated = await prisma.calendarAccess.update({
    where: { id },
    data: { level },
    select: grantSelect,
  });

  await notify(updated.viewer.id, {
    type: 'CALENDAR_ACCESS_GRANTED',
    title: `${updated.owner.name ?? updated.owner.email} changed what you can see`,
    message:
      level === 'VIEW' ? 'You can now see event details.' : 'You now see only when they are busy.',
    link: `/calendar?shared=${updated.owner.email}`,
  });

  return updated;
}

/**
 * Revoke. The owner may remove anyone; a viewer may remove their own access to
 * someone else's calendar, which needs no permission from the owner.
 *
 * Any earlier APPROVED request is marked REVOKED, so the history reflects what
 * happened rather than still claiming the access is live.
 */
export async function revokeGrant(userId: string, id: string): Promise<void> {
  const grant = await prisma.calendarAccess.findFirst({
    where: { id, OR: [{ ownerId: userId }, { viewerId: userId }] },
    select: { id: true, ownerId: true, viewerId: true, owner: party, viewer: party },
  });

  if (!grant) throw new NotFoundError('Calendar access grant');

  await prisma.$transaction([
    prisma.calendarAccess.delete({ where: { id } }),
    prisma.calendarAccessRequest.updateMany({
      where: { requesterId: grant.viewerId, targetId: grant.ownerId, status: 'APPROVED' },
      data: { status: 'REVOKED', respondedAt: new Date() },
    }),
  ]);

  // Whichever side ended it, the other is told. The viewer losing access would
  // otherwise see a calendar vanish; the owner would not know a viewer left.
  const ownerEnded = grant.ownerId === userId;
  await notify(ownerEnded ? grant.viewerId : grant.ownerId, {
    type: 'CALENDAR_ACCESS_GRANTED',
    title: ownerEnded
      ? `${grant.owner.name ?? grant.owner.email} stopped sharing their calendar`
      : `${grant.viewer.name ?? grant.viewer.email} no longer sees your calendar`,
    link: '/calendar',
  });

  log.info({ ownerId: grant.ownerId, viewerId: grant.viewerId }, 'Calendar access revoked');
}
