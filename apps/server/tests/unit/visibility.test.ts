/**
 * Calendar visibility projection.
 *
 * The security-critical pure function: it decides what one person may see of
 * another's calendar. A regression here is a data leak, not a broken screen, so
 * the tests assert on what is **absent** as much as what is present.
 */
import { describe, expect, it } from 'vitest';
import { projectForViewer, toBusyIntervals } from '../../src/modules/calendar/visibility.js';
import type { EventOccurrence } from '../../src/modules/calendar/events.service.js';

/** A fully-populated occurrence, so redaction has something to leak if it fails. */
function occurrence(overrides: Partial<EventOccurrence> = {}): EventOccurrence {
  return {
    id: 'evt_1',
    seriesId: 'evt_1',
    userId: 'user_owner',
    title: 'Confidential board meeting',
    description: 'Discussing the acquisition',
    location: 'Room 101',
    startAt: new Date('2027-06-01T09:00:00Z'),
    endAt: new Date('2027-06-01T10:00:00Z'),
    timezone: 'UTC',
    isAllDay: false,
    category: 'Work',
    priority: 'HIGH',
    showAs: 'BUSY',
    visibility: 'BUSY',
    isOnline: true,
    meetingLink: 'https://meet.example.com/secret-room',
    attendees: ['ceo@example.com', 'cfo@example.com'],
    reminderMinutes: 15,
    recurrence: 'NONE',
    recurrenceEndAt: null,
    meetingRequestId: null,
    createdAt: new Date('2027-01-01T00:00:00Z'),
    updatedAt: new Date('2027-01-01T00:00:00Z'),
    isRecurrence: false,
    ...overrides,
  };
}

/** Fields that must never appear on a redacted event. */
const SECRETS = ['title', 'description', 'location', 'meetingLink', 'attendees', 'category'];

describe('projectForViewer', () => {
  describe('PRIVATE events', () => {
    it('is hidden from a FREE_BUSY viewer', () => {
      expect(projectForViewer(occurrence({ visibility: 'PRIVATE' }), 'FREE_BUSY')).toBeNull();
    });

    it('is hidden from a VIEW viewer as well', () => {
      // The important one: a full-access grant still does not override the
      // privacy set on an individual event.
      expect(projectForViewer(occurrence({ visibility: 'PRIVATE' }), 'VIEW')).toBeNull();
    });
  });

  describe('BUSY events', () => {
    it('is redacted for FREE_BUSY', () => {
      const result = projectForViewer(occurrence({ visibility: 'BUSY' }), 'FREE_BUSY');

      expect(result).not.toBeNull();
      expect(result?.redacted).toBe(true);
      for (const field of SECRETS) {
        expect(result).not.toHaveProperty(field);
      }
    });

    it('is redacted for VIEW too — BUSY means busy', () => {
      const result = projectForViewer(occurrence({ visibility: 'BUSY' }), 'VIEW');

      expect(result?.redacted).toBe(true);
      for (const field of SECRETS) {
        expect(result).not.toHaveProperty(field);
      }
    });

    it('still exposes the times, which is the point of free/busy', () => {
      const result = projectForViewer(occurrence({ visibility: 'BUSY' }), 'FREE_BUSY');

      expect(result?.startAt).toEqual(new Date('2027-06-01T09:00:00Z'));
      expect(result?.endAt).toEqual(new Date('2027-06-01T10:00:00Z'));
      expect(result?.showAs).toBe('BUSY');
    });
  });

  describe('PUBLIC events', () => {
    it('is redacted for a FREE_BUSY viewer', () => {
      const result = projectForViewer(occurrence({ visibility: 'PUBLIC' }), 'FREE_BUSY');

      expect(result?.redacted).toBe(true);
      for (const field of SECRETS) {
        expect(result).not.toHaveProperty(field);
      }
    });

    it('is fully visible to a VIEW viewer', () => {
      const result = projectForViewer(occurrence({ visibility: 'PUBLIC' }), 'VIEW');

      expect(result?.redacted).toBe(false);
      expect(result?.title).toBe('Confidential board meeting');
      expect(result?.location).toBe('Room 101');
      expect(result?.attendees).toEqual(['ceo@example.com', 'cfo@example.com']);
    });
  });

  it('never leaks a field that was added to the event but not to the projection', () => {
    // Redaction builds a new object rather than deleting keys, so a column
    // added to CalendarEvent later cannot appear here by accident. This test
    // pins that property down.
    const withNewColumn = {
      ...occurrence({ visibility: 'BUSY' }),
      someFutureSecretColumn: 'must not appear',
    } as EventOccurrence;

    const result = projectForViewer(withNewColumn, 'VIEW');

    expect(result).not.toHaveProperty('someFutureSecretColumn');
  });
});

describe('toBusyIntervals', () => {
  const span = (start: string, end: string, extra: Partial<EventOccurrence> = {}) =>
    occurrence({ startAt: new Date(start), endAt: new Date(end), ...extra });

  it('merges overlapping intervals', () => {
    const result = toBusyIntervals([
      span('2027-07-01T09:00:00Z', '2027-07-01T11:00:00Z'),
      span('2027-07-01T10:30:00Z', '2027-07-01T12:00:00Z'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.startAt.toISOString()).toBe('2027-07-01T09:00:00.000Z');
    expect(result[0]?.endAt.toISOString()).toBe('2027-07-01T12:00:00.000Z');
  });

  it('merges touching intervals, so back-to-back meetings read as one block', () => {
    const result = toBusyIntervals([
      span('2027-07-01T09:00:00Z', '2027-07-01T10:00:00Z'),
      span('2027-07-01T10:00:00Z', '2027-07-01T11:00:00Z'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.endAt.toISOString()).toBe('2027-07-01T11:00:00.000Z');
  });

  it('keeps genuinely separate intervals apart', () => {
    const result = toBusyIntervals([
      span('2027-07-01T09:00:00Z', '2027-07-01T10:00:00Z'),
      span('2027-07-01T14:00:00Z', '2027-07-01T15:00:00Z'),
    ]);

    expect(result).toHaveLength(2);
  });

  it('excludes events marked FREE', () => {
    const result = toBusyIntervals([
      span('2027-07-01T09:00:00Z', '2027-07-01T10:00:00Z', { showAs: 'FREE' }),
    ]);
    expect(result).toEqual([]);
  });

  it('excludes PRIVATE events', () => {
    const result = toBusyIntervals([
      span('2027-07-01T09:00:00Z', '2027-07-01T10:00:00Z', { visibility: 'PRIVATE' }),
    ]);
    expect(result).toEqual([]);
  });

  it('reveals no titles or counts, only times', () => {
    const result = toBusyIntervals([
      span('2027-07-01T09:00:00Z', '2027-07-01T10:00:00Z'),
      span('2027-07-01T10:00:00Z', '2027-07-01T11:00:00Z'),
      span('2027-07-01T11:00:00Z', '2027-07-01T12:00:00Z'),
    ]);

    // Three meetings become one block: the shape of the day is not exposed.
    expect(result).toHaveLength(1);
    expect(Object.keys(result[0] ?? {})).toEqual(['startAt', 'endAt']);
  });

  it('handles an unsorted input', () => {
    const result = toBusyIntervals([
      span('2027-07-01T14:00:00Z', '2027-07-01T15:00:00Z'),
      span('2027-07-01T09:00:00Z', '2027-07-01T10:00:00Z'),
    ]);

    expect(result[0]?.startAt.toISOString()).toBe('2027-07-01T09:00:00.000Z');
  });
});
