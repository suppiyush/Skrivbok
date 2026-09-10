/**
 * Recurrence expansion.
 *
 * A repeating event is stored once. This module turns that single row into the
 * individual occurrences that fall inside a requested window.
 *
 * ## Why this is done in the event's own timezone
 *
 * "Every Tuesday at 10:00" means 10:00 *local*, on both sides of a
 * daylight-saving change — even though the UTC instant shifts by an hour. The
 * naive approach, adding 7×24 hours to a UTC timestamp, silently moves a
 * Stockholm meeting to 09:00 or 11:00 for half the year.
 *
 * So each step is taken on the *wall-clock* time in the event's zone, and only
 * then converted back to UTC. The legacy server had a hardcoded table of fixed
 * UTC offsets per timezone, which cannot express DST at all.
 *
 * This file is deliberately pure — no database, no Express — so the logic can be
 * reasoned about and tested directly.
 */
import { addDays, addMonths, addYears, differenceInMilliseconds } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { RecurrenceFrequency } from '@prisma/client';

/** One materialised instance of a (possibly repeating) event. */
export interface Occurrence {
  /** Start of this instance, UTC. */
  startAt: Date;
  /** End of this instance, UTC. Always `startAt` + the series duration. */
  endAt: Date;
  /** True for every instance after the first. */
  isRecurrence: boolean;
}

export interface RecurrenceInput {
  startAt: Date;
  endAt: Date;
  timezone: string;
  recurrence: RecurrenceFrequency;
  recurrenceEndAt: Date | null;
}

/**
 * Hard ceiling on instances produced from one series in one query.
 *
 * A daily event with no end date, queried over a wide window, would otherwise
 * expand without bound. The window is already capped by the query schema; this
 * is the second line of defence.
 */
export const MAX_OCCURRENCES_PER_SERIES = 750;

/** How far the wall clock advances per step, per frequency. */
function step(date: Date, frequency: RecurrenceFrequency, index: number): Date {
  switch (frequency) {
    case 'DAILY':
      return addDays(date, index);
    case 'WEEKLY':
      return addDays(date, index * 7);
    case 'BIWEEKLY':
      return addDays(date, index * 14);
    case 'MONTHLY':
      return addMonths(date, index);
    case 'YEARLY':
      return addYears(date, index);
    case 'NONE':
      return date;
  }
}

/**
 * Did `addMonths`/`addYears` land on the day we asked for?
 *
 * `addMonths(Jan 31, 1)` yields Feb 28 — a useful default in most contexts, but
 * wrong for recurrence: "the 31st of each month" should skip months that have
 * no 31st rather than quietly becoming "the 28th". The same applies to a
 * 29 February event in a non-leap year.
 */
function landedOnIntendedDay(candidate: Date, intendedDayOfMonth: number): boolean {
  return candidate.getDate() === intendedDayOfMonth;
}

/**
 * Expand a series into the occurrences overlapping `[windowStart, windowEnd]`.
 *
 * An occurrence is included when it *overlaps* the window, not merely when it
 * starts inside it — a meeting running 23:00–01:00 must still appear on the day
 * the window covers.
 */
export function expandOccurrences(
  event: RecurrenceInput,
  windowStart: Date,
  windowEnd: Date,
): Occurrence[] {
  const durationMs = Math.max(0, differenceInMilliseconds(event.endAt, event.startAt));

  // Non-repeating: at most one occurrence, and only if it overlaps.
  if (event.recurrence === 'NONE') {
    return event.startAt <= windowEnd && event.endAt >= windowStart
      ? [{ startAt: event.startAt, endAt: event.endAt, isRecurrence: false }]
      : [];
  }

  // The series stops at whichever comes first: its own end date or the window.
  const seriesEnd =
    event.recurrenceEndAt && event.recurrenceEndAt < windowEnd ? event.recurrenceEndAt : windowEnd;

  if (event.startAt > seriesEnd) return [];

  // Work in the event's local wall-clock time from here on.
  const localStart = toZonedTime(event.startAt, event.timezone);
  const intendedDayOfMonth = localStart.getDate();

  const occurrences: Occurrence[] = [];

  for (let index = 0; occurrences.length < MAX_OCCURRENCES_PER_SERIES; index += 1) {
    const localCandidate = step(localStart, event.recurrence, index);

    // Skip months/years where the intended day does not exist, rather than
    // sliding the event onto a different day.
    const dayExists =
      event.recurrence === 'MONTHLY' || event.recurrence === 'YEARLY'
        ? landedOnIntendedDay(localCandidate, intendedDayOfMonth)
        : true;

    // Back to UTC. This is where a DST transition changes the offset, keeping
    // the local time of day stable.
    const startAt = fromZonedTime(localCandidate, event.timezone);

    if (startAt > seriesEnd) break;

    if (dayExists) {
      const endAt = new Date(startAt.getTime() + durationMs);
      if (endAt >= windowStart) {
        occurrences.push({ startAt, endAt, isRecurrence: index > 0 });
      }
    }
  }

  return occurrences;
}

/**
 * The last instant a series can produce, for cheaply excluding whole series
 * from a window query before expanding them. `null` means "never ends".
 */
export function seriesEndsAt(event: RecurrenceInput): Date | null {
  if (event.recurrence === 'NONE') return event.endAt;
  if (!event.recurrenceEndAt) return null;
  return new Date(
    event.recurrenceEndAt.getTime() + differenceInMilliseconds(event.endAt, event.startAt),
  );
}
