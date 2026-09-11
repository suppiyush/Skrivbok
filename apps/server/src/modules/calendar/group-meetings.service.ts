/**
 * Requesting a meet with several people at once.
 *
 * ## One meeting, many requests
 *
 * The request table is one row per pair — a sender and a receiver — and the
 * accept/decline/cancel rules are written for that pair. A meet with several
 * attendees keeps that shape rather than inventing another: it is one request
 * per attendee, all sharing a `groupId`. Each person answers their own, the
 * existing rules hold for each, and the group is what the UI shows and what
 * cancellation acts on.
 *
 * ## Whose calendar, and when
 *
 * The requester's event is made at once: they have arranged the time and it
 * is on their calendar from that moment, with everyone they asked listed on
 * it. Each attendee's event is made when they accept — the same rule as a
 * pair request, applied one side at a time. Every one of those events carries
 * the `groupId`, so cancelling the meet removes all of them together.
 *
 * ## Who may be asked
 *
 * Only someone who shares a project with the requester. That is the point of
 * the feature — a meet with your team — and it is also what makes taking user
 * ids acceptable here: an id that is not a teammate's is refused before it
 * can be used to learn anything.
 *
 * ## Notification
 *
 * In the app only. The pair request sends an email as well; this one does
 * not, by request — that is to be decided with the rest of the mail later.
 */
import { randomUUID } from 'node:crypto';
import { fromZonedTime } from 'date-fns-tz';
import { prisma } from '../../db/prisma.js';
import { sendMeetingCancelled, sendMeetingRequest } from '../../emails/index.js';
import { notify, notifyMany } from '../notifications/notify.js';
import { createLogger } from '../../config/logger.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import type { CreateGroupMeetInput } from './meetings.schema.js';

const log = createLogger('group-meetings');

/** Someone the user can ask to a meet: a registered co-member of a project. */
export interface Contact {
  id: string;
  name: string | null;
  email: string;
  /** The projects the two of them share, by name. Says why they are here. */
  projects: string[];
}

/**
 * Everyone who shares a project with the user, once each.
 *
 * Membership rows are per project, so a colleague on three shared projects
 * appears three times in the query and once here, with the three names.
 * Invited-by-email members with no account are left out: a meet needs a
 * calendar on the other side.
 */
