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
    meetingGroupId: null,
    createdAt: new Date('2027-01-01T00:00:00Z'),
    updatedAt: new Date('2027-01-01T00:00:00Z'),
    isRecurrence: false,
    ...overrides,
  };
}

/** Fields that must never appear on a redacted event. */
const SECRETS = ['title', 'description', 'location', 'meetingLink', 'attendees', 'category'];

function expectRedacted(result: ReturnType<typeof projectForViewer>) {
  expect(result).not.toBeNull();
  expect(result?.redacted).toBe(true);
  expect(result?.involvesViewer).toBe(false);
  for (const field of SECRETS) {
    expect(result).not.toHaveProperty(field);
  }
}

describe('projectForViewer', () => {
  describe('an event that does not involve the viewer', () => {
    it('is a busy block when PRIVATE, for either grant', () => {
      // Not hidden: PRIVATE is the default for new events, and a shared
      // calendar that shows someone free when they are not is worse than none.
      expectRedacted(projectForViewer(occurrence({ visibility: 'PRIVATE' }), 'FREE_BUSY', false));
      expectRedacted(projectForViewer(occurrence({ visibility: 'PRIVATE' }), 'VIEW', false));
    });

    it('is a busy block when BUSY, for either grant', () => {
      expectRedacted(projectForViewer(occurrence({ visibility: 'BUSY' }), 'FREE_BUSY', false));
      expectRedacted(projectForViewer(occurrence({ visibility: 'BUSY' }), 'VIEW', false));
    });

    it('is a busy block when PUBLIC but the grant is only FREE_BUSY', () => {
      expectRedacted(projectForViewer(occurrence({ visibility: 'PUBLIC' }), 'FREE_BUSY', false));
    });

    it('is shown in full when PUBLIC and the grant is VIEW — both the owner’s choice', () => {
      const result = projectForViewer(occurrence({ visibility: 'PUBLIC' }), 'VIEW', false);

      expect(result?.redacted).toBe(false);
      expect(result?.involvesViewer).toBe(false);
      expect(result?.title).toBe('Confidential board meeting');
      expect(result?.location).toBe('Room 101');
    });

    it('still exposes the times, which is the point of free/busy', () => {
      const result = projectForViewer(occurrence({ visibility: 'PRIVATE' }), 'FREE_BUSY', false);

      expect(result?.startAt).toEqual(new Date('2027-06-01T09:00:00Z'));
      expect(result?.endAt).toEqual(new Date('2027-06-01T10:00:00Z'));
      expect(result?.showAs).toBe('BUSY');
    });

    it('is not shown at all when marked FREE', () => {
      expect(projectForViewer(occurrence({ showAs: 'FREE' }), 'VIEW', false)).toBeNull();
    });
  });

  describe('an event that involves the viewer', () => {
    it('is shown in full whatever its visibility and whatever the grant', () => {
      for (const visibility of ['PRIVATE', 'BUSY', 'PUBLIC'] as const) {
        const result = projectForViewer(occurrence({ visibility }), 'FREE_BUSY', true);

        expect(result?.redacted).toBe(false);
        expect(result?.involvesViewer).toBe(true);
        expect(result?.title).toBe('Confidential board meeting');
        expect(result?.attendees).toEqual(['ceo@example.com', 'cfo@example.com']);
      }
    });

    it('is shown even when marked FREE — they are part of it', () => {
      const result = projectForViewer(occurrence({ showAs: 'FREE' }), 'FREE_BUSY', true);
      expect(result?.redacted).toBe(false);
    });
  });

  it('never leaks a field that was added to the event but not to the projection', () => {
    // Redaction builds a new object rather than deleting keys, so a column
    // added to CalendarEvent later cannot appear here by accident. This test
    // pins that property down, for both the redacted and the full shape.
    const withNewColumn = {
      ...occurrence({ visibility: 'PUBLIC' }),
      someFutureSecretColumn: 'must not appear',
    } as EventOccurrence;

    expect(projectForViewer(withNewColumn, 'FREE_BUSY', false)).not.toHaveProperty(
      'someFutureSecretColumn',
    );
    expect(projectForViewer(withNewColumn, 'VIEW', true)).not.toHaveProperty(
      'someFutureSecretColumn',
    );
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

  it('counts PRIVATE events as busy, since the time is taken', () => {
    const result = toBusyIntervals([
      span('2027-07-01T09:00:00Z', '2027-07-01T10:00:00Z', { visibility: 'PRIVATE' }),
    ]);
    expect(result).toHaveLength(1);
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
