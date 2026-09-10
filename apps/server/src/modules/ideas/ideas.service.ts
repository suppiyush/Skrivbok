/**
 * Ideas: business rules.
 *
 * This module is the reference implementation for every user-owned resource.
 * The rule that matters is visible in each function: `userId` is a parameter
 * the controller takes from `req.user.id`, and it appears in the `where` clause
 * of every query — reads, updates and deletes alike.
 *
 * A request for another user's record therefore matches nothing and returns
 * 404. Returning 403 would confirm that the record exists, which leaks
 * information about other people's data.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type { CreateIdeaInput, ListIdeasQuery, UpdateIdeaInput } from './ideas.schema.js';

type Idea = Prisma.IdeaGetPayload<Record<string, never>>;

const ORDER_BY: Record<ListIdeasQuery['sort'], Prisma.IdeaOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  title: { title: 'asc' },
};

function buildWhere(userId: string, query: ListIdeasQuery): Prisma.IdeaWhereInput {
  return {
    userId,
    ...(query.category ? { category: query.category } : {}),
    ...(query.color ? { color: query.color } : {}),
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

export async function list(userId: string, query: ListIdeasQuery): Promise<Paginated<Idea>> {
  const where = buildWhere(userId, query);
  const pagination: Pagination = { page: query.page, limit: query.limit };

  // The page and its total count go in one round trip.
  const [data, total] = await prisma.$transaction([
    prisma.idea.findMany({ where, orderBy: ORDER_BY[query.sort], ...toSkipTake(pagination) }),
    prisma.idea.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

export async function getById(userId: string, id: string): Promise<Idea> {
  const idea = await prisma.idea.findFirst({ where: { id, userId } });
  if (!idea) throw new NotFoundError('Idea');
  return idea;
}

export async function create(userId: string, input: CreateIdeaInput): Promise<Idea> {
  return prisma.idea.create({
    data: {
      userId,
      title: input.title,
      content: input.content ?? null,
      category: input.category,
      color: input.color,
    },
  });
}

/**
 * `updateMany` scoped by `{ id, userId }` means ownership is enforced by the
 * query itself — there is no separate check that a future edit could omit. A
 * count of zero means the row either does not exist or belongs to someone else;
 * both answer 404.
 */
export async function update(userId: string, id: string, input: UpdateIdeaInput): Promise<Idea> {
  const data: Prisma.IdeaUpdateManyMutationInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.content !== undefined ? { content: input.content ?? null } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
  };

  const result = await prisma.idea.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new NotFoundError('Idea');

  return getById(userId, id);
}

export async function remove(userId: string, id: string): Promise<void> {
  const result = await prisma.idea.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Idea');
}

/** Distinct categories in use, to populate the filter dropdown. */
export async function categories(userId: string): Promise<string[]> {
  const rows = await prisma.idea.findMany({
    where: { userId },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}
