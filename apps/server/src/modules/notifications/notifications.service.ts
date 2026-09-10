/**
 * In-app notifications.
 *
 * Rows are written by the modules that cause them (a project invite, a meeting
 * response, a captured payment), so this module only reads and marks them.
 * There is no create endpoint: a client must never be able to fabricate a
 * notification for another user, or for itself.
 *
 * The legacy `/api/notifications` route did something quite different — it
 * assembled a feed on the fly by querying deadlines, meetings and calendar
 * events and merging them in JavaScript on every request, which meant nothing
 * could be marked read and the work was repeated on every poll.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type { ListNotificationsQuery } from './notifications.schema.js';

type Notification = Prisma.NotificationGetPayload<Record<string, never>>;

export async function list(
  userId: string,
  query: ListNotificationsQuery,
): Promise<Paginated<Notification> & { unreadCount: number }> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unreadOnly ? { readAt: null } : {}),
    ...(query.type ? { type: query.type } : {}),
  };

  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.notification.count({ where }),
    // Always the total unread, not the count within the current filter — this
    // is what the badge shows.
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { ...paginate(data, total, pagination), unreadCount };
}

/** Cheap endpoint for the badge, polled far more often than the list. */
export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/**
 * Mark specific notifications read.
 *
 * Scoped by `userId`, so ids belonging to someone else simply do not match.
 * An already-read row is left alone rather than having its timestamp reset.
 */
export async function markRead(userId: string, ids: string[]): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { id: { in: ids }, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function remove(userId: string, id: string): Promise<void> {
  const result = await prisma.notification.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Notification');
}

/** Clear the read ones, leaving anything still unread in place. */
export async function clearRead(userId: string): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: { userId, readAt: { not: null } },
  });
  return result.count;
}
