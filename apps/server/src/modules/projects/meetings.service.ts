/**
 * Project meetings: the log of who met, when, and what was said.
 *
 * This is the project's own record. Attendees see it on their calendar (read
 * through, not copied) and hear about it in the bell when it is scheduled,
 * moved or called off — but only while it is still to come. A meeting logged
 * after the fact is history, and nobody is told about history.
 *
 * No email goes out from here. The one outward action, writing to the
 * attendees, is done by the client opening the user's own mail with the
 * addresses filled in, so the mail comes from them and not from us.
 *
 * Reading needs VIEWER; writing needs EDITOR. A viewer can see the history of
 * a project they are on but cannot rewrite it, which matches the brief.
 */
import { prisma } from '../../db/prisma.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { notifyMany } from '../notifications/notify.js';
import { requireProjectRole } from './projects.access.js';
import type { CreateMeetingInput, UpdateMeetingInput } from './projects.schema.js';

/** Enough to draw a meeting and everyone at it, without a second request. */
const meetingSelect = {
  id: true,
  projectId: true,
  title: true,
  heldAt: true,
  location: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  attendees: {
    select: {
      member: {
        select: { id: true, email: true, name: true, role: true, user: { select: { name: true } } },
      },
    },
  },
} as const;

type MeetingRow = NonNullable<Awaited<ReturnType<typeof fetchOne>>>;

async function fetchOne(projectId: string, meetingId: string) {
  return prisma.projectMeeting.findFirst({
    where: { id: meetingId, projectId },
    select: meetingSelect,
  });
}

/** The join table flattened: `attendees` becomes the members themselves. */
function shape(row: MeetingRow) {
  const { attendees, ...rest } = row;
  return {
    ...rest,
    attendees: attendees.map((a) => ({
      id: a.member.id,
      email: a.member.email,
      // The name they gave on signing up wins over the one the inviter typed.
      name: a.member.user?.name ?? a.member.name,
      role: a.member.role,
    })),
  };
}

export type ProjectMeeting = ReturnType<typeof shape>;

/** Attendees who have an account, minus the person acting — they already know. */
async function attendeeUserIds(memberIds: string[], except: string): Promise<string[]> {
  if (memberIds.length === 0) return [];
  const members = await prisma.projectMember.findMany({
    where: { id: { in: memberIds }, userId: { not: null } },
    select: { userId: true },
  });
  return members.map((m) => m.userId).filter((id): id is string => id !== null && id !== except);
}

function whenLabel(heldAt: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(heldAt);
}

async function projectName(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  return project?.name ?? 'a project';
}

/**
 * Every attendee must be on this project.
 *
 * Checked here rather than left to the foreign key, because the key only
 * knows the member row exists — not that it belongs to *this* project. Without
 * this, a member id from another project would be accepted and its person
 * listed as having attended a meeting they were never part of.
 */
async function checkAttendees(projectId: string, memberIds: string[]): Promise<void> {
  if (memberIds.length === 0) return;

  const unique = [...new Set(memberIds)];
  const found = await prisma.projectMember.count({
    where: { projectId, id: { in: unique } },
  });

  if (found !== unique.length) {
    throw new BadRequestError('Every attendee has to be a member of this project');
  }
}

export async function list(userId: string, projectId: string): Promise<ProjectMeeting[]> {
  await requireProjectRole(userId, projectId, 'VIEWER');

  const rows = await prisma.projectMeeting.findMany({
    where: { projectId },
    select: meetingSelect,
    // Newest first: the timeline reads down from what is next to what is past.
    orderBy: { heldAt: 'desc' },
  });

  return rows.map(shape);
}

export async function create(
  userId: string,
  projectId: string,
  input: CreateMeetingInput,
): Promise<ProjectMeeting> {
  await requireProjectRole(userId, projectId, 'EDITOR');
  await checkAttendees(projectId, input.attendeeIds);

  const attendeeIds = [...new Set(input.attendeeIds)];

  const created = await prisma.projectMeeting.create({
    data: {
      projectId,
      title: input.title,
      heldAt: input.heldAt,
      location: input.location ?? null,
      notes: input.notes ?? null,
      attendees: { create: attendeeIds.map((memberId) => ({ memberId })) },
    },
    select: meetingSelect,
  });

  if (created.heldAt > new Date()) {
    await notifyMany(await attendeeUserIds(attendeeIds, userId), {
      type: 'PROJECT_MEETING',
      title: `Meeting: ${created.title}`,
      message: `${whenLabel(created.heldAt)} UTC · ${await projectName(projectId)}`,
      link: `/projects/${projectId}/meetings`,
    });
  }

  return shape(created);
}

