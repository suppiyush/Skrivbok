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
