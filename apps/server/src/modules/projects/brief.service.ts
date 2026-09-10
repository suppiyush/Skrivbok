/**
 * The project brief.
 *
 * 25 fields that used to live as columns on the `projects` table, so every
 * project list query dragged them along. They are now a separate one-to-one
 * record, loaded only by the description screen.
 *
 * `upsert` rather than create/update: the brief is conceptually part of the
 * project, so the client should not have to know whether a row exists yet.
 */
import { prisma } from '../../db/prisma.js';
import { requireProjectRole } from './projects.access.js';
import type { UpsertBriefInput } from './projects.schema.js';

/**
 * Requires VIEWER. Returns null when nothing has been filled in — an empty
 * brief is a normal state, not a 404.
 */
export async function get(userId: string, projectId: string) {
  await requireProjectRole(userId, projectId, 'VIEWER');
  return prisma.projectBrief.findUnique({ where: { projectId } });
}

/** Requires EDITOR. */
export async function upsert(userId: string, projectId: string, input: UpsertBriefInput) {
  await requireProjectRole(userId, projectId, 'EDITOR');

  // Only the keys the client actually sent are written, so a screen that
  // submits one section cannot blank the others.
  const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));

  return prisma.projectBrief.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });
}
