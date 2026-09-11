/**
 * Writing notifications.
 *
 * The one place a `Notification` row is created. Before this, each module had
 * its own `prisma.notification.create({...})` — eleven copies of the same
 * shape, which is how the title wording, the link format and the "should this
 * even go out" checks drifted. A module now says what happened and to whom;
 * this decides the rest.
 *
 * Nothing here throws to the caller. A notification that fails to write must
 * not undo the thing it was announcing — a meeting is still scheduled even if
 * the bell could not be rung. Errors are logged and swallowed, unless the
 * caller passes its own transaction, in which case the write is part of that
 * unit and fails with it, which is what a transaction is for.
 */
import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { createLogger } from '../../config/logger.js';

const log = createLogger('notify');

export interface Announcement {
  type: NotificationType;
  title: string;
  message?: string | null;
  /** Where the bell takes them. Omit when there is nowhere sensible to go. */
  link?: string | null;
}

/** Either the shared client or a transaction the caller is already inside. */
type Client = Prisma.TransactionClient | typeof prisma;

function rows(userIds: string[], announcement: Announcement) {
  return userIds.map((userId) => ({
    userId,
    type: announcement.type,
    title: announcement.title,
    message: announcement.message ?? null,
    link: announcement.link ?? null,
  }));
}

/** Tell one person. */
export async function notify(
  userId: string,
  announcement: Announcement,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  await notifyMany([userId], announcement, tx);
}

/**
 * Tell several people the same thing.
 *
 * Duplicates are collapsed so a person who appears twice in a list — an owner
 * who is also an attendee, say — hears it once. An empty list is a no-op, not
 * an error, so callers can filter first without checking after.
 */
export async function notifyMany(
  userIds: string[],
  announcement: Announcement,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;

  const client: Client = tx ?? prisma;

  try {
    await client.notification.createMany({ data: rows(unique, announcement) });
  } catch (error) {
    if (tx) throw error;
    log.error({ err: error, type: announcement.type }, 'Could not write a notification');
  }
}

/**
 * Tell every administrator.
 *
 * Used for the things only staff can act on: a new bug report, a payment that
 * failed, a webhook whose signature did not verify. The type is always `ADMIN`
 * so a person who is both admin and user can tell the two apart in the bell.
 */
export async function notifyAdmins(
  announcement: Omit<Announcement, 'type'>,
  options: { except?: string } = {},
): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', ...(options.except ? { id: { not: options.except } } : {}) },
      select: { id: true },
    });
    await notifyMany(
      admins.map((a) => a.id),
      { ...announcement, type: 'ADMIN' },
    );
  } catch (error) {
    log.error({ err: error }, 'Could not notify administrators');
  }
}
