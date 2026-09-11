/**
 * Free-tier limits.
 *
 * Part 9 builds the rest of the billing module; this piece lands early because
 * projects is the first capped resource.
 *
 * Two rules the legacy server got wrong:
 *
 *   1. **A limit check is a server decision.** The old code returned
 *      `FREE_LIMIT_REACHED` from the create endpoint but nothing stopped a
 *      client from calling a different endpoint, and the check silently
 *      *allowed* the request whenever the count query threw — failing open.
 *      Here a failure propagates.
 *   2. **PRO status is read from the database, never from the request.** The
 *      session carries `plan`, but a session issued before an upgrade or after
 *      an expiry would be stale, so the check re-reads it.
 */
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { ErrorCode, ForbiddenError } from '../../utils/errors.js';

/** Resources with a free-tier cap. */
export type LimitedResource = 'projects' | 'careerGoals' | 'literature';

const LABELS: Record<LimitedResource, string> = {
  projects: 'projects',
  careerGoals: 'career goals',
  literature: 'literature entries',
};

/**
 * Does this account have PRO — whether by paying for it or by being staff?
 *
 * The plan column says what was bought. This says what the account may do,
 * which is the question every cap actually asks, and the two differ in one
 * case: an admin. Admins are not customers, so they are never asked to pay
 * for the product they run — they have everything, always, without a
 * subscription row to lapse. Kept as a rule here rather than as `plan: PRO`
 * on the admin's row, so the admin panel's PRO count stays a count of
 * customers and nothing depends on remembering to set a flag.
 *
 * A `PRO` plan with a `subscriptionEndsAt` in the past is treated as
 * expired. The webhook downgrades lapsed accounts, but this check means a
 * missed webhook cannot leave someone on PRO indefinitely.
 */
export function entitled(user: {
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO';
  subscriptionEndsAt: Date | null;
}): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.plan !== 'PRO') return false;
  // A null end date is a lifetime grant (used for comped accounts).
  return user.subscriptionEndsAt === null || user.subscriptionEndsAt > new Date();
}

export async function isPro(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, subscriptionEndsAt: true },
  });
  return user ? entitled(user) : false;
}

async function countFor(userId: string, resource: LimitedResource): Promise<number> {
  switch (resource) {
    case 'projects':
      // Only projects the user owns count against their quota. Being invited to
      // someone else's project does not consume it.
      return prisma.project.count({ where: { ownerId: userId } });
    case 'careerGoals':
      return prisma.careerGoal.count({ where: { userId } });
    case 'literature':
      return prisma.literature.count({ where: { userId } });
  }
}

export interface LimitStatus {
  limited: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export async function getLimitStatus(
  userId: string,
  resource: LimitedResource,
): Promise<LimitStatus> {
  if (await isPro(userId)) {
    return { limited: false, used: await countFor(userId, resource), limit: null, remaining: null };
  }

  const limit = env.freeLimits[resource];
  const used = await countFor(userId, resource);

  // -1 configures a resource as unlimited even on the free tier.
  if (limit === -1) {
    return { limited: false, used, limit: null, remaining: null };
  }

  return { limited: true, used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Throw if creating one more of `resource` would exceed the free tier.
 *
 * Call this from a service before the create, never from a controller — that
 * way it cannot be bypassed by a second endpoint that forgets it.
 */
export async function assertWithinLimit(userId: string, resource: LimitedResource): Promise<void> {
  const status = await getLimitStatus(userId, resource);
  if (!status.limited || status.limit === null || status.used < status.limit) return;

  throw new ForbiddenError(
    `Free accounts are limited to ${status.limit} ${LABELS[resource]}. Upgrade to PRO for unlimited access.`,
    ErrorCode.FREE_LIMIT_REACHED,
  );
}
