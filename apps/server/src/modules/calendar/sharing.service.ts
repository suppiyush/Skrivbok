/**
 * Reading other people's calendars.
 *
 * Every function here follows the same steps, in this order:
 *
 *   1. Ask `accessLevelFor` whether the caller may look at all. No grant → 403.
 *   2. Work out which occurrences involve the caller.
 *   3. Pass every occurrence through `projectForViewer`, which decides what of
 *      it may be seen.
 *
 * Nothing in this file constructs a response from a raw event row. That is the
 * property worth preserving: a new column on `CalendarEvent` cannot leak here,
 * because the shared shape is built field by field in `visibility.ts`.
 */
import type { CalendarAccessLevel } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { ForbiddenError } from '../../utils/errors.js';
import { expandOccurrences } from './recurrence.js';
import { projectMeetingsInRange, type EventOccurrence } from './events.service.js';
import { accessLevelFor, resolveUserByEmail } from './access.service.js';
import {
  projectForViewer,
  toBusyIntervals,
  type BusyInterval,
  type SharedOccurrence,
} from './visibility.js';

/**
 * Load and expand one person's occurrences across a window.
 *
 * Their project meetings are included: a meeting in a project's log takes the
 * time as surely as an event on the calendar, and leaving it out would show
 * them free when they are not.
 */
async function occurrencesFor(ownerId: string, from: Date, to: Date): Promise<EventOccurrence[]> {
  const [rows, meetings] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId: ownerId,
        OR: [
          { recurrence: 'NONE', startAt: { lte: to }, endAt: { gte: from } },
          {
            recurrence: { not: 'NONE' },
            startAt: { lte: to },
            OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: from } }],
          },
        ],
      },
    }),
    projectMeetingsInRange(ownerId, { from, to }),
  ]);

  const events = rows.flatMap((row) =>
    expandOccurrences(row, from, to).map((o) => ({
      ...row,
      startAt: o.startAt,
      endAt: o.endAt,
      seriesId: row.id,
      isRecurrence: o.isRecurrence,
    })),
  );

  return [...events, ...meetings];
}

/**
 * Which of these occurrences is the viewer part of?
 *
 * Two ways in, both read from what the owner's own rows already say:
 *
 *   - Their address is among the attendees. A meeting request accepted between
 *     the two of them puts it there on both sides, and a project meeting lists
 *     every attendee's address.
 *   - It is a group meet they were asked to or organised, and have not turned
 *     down. Only the organiser's copy lists everyone, so an attendee's copy is
 *     matched through the requests that share its group id.
 */
async function involvementOf(
  viewerId: string,
  occurrences: EventOccurrence[],
): Promise<(occurrence: EventOccurrence) => boolean> {
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { email: true },
  });
  const email = viewer?.email.toLowerCase();

  const groupIds = [
    ...new Set(occurrences.flatMap((o) => (o.meetingGroupId ? [o.meetingGroupId] : []))),
  ];

  const groups = new Set<string>();
  if (groupIds.length > 0) {
    const requests = await prisma.meetingRequest.findMany({
      where: {
        groupId: { in: groupIds },
        status: { in: ['PENDING', 'ACCEPTED'] },
        OR: [{ senderId: viewerId }, { receiverId: viewerId }],
      },
      select: { groupId: true },
    });
    for (const request of requests) if (request.groupId) groups.add(request.groupId);
  }

  return (occurrence) =>
    (email !== undefined && occurrence.attendees.some((a) => a.toLowerCase() === email)) ||
    (occurrence.meetingGroupId !== null && groups.has(occurrence.meetingGroupId));
}

/** Steps 2 and 3 above, for one owner's occurrences. */
async function projectAll(
  viewerId: string,
  level: CalendarAccessLevel,
  occurrences: EventOccurrence[],
): Promise<SharedOccurrence[]> {
  const involves = await involvementOf(viewerId, occurrences);
  return occurrences
    .map((o) => projectForViewer(o, level, involves(o)))
    .filter((e): e is SharedOccurrence => e !== null)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export interface SharedCalendar {
  owner: { id: string; email: string; name: string | null; timezone: string };
  level: 'FREE_BUSY' | 'VIEW';
  events: SharedOccurrence[];
}

/**
 * One person's calendar, as the caller is permitted to see it.
 *
 * 403 rather than 404 when there is no grant: the caller supplied the email, so
 * they already know the account exists, and "ask them for access" is the useful
 * answer. Whether the *email* exists is a separate 404 from `resolveUserByEmail`.
 */
export async function sharedCalendar(
  viewerId: string,
  ownerEmail: string,
  from: Date,
  to: Date,
): Promise<SharedCalendar> {
  const owner = await resolveUserByEmail(ownerEmail);
  const level = await accessLevelFor(viewerId, owner.id);

  if (!level) {
    throw new ForbiddenError('You do not have access to that calendar');
  }

  const events = await projectAll(viewerId, level, await occurrencesFor(owner.id, from, to));
  return { owner, level, events };
}

export interface PersonAvailability {
  email: string;
  name: string | null;
  timezone: string;
  /** Null when the caller has no grant — reported, not thrown, so one missing
   *  permission does not fail the whole lookup. */
  busy: BusyInterval[] | null;
  hasAccess: boolean;
}

/**
 * Free/busy for several people, for finding a slot everyone can make.
 *
 * Only merged intervals are returned — never titles, never counts. Even a VIEW
 * grant gets no detail here, because this endpoint answers "when are they
 * free", and nothing more is needed to answer it.
 */
export async function availability(
  viewerId: string,
  emails: string[],
  from: Date,
  to: Date,
): Promise<PersonAvailability[]> {
  const unique = [...new Set(emails)];

  const users = await prisma.user.findMany({
    where: { email: { in: unique } },
    select: { id: true, email: true, name: true, timezone: true },
  });

  const byEmail = new Map(users.map((u) => [u.email, u]));

  return Promise.all(
    unique.map(async (email) => {
      const user = byEmail.get(email);

      // An address with no account is reported as inaccessible rather than as
      // an error, so a typo does not sink the whole query.
      if (!user) {
        return { email, name: null, timezone: 'UTC', busy: null, hasAccess: false };
      }

      const level = await accessLevelFor(viewerId, user.id);
      if (!level) {
        return {
          email: user.email,
          name: user.name,
          timezone: user.timezone,
          busy: null,
          hasAccess: false,
        };
      }

      const occurrences = await occurrencesFor(user.id, from, to);

      return {
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        busy: toBusyIntervals(occurrences),
        hasAccess: true,
      };
    }),
  );
}

export interface CombinedCalendar {
  own: EventOccurrence[];
  shared: SharedCalendar[];
}

/**
 * The caller's own events plus every calendar they hold a grant on.
 *
 * Own events are returned unredacted; everyone else's go through the same
 * projection as `sharedCalendar`.
 */
export async function combined(viewerId: string, from: Date, to: Date): Promise<CombinedCalendar> {
  const grants = await prisma.calendarAccess.findMany({
    where: { viewerId },
    select: {
      level: true,
      owner: { select: { id: true, email: true, name: true, timezone: true } },
    },
  });

  const own = (await occurrencesFor(viewerId, from, to)).sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  const shared = await Promise.all(
    grants.map(async (grant) => ({
      owner: grant.owner,
      level: grant.level,
      events: await projectAll(
        viewerId,
        grant.level,
        await occurrencesFor(grant.owner.id, from, to),
      ),
    })),
  );

  return { own, shared };
}
