/**
 * Projects: business rules.
 *
 * Unlike the single-owner resources in Part 4, access here is decided by
 * `projects.access.ts` and every mutating function states the role it requires.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import { assertWithinLimit } from '../billing/limits.service.js';
import { announceInvites } from './members.service.js';
import { requireProjectRole } from './projects.access.js';
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from './projects.schema.js';

/** What a project looks like in a list: enough for a card, no brief. */
const listSelect = {
  id: true,
  name: true,
  description: true,
  progress: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  owner: { select: { id: true, name: true, email: true } },
  _count: { select: { members: true } },
} as const;

const ORDER_BY: Record<ListProjectsQuery['sort'], Prisma.ProjectOrderByWithRelationInput[]> = {
  recent: [{ updatedAt: 'desc' }],
  newest: [{ createdAt: 'desc' }],
  name: [{ name: 'asc' }],
  progress: [{ progress: 'desc' }],
};

function buildWhere(userId: string, query: ListProjectsQuery): Prisma.ProjectWhereInput {
  return {
    // Membership is the single source of visibility — the owner has an OWNER
    // member row, so this covers owned and shared projects alike.
    members: { some: { userId } },
    ...(query.scope === 'owned' ? { ownerId: userId } : {}),
    ...(query.scope === 'shared' ? { NOT: { ownerId: userId } } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export async function list(userId: string, query: ListProjectsQuery): Promise<Paginated<unknown>> {
  const where = buildWhere(userId, query);
  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      select: {
        ...listSelect,
        // The caller's own membership, so the UI knows what to enable without
        // fetching the full member list for every card.
        members: { where: { userId }, select: { role: true, acceptedAt: true } },
      },
      orderBy: ORDER_BY[query.sort],
      ...toSkipTake(pagination),
    }),
    prisma.project.count({ where }),
  ]);

  const data = projects.map(({ members, _count, ...project }) => ({
    ...project,
    memberCount: _count.members,
    myRole: members[0]?.role ?? 'VIEWER',
    invitePending: members[0]?.acceptedAt === null,
  }));

  return paginate(data, total, pagination);
}

/** Full project including members. Requires at least VIEWER. */
export async function getById(userId: string, projectId: string) {
  const access = await requireProjectRole(userId, projectId, 'VIEWER');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ...listSelect,
      members: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          invitedAt: true,
          acceptedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ role: 'desc' }, { invitedAt: 'asc' }],
      },
      brief: { select: { id: true, updatedAt: true } },
    },
  });

  if (!project) throw new NotFoundError('Project');

  const { _count, ...rest } = project;
  return { ...rest, memberCount: _count.members, myRole: access.role };
}

/**
 * Create a project, its owner membership and any invites in one transaction.
 *
 * All three succeed or none do — a project with no owner row would be invisible
 * to its own creator, since visibility is decided by membership.
 */
export async function create(userId: string, input: CreateProjectInput) {
  await assertWithinLimit(userId, 'projects');

  const owner = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true },
  });

  // Invitees who already have accounts are linked immediately; the rest stay
  // pending until they register. The owner is filtered out so a self-invite
  // cannot collide with the OWNER row.
  const invites = input.members.filter((m) => m.email !== owner.email);
  const existingUsers = invites.length
    ? await prisma.user.findMany({
        where: { email: { in: invites.map((m) => m.email) } },
        select: { id: true, email: true },
      })
    : [];
  const userIdByEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

  const project = await prisma.project.create({
    data: {
      ownerId: userId,
      name: input.name,
      description: input.description ?? null,
      progress: input.progress,
      members: {
        create: [
          {
            userId,
            email: owner.email,
            name: owner.name,
            role: 'OWNER',
            acceptedAt: new Date(),
          },
          ...invites.map((m) => ({
            userId: userIdByEmail.get(m.email) ?? null,
            email: m.email,
            name: m.name ?? null,
            role: m.role,
          })),
        ],
      },
    },
    select: listSelect,
  });

  // People named while the project is being created are invited exactly as
  // people added to it afterwards are. Creation used to write the membership
  // rows and tell nobody, so an invitation sent this way reached its recipient
  // only if they happened to sign in and find the project themselves.
  await announceInvites(
    project.id,
    invites.map((m) => ({
      email: m.email,
      userId: userIdByEmail.get(m.email) ?? null,
      role: m.role,
    })),
  );

  return project;
}

/** Requires EDITOR. Progress is an ordinary edit. */
export async function update(userId: string, projectId: string, input: UpdateProjectInput) {
  await requireProjectRole(userId, projectId, 'EDITOR');

  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
    },
    select: listSelect,
  });
}

/**
 * Requires OWNER. Members and brief cascade away with the project — the
 * database enforces that, not this function.
 */
export async function remove(userId: string, projectId: string): Promise<void> {
  await requireProjectRole(userId, projectId, 'OWNER');
  await prisma.project.delete({ where: { id: projectId } });
}