export async function update(
  userId: string,
  projectId: string,
  meetingId: string,
  input: UpdateMeetingInput,
): Promise<ProjectMeeting> {
  await requireProjectRole(userId, projectId, 'EDITOR');

  const existing = await fetchOne(projectId, meetingId);
  if (!existing) throw new NotFoundError('Meeting');

  if (input.attendeeIds !== undefined) await checkAttendees(projectId, input.attendeeIds);

  const attendeeIds = input.attendeeIds === undefined ? null : [...new Set(input.attendeeIds)];

  const updated = await prisma.projectMeeting.update({
    where: { id: meetingId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.heldAt !== undefined ? { heldAt: input.heldAt } : {}),
      ...(input.location !== undefined ? { location: input.location ?? null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      // The list is replaced whole, the way it was sent: the dialog shows a set
      // of boxes and sends the set that is ticked.
      ...(attendeeIds !== null
        ? {
            attendees: {
              deleteMany: {},
              create: attendeeIds.map((memberId) => ({ memberId })),
            },
          }
        : {}),
    },
    select: meetingSelect,
  });

  await announceChanges(userId, projectId, existing, updated, input);

  return shape(updated);
}

/**
 * Tell attendees what changed about an upcoming meeting.
 *
 * Three audiences, told three different things: people newly added hear it as
 * a fresh invitation, people taken off hear it was cancelled for them, and
 * people who stay hear only when the time moved. A change to the notes or the
 * title alone is silent — that is editing the record, not the plan.
 */
async function announceChanges(
  actorId: string,
  projectId: string,
  before: MeetingRow,
  after: MeetingRow,
  input: UpdateMeetingInput,
): Promise<void> {
  const upcoming = after.heldAt > new Date();
  const wasUpcoming = before.heldAt > new Date();
  if (!upcoming && !wasUpcoming) return;

  const beforeIds = new Set(before.attendees.map((a) => a.member.id));
  const afterIds = new Set(after.attendees.map((a) => a.member.id));
  const added = [...afterIds].filter((id) => !beforeIds.has(id));
  const removed = [...beforeIds].filter((id) => !afterIds.has(id));
  const kept = [...afterIds].filter((id) => beforeIds.has(id));
  const link = `/projects/${projectId}/meetings`;
  const project = await projectName(projectId);

  if (upcoming && added.length > 0) {
    await notifyMany(await attendeeUserIds(added, actorId), {
      type: 'PROJECT_MEETING',
      title: `Meeting: ${after.title}`,
      message: `${whenLabel(after.heldAt)} UTC · ${project}`,
      link,
    });
  }
  if (wasUpcoming && removed.length > 0) {
    await notifyMany(await attendeeUserIds(removed, actorId), {
      type: 'PROJECT_MEETING',
      title: `You are no longer on: ${after.title}`,
      message: project,
      link,
    });
  }
  const moved = input.heldAt !== undefined && before.heldAt.getTime() !== after.heldAt.getTime();
  if (upcoming && moved && kept.length > 0) {
    await notifyMany(await attendeeUserIds(kept, actorId), {
      type: 'PROJECT_MEETING',
      title: `Moved: ${after.title}`,
      message: `Now ${whenLabel(after.heldAt)} UTC · ${project}`,
      link,
    });
  }
}

export async function remove(userId: string, projectId: string, meetingId: string): Promise<void> {
  await requireProjectRole(userId, projectId, 'EDITOR');

  const existing = await fetchOne(projectId, meetingId);
  if (!existing) throw new NotFoundError('Meeting');

  await prisma.projectMeeting.delete({ where: { id: meetingId } });

  if (existing.heldAt > new Date()) {
    await notifyMany(
      await attendeeUserIds(
        existing.attendees.map((a) => a.member.id),
        userId,
      ),
      {
        type: 'PROJECT_MEETING',
        title: `Cancelled: ${existing.title}`,
        message: `Was ${whenLabel(existing.heldAt)} UTC · ${await projectName(projectId)}`,
        link: `/projects/${projectId}/meetings`,
      },
    );
  }
}
