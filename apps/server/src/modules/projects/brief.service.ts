/**
 * The project brief.
 *
 * A document the team writes themselves: an ordered list of headings and prose,
 * rather than the 25 fixed fields this replaced. Those decided in advance what
 * a project was allowed to say about itself, and a project that did not fit the
 * shape left most of them null.
 *
 * Saved whole rather than section by section. An editing pass can add, delete
 * and reorder at once, and expressing that as patches would mean inventing ids
 * on the client and reconciling them here. Replacing the set is one round trip,
 * it is idempotent, and the array's order is the document's order.
 */
import { prisma } from '../../db/prisma.js';
import { requireProjectRole } from './projects.access.js';
import type { UpsertBriefInput } from './projects.schema.js';

const briefSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  sections: {
    select: { id: true, heading: true, body: true, position: true },
    orderBy: { position: 'asc' },
  },
} as const;

/**
 * Requires VIEWER. Returns null when the brief has never been opened — an
 * unwritten brief is a normal state, not a 404.
 */
export async function get(userId: string, projectId: string) {
  await requireProjectRole(userId, projectId, 'VIEWER');

  return prisma.projectBrief.findUnique({
    where: { projectId },
    select: briefSelect,
  });
}

/**
 * Requires EDITOR.
 *
 * The delete and the re-create run in one transaction: a failure half way
 * through would otherwise leave the brief holding whichever sections happened
 * to be written before it, which is a document nobody wrote.
 */
export async function upsert(userId: string, projectId: string, input: UpsertBriefInput) {
  await requireProjectRole(userId, projectId, 'EDITOR');

  const rows = input.sections.map((section, index) => ({
    heading: section.heading,
    body: section.body,
    position: index,
  }));

  return prisma.$transaction(async (tx) => {
    // `update: {}` still touches `updatedAt`, so an existing brief records
    // when it was last edited even though no column of its own changed.
    const brief = await tx.projectBrief.upsert({
      where: { projectId },
      create: { projectId },
      update: {},
      select: { id: true },
    });

    await tx.briefSection.deleteMany({ where: { briefId: brief.id } });

    if (rows.length > 0) {
      await tx.briefSection.createMany({
        data: rows.map((row) => ({ ...row, briefId: brief.id })),
      });
    }

    return tx.projectBrief.findUniqueOrThrow({
      where: { id: brief.id },
      select: briefSelect,
    });
  });
}
