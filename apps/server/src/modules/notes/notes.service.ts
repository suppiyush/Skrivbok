/** Notes: business rules. Same ownership contract as `ideas.service.ts`. */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type { CreateNoteInput, ListNotesQuery, UpdateNoteInput } from './notes.schema.js';

type Note = Prisma.NoteGetPayload<Record<string, never>>;

/**
 * Pinned notes always sort first, whatever secondary order is requested — that
 * is what pinning means.
 */
const ORDER_BY: Record<ListNotesQuery['sort'], Prisma.NoteOrderByWithRelationInput[]> = {
  newest: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  oldest: [{ pinned: 'desc' }, { createdAt: 'asc' }],
  title: [{ pinned: 'desc' }, { title: 'asc' }],
};

function buildWhere(userId: string, query: ListNotesQuery): Prisma.NoteWhereInput {
  return {
    userId,
    ...(query.category ? { category: query.category } : {}),
    ...(query.color ? { color: query.color } : {}),
    ...(query.pinned !== undefined ? { pinned: query.pinned } : {}),
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

export async function list(userId: string, query: ListNotesQuery): Promise<Paginated<Note>> {
  const where = buildWhere(userId, query);
  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total] = await prisma.$transaction([
    prisma.note.findMany({ where, orderBy: ORDER_BY[query.sort], ...toSkipTake(pagination) }),
    prisma.note.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

export async function getById(userId: string, id: string): Promise<Note> {
  const note = await prisma.note.findFirst({ where: { id, userId } });
  if (!note) throw new NotFoundError('Note');
  return note;
}

export async function create(userId: string, input: CreateNoteInput): Promise<Note> {
  return prisma.note.create({
    data: {
      userId,
      title: input.title,
      content: input.content ?? null,
      category: input.category,
      color: input.color,
      pinned: input.pinned,
    },
  });
}

export async function update(userId: string, id: string, input: UpdateNoteInput): Promise<Note> {
  const data: Prisma.NoteUpdateManyMutationInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.content !== undefined ? { content: input.content ?? null } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
  };

  const result = await prisma.note.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new NotFoundError('Note');

  return getById(userId, id);
}

export async function remove(userId: string, id: string): Promise<void> {
  const result = await prisma.note.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Note');
}

export async function categories(userId: string): Promise<string[]> {
  const rows = await prisma.note.findMany({
    where: { userId },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}
