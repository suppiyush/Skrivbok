/**
 * Project membership.
 *
 * This replaces the legacy `projects.colleagues` column, which held a JSON
 * string of names and emails. Because it was a string it could not be joined,
 * indexed, or counted, and "which projects am I a member of" required scanning
 * every project and parsing every value.
 *
 * A member row may exist before its person does: inviting someone who has no
 * account stores the email with `userId = null`, and `claimPendingInvites`
 * links it when they register.
 */
import type { ProjectRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { createLogger } from '../../config/logger.js';
import { BadRequestError, ConflictError, ErrorCode, NotFoundError } from '../../utils/errors.js';
import { sendProjectInvite } from '../../emails/index.js';
import { requireProjectRole } from './projects.access.js';
import type { AddMemberInput } from './projects.schema.js';

const log = createLogger('projects');

/**
 * Tell an invitee they have been invited.
 *
 * Shared by both paths that create a membership — adding someone to an
 * existing project, and naming them while the project is being created. They
 * drifted apart once already: creation invited people and told them nothing at
 * all, so the invitation existed only in the database.
 *
 * Two things go out, and which depends on whether the person exists yet:
 *   - registered: an in-app notification and the "you were added" email
 *   - not registered: only an email, and a different one — there is no
 *     notification to deliver to an account that does not exist, and no
 *     workspace to send them to
 *
 * Nothing here is awaited into the caller's transaction. A mail server being
 * slow or a notification failing must not roll back the membership itself, and
 * `dispatch` inside the mail layer already swallows and logs its own errors.
 */
async function announceInvite(
  projectId: string,
  invitee: { email: string; userId: string | null; role: ProjectRole },
): Promise<void> {
  const context = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, owner: { select: { name: true, email: true } } },
  });

  if (!context) return;

  if (invitee.userId) {
    await prisma.notification.create({
      data: {
        userId: invitee.userId,
        type: 'PROJECT_INVITE',
        title: 'You were added to a project',
        link: `/projects/${projectId}`,
      },
    });
  }

  sendProjectInvite(invitee.email, {
    projectName: context.name,
    inviterName: context.owner.name ?? context.owner.email,
    role: invitee.role,
    projectId,
    registered: invitee.userId !== null,
  });
}

/**
 * Announce a batch of invitations, one project, without letting a single
 * failure stop the rest. Exported for `projects.service.create`.
 */
export async function announceInvites(
  projectId: string,
  invitees: { email: string; userId: string | null; role: ProjectRole }[],
): Promise<void> {
  await Promise.all(
    invitees.map((invitee) =>
      announceInvite(projectId, invitee).catch((error: unknown) =>
        log.error({ projectId, err: error }, 'Could not announce a project invitation'),
      ),
    ),
  );
}

const memberSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  invitedAt: true,
  acceptedAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

/** Requires VIEWER — anyone on the project can see who else is on it. */
export async function list(userId: string, projectId: string) {
  await requireProjectRole(userId, projectId, 'VIEWER');

  return prisma.projectMember.findMany({
    where: { projectId },
    select: memberSelect,
    orderBy: [{ role: 'desc' }, { invitedAt: 'asc' }],
  });
}

/** Requires OWNER. Only the owner decides who is on a project. */
export async function add(userId: string, projectId: string, input: AddMemberInput) {
  await requireProjectRole(userId, projectId, 'OWNER');

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_email: { projectId, email: input.email } },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError('That person is already on this project', ErrorCode.ALREADY_EXISTS);
  }

  // Link straight away if they already have an account, so the project shows up
  // for them without waiting for anything.
  const invitee = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId: invitee?.id ?? null,
      email: input.email,
      name: input.name ?? null,
      role: input.role,
    },
    select: memberSelect,
  });

  // Everyone invited is told, registered or not. This used to notify only
  // people who already had an account — who are precisely the ones who would
  // have seen the project anyway on their next visit — and left a stranger
  // with no way to learn the invitation existed.
  await announceInvites(projectId, [
    { email: input.email, userId: invitee?.id ?? null, role: input.role },
  ]);

  log.info({ projectId, pending: !invitee }, 'Project member added');
  return member;
}

