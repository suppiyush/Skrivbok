/** Future work: business rules. Same ownership contract as `ideas.service.ts`. */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type {
  CreateFutureWorkInput,
  ListFutureWorkQuery,
  UpdateFutureWorkInput,
} from './future-work.schema.js';

type FutureWork = Prisma.FutureWorkGetPayload<Record<string, never>>;

const ORDER_BY: Record<ListFutureWorkQuery['sort'], Prisma.FutureWorkOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  oldest: [{ createdAt: 'asc' }],
  priority: [{ priority: 'desc' }, { createdAt: 'desc' }],
  title: [{ title: 'asc' }],
};

function buildWhere(userId: string, query: ListFutureWorkQuery): Prisma.FutureWorkWhereInput {
  return {
    userId,
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
            { timeline: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export async function list(
  userId: string,
  query: ListFutureWorkQuery,
): Promise<Paginated<FutureWork>> {
  const where = buildWhere(userId, query);
  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total] = await prisma.$transaction([
    prisma.futureWork.findMany({ where, orderBy: ORDER_BY[query.sort], ...toSkipTake(pagination) }),
    prisma.futureWork.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

export async function getById(userId: string, id: string): Promise<FutureWork> {
  const item = await prisma.futureWork.findFirst({ where: { id, userId } });
  if (!item) throw new NotFoundError('Future work item');
  return item;
}

export async function create(userId: string, input: CreateFutureWorkInput): Promise<FutureWork> {
  return prisma.futureWork.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      timeline: input.timeline ?? null,
    },
  });
}

export async function update(
  userId: string,
  id: string,
  input: UpdateFutureWorkInput,
): Promise<FutureWork> {
  const data: Prisma.FutureWorkUpdateManyMutationInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description ?? null } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.timeline !== undefined ? { timeline: input.timeline ?? null } : {}),
  };

  const result = await prisma.futureWork.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new NotFoundError('Future work item');

  return getById(userId, id);
}

export async function remove(userId: string, id: string): Promise<void> {
  const result = await prisma.futureWork.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Future work item');
}