export async function contacts(userId: string): Promise<Contact[]> {
  const rows = await prisma.projectMember.findMany({
    where: {
      userId: { not: null, notIn: [userId] },
      project: { members: { some: { userId } } },
    },
    select: {
      user: { select: { id: true, name: true, email: true } },
      project: { select: { name: true } },
    },
    orderBy: { project: { name: 'asc' } },
  });

  const byId = new Map<string, Contact>();
  for (const row of rows) {
    if (!row.user) continue;
    const existing = byId.get(row.user.id);
    if (existing) {
      existing.projects.push(row.project.name);
    } else {
      byId.set(row.user.id, { ...row.user, projects: [row.project.name] });
    }
  }

  return [...byId.values()].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

/** A wall-clock date and time in a zone, as the instant it names. */
function instantOf(date: string, time: string, timezone: string): Date {
  const at = fromZonedTime(`${date}T${time}:00`, timezone);
  if (Number.isNaN(at.getTime())) throw new BadRequestError('That date and time is not valid');
  return at;
}

export interface GroupMeetResult {
  groupId: string;
  eventId: string;
  requestIds: string[];
}

export async function create(
  userId: string,
  input: CreateGroupMeetInput,
): Promise<GroupMeetResult> {
  const attendeeIds = [...new Set(input.attendeeIds)].filter((id) => id !== userId);
  if (attendeeIds.length === 0) {
    throw new BadRequestError('Ask at least one other person');
  }

  // Every attendee has to be a teammate — see the note at the top.
  const allowed = await contacts(userId);
  const allowedIds = new Set(allowed.map((c) => c.id));
  const stranger = attendeeIds.find((id) => !allowedIds.has(id));
  if (stranger) {
    throw new BadRequestError('You can only ask people who share a project with you');
  }

  const startAt = instantOf(input.date, input.startTime, input.timezone);
  const endAt = instantOf(input.date, input.endTime, input.timezone);
  if (endAt <= startAt) throw new BadRequestError('The meet cannot end before it starts');
  if (endAt <= new Date()) throw new BadRequestError('That meeting time has already passed');

  const attendees = allowed.filter((c) => attendeeIds.includes(c.id));
  const sender = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const groupId = randomUUID();

  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.calendarEvent.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        startAt,
        endAt,
        timezone: input.timezone,
        category: 'Meeting',
        showAs: 'BUSY',
        visibility: 'BUSY',
        attendees: attendees.map((a) => a.email),
        meetingGroupId: groupId,
      },
      select: { id: true },
    });

    const requestIds: string[] = [];
    for (const attendee of attendees) {
      const request = await tx.meetingRequest.create({
        data: {
          senderId: userId,
          receiverId: attendee.id,
          title: input.title,
          description: input.description ?? null,
          startAt,
          endAt,
          timezone: input.timezone,
          groupId,
        },
        select: { id: true },
      });
      requestIds.push(request.id);

      await notify(
        attendee.id,
        {
          type: 'MEETING_REQUEST',
          title: `${sender.name ?? sender.email} asked you to a meet`,
          message: input.title,
          link: `/meetings?request=${request.id}`,
        },
        tx,
      );
    }

    return { groupId, eventId: event.id, requestIds };
  });

  // The same email a one-to-one request sends, once per attendee and under
  // the same preference. Sent after the transaction so a slow mail server
  // cannot hold the rows open.
  for (const attendee of attendees) {
    sendMeetingRequest(attendee.id, attendee.email, {
      senderName: sender.name ?? sender.email,
      title: input.title,
      startAt,
      endAt,
      timezone: input.timezone,
      description: input.description ?? null,
    });
  }

  log.info({ groupId, attendees: attendees.length }, 'Group meet requested');
  return result;
}

/**
 * Call the whole meet off. Sender only.
 *
 * Every request still open or accepted is cancelled, every event that carries
 * the group — the requester's and each accepter's — is removed, and everyone
 * who had not already declined is told.
 */
export async function cancel(userId: string, groupId: string): Promise<void> {
  const requests = await prisma.meetingRequest.findMany({
    where: { groupId },
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      status: true,
      title: true,
      startAt: true,
      timezone: true,
      sender: { select: { name: true, email: true } },
      receiver: { select: { email: true } },
    },
  });

  if (requests.length === 0) throw new NotFoundError('Meet');
  if (requests[0]?.senderId !== userId) {
    throw new ForbiddenError('Only the person who arranged the meet can cancel it');
  }

  const open = requests.filter((r) => r.status === 'PENDING' || r.status === 'ACCEPTED');

  await prisma.$transaction([
    prisma.meetingRequest.updateMany({
      where: { id: { in: open.map((r) => r.id) } },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    }),
    prisma.calendarEvent.deleteMany({ where: { meetingGroupId: groupId } }),
  ]);

  await notifyMany(
    open.map((r) => r.receiverId),
    {
      type: 'MEETING_REJECTED',
      title: 'Meet cancelled',
      message: requests[0]?.title ?? null,
      link: '/meetings',
    },
  );

  // Those who had accepted had it on their calendar; they get the email too.
  for (const r of open.filter((r) => r.status === 'ACCEPTED')) {
    sendMeetingCancelled(r.receiverId, r.receiver.email, {
      byName: r.sender.name ?? r.sender.email,
      title: r.title,
      startAt: r.startAt,
      timezone: r.timezone,
    });
  }

  log.info({ groupId, cancelled: open.length }, 'Group meet cancelled');
}
