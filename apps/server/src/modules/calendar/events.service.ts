/**
 * Calendar events: business rules.
 *
 * Single-owner in 7a. Part 7c adds the shared views, where another user's
 * events are filtered by `visibility` and by granted access.
 *
 * Storage model: a repeating event is **one row**. Occurrences are produced on
 * read by `recurrence.ts`. Writing out every instance would make editing a
 * series a bulk update and would need a cutoff date for open-ended repeats.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import { expandOccurrences } from './recurrence.js';
import type {
  CreateEventInput,
  ListEventsQuery,
  RangeQuery,
  UpdateEventInput,
} from './events.schema.js';

type EventRow = Prisma.CalendarEventGetPayload<Record<string, never>>;

/** One occurrence, flattened for the calendar grid. */
export interface EventOccurrence extends Omit<EventRow, 'startAt' | 'endAt'> {
  /** Start of *this* instance, which differs from the series start after the first. */
  startAt: Date;
  endAt: Date;
  /** The stored row this instance came from. Equal to `id` for the first. */
  seriesId: string;
  isRecurrence: boolean;
}

const ORDER_BY: Record<ListEventsQuery['sort'], Prisma.CalendarEventOrderByWithRelationInput[]> = {
  soonest: [{ startAt: 'asc' }],
  latest: [{ startAt: 'desc' }],
  newest: [{ createdAt: 'desc' }],
};

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Every occurrence overlapping `[from, to]` — what the calendar grid renders.
 *
 * The database query is a coarse filter: it keeps non-repeating events that
 * overlap the window, plus every repeating series that started before the
 * window closes and has not already ended. Those candidates are then expanded
 * precisely in memory.
 */
export async function listRange(userId: string, query: RangeQuery): Promise<EventOccurrence[]> {
  const rows = await prisma.calendarEvent.findMany({
    where: {
      userId,
      ...(query.category ? { category: query.category } : {}),
      OR: [
        // Non-repeating: a plain overlap test.
        { recurrence: 'NONE', startAt: { lte: query.to }, endAt: { gte: query.from } },
        // Repeating: began before the window ends, and either never ends or
        // ends after the window begins.
        {
          recurrence: { not: 'NONE' },
          startAt: { lte: query.to },
          OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: query.from } }],
        },
      ],
    },
    orderBy: { startAt: 'asc' },
  });

  const occurrences = rows.flatMap((row) =>
    expandOccurrences(row, query.from, query.to).map((occurrence) => ({
      ...row,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      seriesId: row.id,
      isRecurrence: occurrence.isRecurrence,
    })),
  );

  // Expansion interleaves series, so the flattened result needs a final sort.
  return occurrences.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** Flat list of stored events. Used by management screens, not the grid. */
export async function list(userId: string, query: ListEventsQuery): Promise<Paginated<EventRow>> {
  const where: Prisma.CalendarEventWhereInput = {
    userId,
    ...(query.category ? { category: query.category } : {}),
    ...(query.recurring === undefined
      ? {}
      : query.recurring
        ? { recurrence: { not: 'NONE' } }
        : { recurrence: 'NONE' }),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
            { location: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total] = await prisma.$transaction([
    prisma.calendarEvent.findMany({
      where,
      orderBy: ORDER_BY[query.sort],
      ...toSkipTake(pagination),
    }),
    prisma.calendarEvent.count({ where }),
  ]);

  return paginate(data, total, pagination);
}

export async function getById(userId: string, id: string): Promise<EventRow> {
  const event = await prisma.calendarEvent.findFirst({ where: { id, userId } });
  if (!event) throw new NotFoundError('Event');
  return event;
}

/** Distinct categories in use, for the filter chips. */
export async function categories(userId: string): Promise<string[]> {
  const rows = await prisma.calendarEvent.findMany({
    where: { userId },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function create(userId: string, input: CreateEventInput): Promise<EventRow> {
  // Default to the user's own zone rather than UTC, so an event created without
  // an explicit timezone still recurs at the right local hour.
  const timezone =
    input.timezone ??
    (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }))
      .timezone;

  return prisma.calendarEvent.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      timezone,
      isAllDay: input.isAllDay,
      category: input.category,
      priority: input.priority,
      showAs: input.showAs,
      visibility: input.visibility,
      isOnline: input.isOnline,
      meetingLink: input.meetingLink ?? null,
      attendees: [...new Set(input.attendees)],
      reminderMinutes: input.reminderMinutes ?? null,
      recurrence: input.recurrence,
      recurrenceEndAt: input.recurrenceEndAt ?? null,
    },
  });
}

/**
 * Update the stored event — that is, the whole series.
 *
 * Editing a single occurrence of a repeat is not supported: it needs an
 * exception model (a table of overrides keyed by original start time) that the
 * legacy application never had and no screen currently asks for.
 */
export async function update(
  userId: string,
  id: string,
  input: UpdateEventInput,
): Promise<EventRow> {
  const existing = await getById(userId, id);

  // Cross-field rules re-checked against the merged result: a PATCH that only
  // moves `endAt` earlier must still be compared with the *stored* `startAt`,
  // which the schema alone cannot see.
  const startAt = input.startAt ?? existing.startAt;
  const endAt = input.endAt ?? existing.endAt;
  const recurrence = input.recurrence ?? existing.recurrence;
  const recurrenceEndAt =
    input.recurrenceEndAt !== undefined ? input.recurrenceEndAt : existing.recurrenceEndAt;

  if (endAt < startAt) {
    throw new BadRequestError('The event cannot end before it starts');
  }

  if (recurrence !== 'NONE' && recurrenceEndAt && recurrenceEndAt < startAt) {
    throw new BadRequestError('The repeat cannot end before the first occurrence');
  }

  const data: Prisma.CalendarEventUpdateManyMutationInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description ?? null } : {}),
    ...(input.location !== undefined ? { location: input.location ?? null } : {}),
    ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
    ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.isAllDay !== undefined ? { isAllDay: input.isAllDay } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.showAs !== undefined ? { showAs: input.showAs } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    ...(input.isOnline !== undefined ? { isOnline: input.isOnline } : {}),
    ...(input.meetingLink !== undefined ? { meetingLink: input.meetingLink ?? null } : {}),
    ...(input.attendees !== undefined ? { attendees: [...new Set(input.attendees)] } : {}),
    ...(input.reminderMinutes !== undefined
      ? { reminderMinutes: input.reminderMinutes ?? null }
      : {}),
    ...(input.recurrence !== undefined ? { recurrence: input.recurrence } : {}),
    // Turning a repeat off must clear its end date, or the row keeps a value
    // that no longer means anything.
    ...(recurrence === 'NONE'
      ? { recurrenceEndAt: null }
      : input.recurrenceEndAt !== undefined
        ? { recurrenceEndAt: recurrenceEndAt }
        : {}),
  };

  const result = await prisma.calendarEvent.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new NotFoundError('Event');

  return getById(userId, id);
}

export async function remove(userId: string, id: string): Promise<void> {
  const result = await prisma.calendarEvent.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Event');
}