/** Requires OWNER. The OWNER row itself is not editable through this path. */
export async function updateRole(
  userId: string,
  projectId: string,
  memberId: string,
  role: ProjectRole,
) {
  await requireProjectRole(userId, projectId, 'OWNER');

  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
    select: { id: true, role: true },
  });

  if (!member) throw new NotFoundError('Project member');

  if (member.role === 'OWNER') {
    throw new BadRequestError('The owner role cannot be changed here — transfer ownership instead');
  }

  return prisma.projectMember.update({
    where: { id: memberId },
    data: { role },
    select: memberSelect,
  });
}

/**
 * Requires OWNER, except that any member may remove themselves — leaving a
 * project you were invited to should not require asking the owner.
 */
export async function remove(userId: string, projectId: string, memberId: string): Promise<void> {
  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
    select: { id: true, role: true, userId: true },
  });

  if (!member) throw new NotFoundError('Project member');

  const removingSelf = member.userId === userId;
  if (!removingSelf) {
    await requireProjectRole(userId, projectId, 'OWNER');
  } else {
    await requireProjectRole(userId, projectId, 'VIEWER');
  }

  if (member.role === 'OWNER') {
    // Removing the owner row would leave the project invisible to everyone,
    // including its owner, since visibility is decided by membership.
    throw new BadRequestError(
      'The project owner cannot be removed. Transfer ownership or delete the project.',
    );
  }

  await prisma.projectMember.delete({ where: { id: memberId } });
}

/** Accept an invitation. Only the invited person can accept their own. */
export async function accept(userId: string, projectId: string) {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true, acceptedAt: true },
  });

  if (!member) throw new NotFoundError('Invitation');
  if (member.acceptedAt) return member;

  return prisma.projectMember.update({
    where: { id: member.id },
    data: { acceptedAt: new Date() },
    select: memberSelect,
  });
}

/**
 * Requires OWNER. Swap the OWNER row with an existing member.
 *
 * Done in a transaction: a half-applied transfer would leave a project with two
 * owners or none.
 */
export async function transferOwnership(userId: string, projectId: string, memberId: string) {
  await requireProjectRole(userId, projectId, 'OWNER');

  const target = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
    select: { id: true, userId: true, role: true },
  });

  if (!target) throw new NotFoundError('Project member');
  if (target.role === 'OWNER') throw new BadRequestError('That member is already the owner');
  if (!target.userId) {
    throw new BadRequestError(
      'That person has not accepted their invitation yet, so ownership cannot be transferred to them',
    );
  }

  const currentOwner = await prisma.projectMember.findFirstOrThrow({
    where: { projectId, role: 'OWNER' },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.projectMember.update({ where: { id: currentOwner.id }, data: { role: 'EDITOR' } }),
    prisma.projectMember.update({
      where: { id: target.id },
      data: { role: 'OWNER', acceptedAt: new Date() },
    }),
    prisma.project.update({ where: { id: projectId }, data: { ownerId: target.userId } }),
  ]);

  log.info({ projectId, from: userId, to: target.userId }, 'Project ownership transferred');
}

/**
 * Link any invitations addressed to this email to the user who just registered.
 *
 * Called from the auth service on registration and on first Google sign-in, so
 * someone invited before they had an account finds the project waiting.
 */
export async function claimPendingInvites(userId: string, email: string): Promise<number> {
  const result = await prisma.projectMember.updateMany({
    where: { email, userId: null },
    data: { userId },
  });

  if (result.count > 0) {
    log.info({ userId, claimed: result.count }, 'Claimed pending project invitations');
  }

  return result.count;
}
