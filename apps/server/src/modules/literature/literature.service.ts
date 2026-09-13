/** Literature: business rules. Same ownership contract as `ideas.service.ts`. */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { toCsv } from '../../utils/csv.js';
import { NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type {
  CreateLiteratureInput,
  ListLiteratureQuery,
  UpdateLiteratureInput,
} from './literature.schema.js';

type Literature = Prisma.LiteratureGetPayload<Record<string, never>>;

const ORDER_BY: Record<ListLiteratureQuery['sort'], Prisma.LiteratureOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  oldest: [{ createdAt: 'asc' }],
  title: [{ title: 'asc' }],
  // Entries with no year sort last rather than being dropped or leading.
  year: [{ year: { sort: 'desc', nulls: 'last' } }],
};

function buildWhere(userId: string, query: ListLiteratureQuery): Prisma.LiteratureWhereInput {
  return {
    userId,
    // `tags` is a Postgres array with a GIN index, so both of these are indexed
    // container operations rather than row scans.
    ...(query.tag?.length
      ? query.tagMatch === 'all'
        ? { tags: { hasEvery: query.tag } }
        : { tags: { hasSome: query.tag } }
      : {}),
    ...(query.year !== undefined ? { year: query.year } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { authors: { contains: query.search, mode: 'insensitive' } },
            { summary: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export async function list(
  userId: string,
  query: ListLiteratureQuery,
): Promise<Paginated<Literature>> {
  const where = buildWhere(userId, query);
  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total] = await prisma.$transaction([
    prisma.literature.findMany({ where, orderBy: ORDER_BY[query.sort], ...toSkipTake(pagination) }),
    prisma.literature.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

export async function getById(userId: string, id: string): Promise<Literature> {
  const entry = await prisma.literature.findFirst({ where: { id, userId } });
  if (!entry) throw new NotFoundError('Literature entry');
  return entry;
}

/** Deduplicate while preserving the order the user entered them in. */
function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export async function create(userId: string, input: CreateLiteratureInput): Promise<Literature> {
  return prisma.literature.create({
    data: {
      userId,
      title: input.title,
      authors: input.authors ?? null,
      year: input.year ?? null,
      links: unique(input.links),
      tags: unique(input.tags),
      summary: input.summary ?? null,
    },
  });
}

export async function update(
  userId: string,
  id: string,
  input: UpdateLiteratureInput,
): Promise<Literature> {
  const data: Prisma.LiteratureUpdateManyMutationInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.authors !== undefined ? { authors: input.authors ?? null } : {}),
    ...(input.year !== undefined ? { year: input.year ?? null } : {}),
    ...(input.links !== undefined ? { links: unique(input.links) } : {}),
    ...(input.tags !== undefined ? { tags: unique(input.tags) } : {}),
    ...(input.summary !== undefined ? { summary: input.summary ?? null } : {}),
  };

  const result = await prisma.literature.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new NotFoundError('Literature entry');

  return getById(userId, id);
}

export async function remove(userId: string, id: string): Promise<void> {
  const result = await prisma.literature.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Literature entry');
}

/**
 * Every tag the user has, with a usage count, for the tag sidebar.
 *
 * `tags` is an array column, so this unnests it in SQL. Doing it in application
 * code would mean loading the entire library to count strings.
 */
export async function tagCounts(userId: string): Promise<{ tag: string; count: number }[]> {
  const rows = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT tag, COUNT(*) AS count
    FROM literature, UNNEST(tags) AS tag
    WHERE "userId" = ${userId}
    GROUP BY tag
    ORDER BY COUNT(*) DESC, tag ASC
  `;
  return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/** `YYYY-MM-DD` in the user's own zone — the day they would say they added it. */
function dayIn(timezone: string): (date: Date) => string {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    // A zone the runtime does not know should not fail the download.
    format = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' });
  }
  return (date) => format.format(date);
}

/**
 * The whole library as a spreadsheet: every entry, newest first, regardless of
 * what the list on screen is filtered to — a download is a copy of the
 * library, not of a page of it.
 *
 * Links go one per line inside their cell, because a URL may itself contain a
 * comma or a semicolon; tags cannot contain commas, so they share a line.
 */
export async function exportCsv(userId: string): Promise<{ filename: string; csv: string }> {
  const [user, entries] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
    prisma.literature.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { title: true, links: true, tags: true, summary: true, createdAt: true },
    }),
  ]);

  const day = dayIn(user?.timezone ?? 'UTC');

  const csv = toCsv([
    ['Title', 'Links', 'Tags', 'Summary', 'Created Date'],
    ...entries.map((entry) => [
      entry.title,
      entry.links.join('\n'),
      entry.tags.join(', '),
      entry.summary ?? '',
      day(entry.createdAt),
    ]),
  ]);

  return { filename: `skrivbok-literature-${day(new Date())}.csv`, csv };
}
