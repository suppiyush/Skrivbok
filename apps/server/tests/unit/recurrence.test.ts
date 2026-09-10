/**
 * Recurrence expansion.
 *
 * These are the tests that matter most in the whole suite. Recurrence is the
 * feature most likely to be quietly wrong — a DST bug shows up as "my meeting
 * is an hour early", months after the code shipped, and is very hard to trace
 * back. `recurrence.ts` is pure, so it can be pinned down exactly.
 */
import { describe, expect, it } from 'vitest';
import { expandOccurrences } from '../../src/modules/calendar/recurrence.js';

/** Wall-clock time in a given zone, for readable assertions. */
function localTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, timeStyle: 'short' }).format(date);
}

function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(date);
}

describe('expandOccurrences', () => {
  describe('non-repeating events', () => {
    it('returns the single occurrence when it overlaps the window', () => {
      const result = expandOccurrences(
        {
          startAt: new Date('2027-03-10T09:00:00Z'),
          endAt: new Date('2027-03-10T10:00:00Z'),
          timezone: 'UTC',
          recurrence: 'NONE',
          recurrenceEndAt: null,
        },
        new Date('2027-03-01T00:00:00Z'),
        new Date('2027-03-31T00:00:00Z'),
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.isRecurrence).toBe(false);
    });

    it('returns nothing when it falls outside the window', () => {
      const result = expandOccurrences(
        {
          startAt: new Date('2027-01-01T09:00:00Z'),
          endAt: new Date('2027-01-01T10:00:00Z'),
          timezone: 'UTC',
          recurrence: 'NONE',
          recurrenceEndAt: null,
        },
        new Date('2027-03-01T00:00:00Z'),
        new Date('2027-03-31T00:00:00Z'),
      );

      expect(result).toEqual([]);
    });

    it('includes an event that merely overlaps the window edge', () => {
      // 23:00–01:00 must appear in the window covering the following day.
      const result = expandOccurrences(
        {
          startAt: new Date('2027-12-01T22:00:00Z'),
          endAt: new Date('2027-12-02T01:00:00Z'),
          timezone: 'UTC',
          recurrence: 'NONE',
          recurrenceEndAt: null,
        },
        new Date('2027-12-02T00:00:00Z'),
        new Date('2027-12-02T23:59:00Z'),
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('daylight saving — the reason this module exists', () => {
    it('keeps the local time fixed across the European autumn transition', () => {
      // Europe/Stockholm leaves DST on 25 October 2026. A weekly 10:00 meeting
      // must stay at 10:00 local, which means the UTC instant has to move.
      const result = expandOccurrences(
        {
          startAt: new Date('2026-10-13T08:00:00Z'), // 10:00 CEST
          endAt: new Date('2026-10-13T09:00:00Z'),
          timezone: 'Europe/Stockholm',
          recurrence: 'WEEKLY',
          recurrenceEndAt: new Date('2026-11-30T00:00:00Z'),
        },
        new Date('2026-10-01T00:00:00Z'),
        new Date('2026-11-30T00:00:00Z'),
      );

      expect(result.length).toBeGreaterThanOrEqual(6);

      // Every occurrence reads 10:00 locally…
      for (const occurrence of result) {
        expect(localTime(occurrence.startAt, 'Europe/Stockholm')).toBe('10:00');
      }

      // …while the underlying UTC instant shifts by an hour at the boundary.
      const before = result.find((o) => o.startAt < new Date('2026-10-25T00:00:00Z'));
      const after = result.find((o) => o.startAt > new Date('2026-10-26T00:00:00Z'));

      expect(before?.startAt.toISOString()).toContain('T08:00');
      expect(after?.startAt.toISOString()).toContain('T09:00');
    });

    it('keeps the local time fixed across the spring transition too', () => {
      // Northward: Europe/Stockholm enters DST on 29 March 2026.
      const result = expandOccurrences(
        {
          startAt: new Date('2026-03-16T09:00:00Z'), // 10:00 CET
          endAt: new Date('2026-03-16T10:00:00Z'),
          timezone: 'Europe/Stockholm',
          recurrence: 'WEEKLY',
          recurrenceEndAt: new Date('2026-04-20T00:00:00Z'),
        },
        new Date('2026-03-01T00:00:00Z'),
        new Date('2026-04-20T00:00:00Z'),
      );

      for (const occurrence of result) {
        expect(localTime(occurrence.startAt, 'Europe/Stockholm')).toBe('10:00');
      }
    });

    it('leaves a UTC series untouched, since UTC has no transitions', () => {
      const result = expandOccurrences(
        {
          startAt: new Date('2026-10-13T08:00:00Z'),
          endAt: new Date('2026-10-13T09:00:00Z'),
          timezone: 'UTC',
          recurrence: 'WEEKLY',
          recurrenceEndAt: new Date('2026-11-30T00:00:00Z'),
        },
        new Date('2026-10-01T00:00:00Z'),
        new Date('2026-11-30T00:00:00Z'),
      );

      for (const occurrence of result) {
        expect(occurrence.startAt.toISOString()).toContain('T08:00');
      }
    });
  });

  describe('month-end and leap years', () => {
    it('skips months with no 31st rather than sliding to the 28th', () => {
      const result = expandOccurrences(
        {
          startAt: new Date('2027-01-31T09:00:00Z'),
          endAt: new Date('2027-01-31T10:00:00Z'),
          timezone: 'UTC',
          recurrence: 'MONTHLY',
          recurrenceEndAt: new Date('2027-07-01T00:00:00Z'),
        },
        new Date('2027-01-01T00:00:00Z'),
        new Date('2027-07-01T00:00:00Z'),
      );

      const days = result.map((o) => localDate(o.startAt, 'UTC'));

      expect(days).toEqual(['2027-01-31', '2027-03-31', '2027-05-31']);
      // The important negative: February must not appear as the 28th.
      expect(days.some((d) => d.startsWith('2027-02'))).toBe(false);
    });

    it('skips non-leap years for a 29 February series', () => {
      const inYear = (year: number): string[] =>
        expandOccurrences(
          {
            startAt: new Date('2028-02-29T12:00:00Z'),
            endAt: new Date('2028-02-29T13:00:00Z'),
            timezone: 'UTC',
            recurrence: 'YEARLY',
            recurrenceEndAt: new Date('2033-03-01T00:00:00Z'),
          },
          new Date(`${year}-01-01T00:00:00Z`),
          new Date(`${year}-12-31T00:00:00Z`),
        ).map((o) => localDate(o.startAt, 'UTC'));

      expect(inYear(2028)).toEqual(['2028-02-29']);
      expect(inYear(2029)).toEqual([]);
      expect(inYear(2030)).toEqual([]);
      expect(inYear(2031)).toEqual([]);
      expect(inYear(2032)).toEqual(['2032-02-29']);
    });
  });

  describe('bounds', () => {
    it('stops at recurrenceEndAt', () => {
      const result = expandOccurrences(
        {
          startAt: new Date('2027-01-04T09:00:00Z'),
          endAt: new Date('2027-01-04T10:00:00Z'),
          timezone: 'UTC',
          recurrence: 'DAILY',
          recurrenceEndAt: new Date('2027-01-07T23:59:00Z'),
        },
        new Date('2027-01-01T00:00:00Z'),
        new Date('2027-02-01T00:00:00Z'),
      );

      expect(result).toHaveLength(4); // 4th, 5th, 6th, 7th
    });

    it('caps an open-ended daily series rather than expanding without bound', () => {
      const result = expandOccurrences(
        {
          startAt: new Date('2020-01-01T09:00:00Z'),
          endAt: new Date('2020-01-01T10:00:00Z'),
          timezone: 'UTC',
          recurrence: 'DAILY',
          recurrenceEndAt: null,
        },
        new Date('2020-01-01T00:00:00Z'),
        new Date('2030-01-01T00:00:00Z'),
      );

      expect(result.length).toBeLessThanOrEqual(750);
    });

    it('marks only the first occurrence as non-recurring', () => {
      const result = expandOccurrences(
        {
          startAt: new Date('2027-01-04T09:00:00Z'),
          endAt: new Date('2027-01-04T10:00:00Z'),
          timezone: 'UTC',
          recurrence: 'DAILY',
          recurrenceEndAt: new Date('2027-01-06T23:59:00Z'),
        },
        new Date('2027-01-01T00:00:00Z'),
        new Date('2027-02-01T00:00:00Z'),
      );

      expect(result.map((o) => o.isRecurrence)).toEqual([false, true, true]);
    });

    it('preserves the series duration on every occurrence', () => {
      const result = expandOccurrences(
        {
          startAt: new Date('2027-01-04T09:00:00Z'),
          endAt: new Date('2027-01-04T10:30:00Z'),
          timezone: 'UTC',
          recurrence: 'WEEKLY',
          recurrenceEndAt: new Date('2027-02-01T00:00:00Z'),
        },
        new Date('2027-01-01T00:00:00Z'),
        new Date('2027-02-01T00:00:00Z'),
      );

      for (const occurrence of result) {
        expect(occurrence.endAt.getTime() - occurrence.startAt.getTime()).toBe(90 * 60 * 1000);
      }
    });
  });
});
