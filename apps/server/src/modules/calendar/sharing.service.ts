/**
 * Reading other people's calendars.
 *
 * Every function here follows the same two steps, in this order:
 *
 *   1. Ask `accessLevelFor` whether the caller may look at all. No grant → 403.
 *   2. Pass every occurrence through `projectForViewer`, which decides what of
 *      it may be seen.
 *
 * Nothing in this file constructs a response from a raw event row. That is the
 * property worth preserving: a new column on `CalendarEvent` cannot leak here,
 * because the shared shape is built field by field in `visibility.ts`.
 */
import { prisma } from '../../db/prisma.js';
import { ForbiddenError } from '../../utils/errors.js';
import { expandOccurrences } from './recurrence.js';
import type { EventOccurrence } from './events.service.js';
import { accessLevelFor, resolveUserByEmail } from './access.service.js';
import {
  projectForViewer,
  toBusyIntervals,
  type BusyInterval,
  type SharedOccurrence,
} from './visibility.js';

/** Load and expand one person's occurrences across a window. */
async function occurrencesFor(ownerId: string, from: Date, to: Date): Promise<EventOccurrence[]> {
  const rows = await prisma.calendarEvent.findMany({
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
  });

  return rows.flatMap((row) =>
    expandOccurrences(row, from, to).map((o) => ({
      ...row,
      startAt: o.startAt,
      endAt: o.endAt,
      seriesId: row.id,
      isRecurrence: o.isRecurrence,
    })),
  );
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

  const occurrences = await occurrencesFor(owner.id, from, to);

  const events = occurrences
    .map((o) => projectForViewer(o, level))
    // `null` means the viewer may not know the event exists — PRIVATE events
    // vanish rather than appearing as an unexplained gap.
    .filter((e): e is SharedOccurrence => e !== null)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

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
    grants.map(async (grant) => {
      const occurrences = await occurrencesFor(grant.owner.id, from, to);
      return {
        owner: grant.owner,
        level: grant.level,
        events: occurrences
          .map((o) => projectForViewer(o, grant.level))
          .filter((e): e is SharedOccurrence => e !== null)
          .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
      };
    }),
  );

  return { own, shared };
}
