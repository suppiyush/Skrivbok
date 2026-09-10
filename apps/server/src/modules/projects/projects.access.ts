/**
 * Project authorization.
 *
 * Projects are the first *shared* resource: unlike an idea or a note, a project
 * has several people on it with different rights. Every project endpoint routes
 * its access decision through this file, so the rules live in one place instead
 * of being re-derived per handler.
 *
 * Roles, most to least privileged:
 *
 *   OWNER   full control, including members and deletion
 *   EDITOR  may change the project and its brief
 *   VIEWER  read only
 *
 * The owner also has an OWNER row in `project_members`, so "who can see this
 * project" is a single query against one table rather than an `ownerId` check
 * OR-ed with a membership lookup.
 */
import type { ProjectRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { ForbiddenError, NotFoundError } from '../../utils/errors.js';

/** Higher number means more privilege. */
const RANK: Record<ProjectRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export interface ProjectAccess {
  projectId: string;
  role: ProjectRole;
  isOwner: boolean;
}

/**
 * Resolve the caller's role on a project.
 *
 * Returns null rather than throwing, for the few places that need to branch on
 * access rather than refuse. Everything else should use `requireProjectRole`.
 */
export async function getProjectAccess(
  userId: string,
  projectId: string,
): Promise<ProjectAccess | null> {
  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { role: true },
  });

  if (!membership) return null;

  return { projectId, role: membership.role, isOwner: membership.role === 'OWNER' };
}

/**
 * Require at least `minimum` on a project, or fail.
 *
 * A caller with no access at all gets 404, not 403 — a 403 would confirm that a
 * project with that id exists. A caller who *is* a member but lacks the rank
 * gets 403, because at that point they already know the project exists and the
 * honest answer is more useful than a misleading 404.
 */
export async function requireProjectRole(
  userId: string,
  projectId: string,
  minimum: ProjectRole,
): Promise<ProjectAccess> {
  const access = await getProjectAccess(userId, projectId);

  if (!access) throw new NotFoundError('Project');

  if (RANK[access.role] < RANK[minimum]) {
    throw new ForbiddenError(
      minimum === 'OWNER'
        ? 'Only the project owner can do that'
        : 'You have view-only access to this project',
    );
  }

  return access;
}
