/**
 * Search across everything the user owns or is on, by name.
 *
 * Titles only, on purpose. The header box is for *finding a thing you know
 * the name of* — a project, a paper, that note from Tuesday — and reaching it
 * in one keystroke. Full-text search over bodies is a different tool with a
 * different answer (a list of passages, ranked), and each section already has
 * its own search box for that. Matching on names keeps the suggestions short
 * enough to read and makes every hit self-evidently right.
 *
 * Nine queries, one per kind, run together and each capped. The cap is per
 * kind rather than overall so one prolific section cannot crowd the others
 * out of the list: a user with two hundred notes and one project should still
 * see the project when they type its name.
 */
import { prisma } from '../../db/prisma.js';

export type SearchKind =
  | 'project'
  | 'idea'
  | 'note'
  | 'journal'
  | 'deadline'
  | 'future-work'
  | 'literature'
  | 'career-goal'
  | 'event';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  /** A second line, when there is something short and useful to say. */
  subtitle: string | null;
  /** For an event: when it is, so the calendar can open on the right month. */
  at?: string;
}

/** Enough per kind to be useful, few enough to read. */
const PER_KIND = 5;

export async function search(userId: string, q: string): Promise<SearchHit[]> {
  const contains = { contains: q, mode: 'insensitive' as const };

  const [projects, ideas, notes, journal, deadlines, futureWork, literature, goals, events] =
    await Promise.all([
      prisma.project.findMany({
        // Membership, not ownership: a project shared with you is yours to find.
        where: { name: contains, members: { some: { userId } } },
        select: { id: true, name: true, progress: true },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND,
      }),
      prisma.idea.findMany({
        where: { userId, title: contains },
        select: { id: true, title: true, category: true },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND,
      }),
      prisma.note.findMany({
        where: { userId, title: contains },
        select: { id: true, title: true, audioUrl: true },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND,
      }),
      prisma.journalEntry.findMany({
        where: { userId, title: contains },
        select: { id: true, title: true, entryDate: true },
        orderBy: { entryDate: 'desc' },
        take: PER_KIND,
      }),
      prisma.deadline.findMany({
        where: { userId, title: contains },
        select: { id: true, title: true, dueAt: true, status: true },
        orderBy: { dueAt: 'asc' },
        take: PER_KIND,
      }),
      prisma.futureWork.findMany({
        where: { userId, title: contains },
        select: { id: true, title: true, timeline: true },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND,
      }),
      prisma.literature.findMany({
        where: { userId, title: contains },
        select: { id: true, title: true, authors: true, year: true },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND,
      }),
      prisma.careerGoal.findMany({
        where: { userId, title: contains },
        select: { id: true, title: true, currentStage: true, totalStages: true },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND,
      }),
      prisma.calendarEvent.findMany({
        where: { userId, title: contains },
        select: { id: true, title: true, startAt: true },
        orderBy: { startAt: 'desc' },
        take: PER_KIND,
      }),
    ]);

  const day = (d: Date) => d.toISOString().slice(0, 10);

  return [
    ...projects.map((p) => ({
      kind: 'project' as const,
      id: p.id,
      title: p.name,
      subtitle: `${p.progress}% complete`,
    })),
    ...ideas.map((i) => ({
      kind: 'idea' as const,
      id: i.id,
      title: i.title,
      subtitle: i.category,
    })),
    ...notes.map((n) => ({
      kind: 'note' as const,
      id: n.id,
      title: n.title,
      subtitle: n.audioUrl ? 'Voice note' : null,
    })),
    ...journal.map((j) => ({
      kind: 'journal' as const,
      id: j.id,
      title: j.title ?? day(j.entryDate),
      subtitle: j.title ? day(j.entryDate) : null,
    })),
    ...deadlines.map((d) => ({
      kind: 'deadline' as const,
      id: d.id,
      title: d.title,
      subtitle: `Due ${day(d.dueAt)}`,
    })),
    ...futureWork.map((f) => ({
      kind: 'future-work' as const,
      id: f.id,
      title: f.title,
      subtitle: f.timeline,
    })),
    ...literature.map((l) => ({
      kind: 'literature' as const,
      id: l.id,
      title: l.title,
      subtitle: [l.authors, l.year].filter(Boolean).join(', ') || null,
    })),
    ...goals.map((g) => ({
      kind: 'career-goal' as const,
      id: g.id,
      title: g.title,
      subtitle: `Stage ${g.currentStage} of ${g.totalStages}`,
    })),
    ...events.map((e) => ({
      kind: 'event' as const,
      id: e.id,
      title: e.title,
      subtitle: day(e.startAt),
      at: e.startAt.toISOString(),
    })),
  ];
}
