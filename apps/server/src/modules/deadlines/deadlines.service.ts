/** Deadlines: business rules. Same ownership contract as `ideas.service.ts`. */
import type { DeadlineStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type {
  CreateDeadlineInput,
  ListDeadlinesQuery,
  UpdateDeadlineInput,
} from './deadlines.schema.js';

type Deadline = Prisma.DeadlineGetPayload<Record<string, never>>;

/**
 * Statuses that mean the work is still outstanding. Typed as a mutable array
 * because Prisma filter inputs do not accept readonly tuples.
 */
const OPEN_STATUSES: DeadlineStatus[] = ['PENDING', 'IN_PROGRESS'];

const ORDER_BY: Record<ListDeadlinesQuery['sort'], Prisma.DeadlineOrderByWithRelationInput[]> = {
  dueSoonest: [{ dueAt: 'asc' }],
  dueLatest: [{ dueAt: 'desc' }],
  // Prisma orders an enum by its declaration order in the schema, which runs
  // LOW → URGENT, so `desc` puts the most urgent first.
  priority: [{ priority: 'desc' }, { dueAt: 'asc' }],
  newest: [{ createdAt: 'desc' }],
};

function buildWhere(userId: string, query: ListDeadlinesQuery): Prisma.DeadlineWhereInput {
  return {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.from || query.to
      ? {
          dueAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.overdue ? { dueAt: { lt: new Date() }, status: { in: OPEN_STATUSES } } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export async function list(
  userId: string,
  query: ListDeadlinesQuery,
): Promise<Paginated<Deadline>> {
  const where = buildWhere(userId, query);
  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total] = await prisma.$transaction([
    prisma.deadline.findMany({ where, orderBy: ORDER_BY[query.sort], ...toSkipTake(pagination) }),
    prisma.deadline.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

export async function getById(userId: string, id: string): Promise<Deadline> {
  const deadline = await prisma.deadline.findFirst({ where: { id, userId } });
  if (!deadline) throw new NotFoundError('Deadline');
  return deadline;
}

export async function create(userId: string, input: CreateDeadlineInput): Promise<Deadline> {
  // Fall back to the user's own timezone rather than to UTC, so a deadline
  // created without an explicit zone still reminds them at a sensible hour.
  const timezone =
    input.timezone ??
    (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }))
      .timezone;

  return prisma.deadline.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      dueAt: input.dueAt,
      timezone,
      priority: input.priority,
      status: input.status,
      reminderEnabled: input.reminderEnabled,
      remindAt: input.remindAt ?? null,
      completedAt: input.status === 'COMPLETED' ? new Date() : null,
    },
  });
}

export async function update(
  userId: string,
  id: string,
  input: UpdateDeadlineInput,
): Promise<Deadline> {
  const existing = await getById(userId, id);

  // `completedAt` is derived from the status rather than accepted from the
  // client, so the two can never disagree.
  const completedAt =
    input.status === undefined || input.status === existing.status
      ? undefined
      : input.status === 'COMPLETED'
        ? new Date()
        : null;

  const data: Prisma.DeadlineUpdateManyMutationInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description ?? null } : {}),
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.reminderEnabled !== undefined ? { reminderEnabled: input.reminderEnabled } : {}),
    ...(input.remindAt !== undefined ? { remindAt: input.remindAt ?? null } : {}),
    ...(completedAt !== undefined ? { completedAt } : {}),
  };

  const result = await prisma.deadline.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new NotFoundError('Deadline');

  return getById(userId, id);
}

export async function remove(userId: string, id: string): Promise<void> {
  const result = await prisma.deadline.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Deadline');
}

/** Counts for the dashboard tile, computed in the database. */
export async function summary(userId: string): Promise<{
  total: number;
  open: number;
  overdue: number;
  dueThisWeek: number;
  completed: number;
}> {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const open = { status: { in: OPEN_STATUSES } };

  const [total, openCount, overdue, dueThisWeek, completed] = await prisma.$transaction([
    prisma.deadline.count({ where: { userId } }),
    prisma.deadline.count({ where: { userId, ...open } }),
    prisma.deadline.count({ where: { userId, ...open, dueAt: { lt: now } } }),
    prisma.deadline.count({ where: { userId, ...open, dueAt: { gte: now, lte: inSevenDays } } }),
    prisma.deadline.count({ where: { userId, status: 'COMPLETED' } }),
  ]);

  return { total, open: openCount, overdue, dueThisWeek, completed };
}
