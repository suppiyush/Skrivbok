/**
 * Journal: business rules.
 *
 * New in this rebuild. The legacy app kept journal entries in the browser's
 * `localStorage`, so clearing site data destroyed them permanently and they
 * never appeared on a second device. They are now server-side records like
 * everything else.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type {
  CreateJournalEntryInput,
  ListJournalQuery,
  UpdateJournalEntryInput,
} from './journal.schema.js';

type JournalEntry = Prisma.JournalEntryGetPayload<Record<string, never>>;

/** Today as a date-only value in UTC, matching the `@db.Date` column. */
function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Order-preserving de-duplication, so the same tag twice stores once. */
function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function buildWhere(userId: string, query: ListJournalQuery): Prisma.JournalEntryWhereInput {
  return {
    userId,
    ...(query.from || query.to
      ? {
          entryDate: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.mood ? { mood: query.mood } : {}),
    // `hasSome`, not `hasEvery`: the filter row in the sidebar is a set of
    // chips you turn on, and turning on two should widen the list, not empty it.
    ...(query.tag ? { tags: { hasSome: query.tag } } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { content: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export async function list(
  userId: string,
  query: ListJournalQuery,
): Promise<Paginated<JournalEntry>> {
  const where = buildWhere(userId, query);
  const pagination: Pagination = { page: query.page, limit: query.limit };
  const direction = query.sort === 'newest' ? 'desc' : 'asc';

  const [data, total] = await prisma.$transaction([
    prisma.journalEntry.findMany({
      where,
      // Secondary sort on createdAt keeps several entries written for the same
      // day in a stable, meaningful order.
      orderBy: [{ entryDate: direction }, { createdAt: direction }],
      ...toSkipTake(pagination),
    }),
    prisma.journalEntry.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

export async function getById(userId: string, id: string): Promise<JournalEntry> {
  const entry = await prisma.journalEntry.findFirst({ where: { id, userId } });
  if (!entry) throw new NotFoundError('Journal entry');
  return entry;
}

export async function create(
  userId: string,
  input: CreateJournalEntryInput,
): Promise<JournalEntry> {
  return prisma.journalEntry.create({
    data: {
      userId,
      title: input.title ?? null,
      content: input.content,
      entryDate: input.entryDate ?? todayUtc(),
      mood: input.mood ?? null,
      tags: unique(input.tags),
    },
  });
}

export async function update(
  userId: string,
  id: string,
  input: UpdateJournalEntryInput,
): Promise<JournalEntry> {
  const data: Prisma.JournalEntryUpdateManyMutationInput = {
    ...(input.title !== undefined ? { title: input.title ?? null } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.entryDate !== undefined ? { entryDate: input.entryDate } : {}),
    ...(input.mood !== undefined ? { mood: input.mood ?? null } : {}),
    ...(input.tags !== undefined ? { tags: unique(input.tags) } : {}),
  };

  const result = await prisma.journalEntry.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new NotFoundError('Journal entry');

  return getById(userId, id);
}

export async function remove(userId: string, id: string): Promise<void> {
  const result = await prisma.journalEntry.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Journal entry');
}

/**
 * Every tag the user has, with a usage count, for the filter row.
 *
 * `tags` is an array column, so this unnests it in SQL rather than loading the
 * whole journal to count strings.
 */
export async function tagCounts(userId: string): Promise<{ tag: string; count: number }[]> {
  const rows = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT tag, COUNT(*) AS count
    FROM journal_entries, UNNEST(tags) AS tag
    WHERE "userId" = ${userId}
    GROUP BY tag
    ORDER BY COUNT(*) DESC, tag ASC
  `;
  return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/**
 * How many days in a row, counting back, have an entry.
 *
 * Two decisions worth stating:
 *
 * A streak is allowed to end *yesterday*. Someone who wrote every day for a
 * month and has not yet written today is on a 30-day streak, not a broken one
 * — telling them otherwise before the day is out is both wrong and unkind.
 *
 * Entry dates are `@db.Date` at UTC midnight, and "today" here is UTC too, so
 * the comparison is between like and like. A user well west of UTC may see the
 * count roll over before their local midnight; making this local would mean
 * sending the zone on a request whose answer is a single number, and the whole
 * journal is dated in UTC days already.
 *
 * Only the distinct days are read, newest first, and the walk stops at the
 * first gap — so the query is bounded by the length of the streak, not by the
 * size of the journal.
 */
export async function streak(userId: string): Promise<number> {
  const rows = await prisma.journalEntry.findMany({
    where: { userId },
    select: { entryDate: true },
    distinct: ['entryDate'],
    orderBy: { entryDate: 'desc' },
    take: 400,
  });

  if (rows.length === 0) return 0;

  const DAY = 86_400_000;
  const today = todayUtc().getTime();
  const first = rows[0]?.entryDate.getTime() ?? 0;

  // Nothing today and nothing yesterday: the run is over.
  if (today - first > DAY) return 0;

  let count = 0;
  let expected = first;

  for (const row of rows) {
    if (row.entryDate.getTime() !== expected) break;
    count += 1;
    expected -= DAY;
  }

  return count;
}

/** The two numbers above the filter row: how much, and how consistently. */
export async function stats(userId: string): Promise<{ entries: number; streak: number }> {
  const [entries, days] = await Promise.all([
    prisma.journalEntry.count({ where: { userId } }),
    streak(userId),
  ]);

  return { entries, streak: days };
}

/**
 * Entry counts per day across a window, for a writing-streak heatmap. Grouped
 * in the database rather than by loading every entry into memory.
 */
export async function activity(
  userId: string,
  from: Date,
  to: Date,
): Promise<{ date: string; count: number }[]> {
  const rows = await prisma.journalEntry.groupBy({
    by: ['entryDate'],
    where: { userId, entryDate: { gte: from, lte: to } },
    _count: { _all: true },
    orderBy: { entryDate: 'asc' },
  });

  return rows.map((row) => ({
    date: row.entryDate.toISOString().slice(0, 10),
    count: row._count._all,
  }));
}
