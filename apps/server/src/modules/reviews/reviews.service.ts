/**
 * Reviews.
 *
 * A user writes one review. It sits as PENDING until an admin approves it, and
 * only then does it reach the public landing page. The gate is not optional:
 * without it, anyone who can register can publish arbitrary text onto the
 * marketing site.
 *
 * One review per user, enforced by a unique constraint on `userId` rather than
 * by checking first — a check-then-insert races with itself.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { createLogger } from '../../config/logger.js';
import { NotFoundError } from '../../utils/errors.js';
import type { Pagination } from '../../middleware/validate.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type { ListReviewsQuery, ModerateReviewInput, UpsertReviewInput } from './reviews.schema.js';

const log = createLogger('reviews');

/** What the public site is allowed to see. No ids, no email, no timestamps. */
const publicSelect = {
  id: true,
  rating: true,
  role: true,
  body: true,
  createdAt: true,
  user: { select: { name: true, profile: { select: { avatarUrl: true } } } },
} satisfies Prisma.ReviewSelect;

const ownSelect = {
  id: true,
  rating: true,
  role: true,
  body: true,
  status: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReviewSelect;

/** The caller's own review, or null if they have not written one. */
export async function getOwn(userId: string) {
  return prisma.review.findUnique({ where: { userId }, select: ownSelect });
}

/**
 * Create or replace the caller's review.
 *
 * Editing an approved review sends it back to PENDING. Otherwise a user could
 * get an innocuous review approved and then quietly rewrite its contents on a
 * page the admin no longer looks at.
 */
export async function upsertOwn(userId: string, input: UpsertReviewInput) {
  const data = {
    rating: input.rating,
    role: input.role ?? null,
    body: input.body,
    status: 'PENDING' as const,
    reviewedAt: null,
    reviewedById: null,
    adminNote: null,
  };

  const review = await prisma.review.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: ownSelect,
  });

  log.info({ userId }, 'Review submitted for moderation');
  return review;
}

export async function removeOwn(userId: string): Promise<void> {
  const result = await prisma.review.deleteMany({ where: { userId } });
  if (result.count === 0) throw new NotFoundError('Review');
}

/** Approved reviews, newest first — what the landing page renders. */
export async function listPublic(limit: number) {
  return prisma.review.findMany({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: publicSelect,
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function listAll(query: ListReviewsQuery): Promise<Paginated<unknown>> {
  const where: Prisma.ReviewWhereInput = query.status ? { status: query.status } : {};
  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      // Pending first, then newest: the queue is the point of this screen.
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      ...toSkipTake(pagination),
      select: {
        ...ownSelect,
        user: { select: { id: true, name: true, email: true } },
        reviewedAt: true,
      },
    }),
    prisma.review.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

export async function moderate(adminId: string, id: string, input: ModerateReviewInput) {
  const existing = await prisma.review.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('Review');

  const review = await prisma.review.update({
    where: { id },
    data: {
      status: input.status,
      adminNote: input.adminNote ?? null,
      reviewedAt: new Date(),
      reviewedById: adminId,
    },
    select: ownSelect,
  });

  log.info({ id, status: input.status, adminId }, 'Review moderated');
  return review;
}

/** How many are waiting, for the admin screen's badge. */
export async function pendingCount(): Promise<number> {
  return prisma.review.count({ where: { status: 'PENDING' } });
}
