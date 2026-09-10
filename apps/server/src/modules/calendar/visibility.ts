/**
 * What one person is allowed to see of another person's event.
 *
 * This is the most security-sensitive function in the calendar. Everything that
 * leaves a shared or team endpoint passes through it, and the redaction happens
 * by **constructing a new object** rather than deleting fields from the stored
 * row — so a column added to the schema later is invisible by default instead
 * of leaking until someone remembers to exclude it.
 *
 * The matrix:
 *
 *   event.visibility │ FREE_BUSY grant │ VIEW grant
 *   ─────────────────┼─────────────────┼────────────
 *   PRIVATE          │ hidden entirely │ hidden entirely
 *   BUSY             │ opaque block    │ opaque block
 *   PUBLIC           │ opaque block    │ full detail
 *
 * PRIVATE is hidden even from a VIEW grant: granting someone access to your
 * calendar is not the same as waiving the privacy you set on a specific event.
 * PRIVATE is also the default for new events (7a), so the safe case is what
 * happens when nobody thinks about it.
 */
import type { CalendarAccessLevel } from '@prisma/client';
import type { EventOccurrence } from './events.service.js';

/** An event as another person sees it. */
export interface SharedOccurrence {
  id: string;
  seriesId: string;
  ownerId: string;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  showAs: string;
  isRecurrence: boolean;
  /** True when the details were withheld — the UI renders a plain "Busy" block. */
  redacted: boolean;

  // Present only when `redacted` is false.
  title?: string;
  description?: string | null;
  location?: string | null;
  category?: string;
  priority?: string;
  isOnline?: boolean;
  meetingLink?: string | null;
  attendees?: string[];
}

/**
 * Project one occurrence for a viewer.
 *
 * Returns `null` when the viewer may not know the event exists at all — the
 * caller filters those out, so a PRIVATE event does not even appear as a gap.
 */
export function projectForViewer(
  occurrence: EventOccurrence,
  level: CalendarAccessLevel,
): SharedOccurrence | null {
  if (occurrence.visibility === 'PRIVATE') return null;

  const base = {
    id: occurrence.id,
    seriesId: occurrence.seriesId,
    ownerId: occurrence.userId,
    startAt: occurrence.startAt,
    endAt: occurrence.endAt,
    isAllDay: occurrence.isAllDay,
    showAs: occurrence.showAs,
    isRecurrence: occurrence.isRecurrence,
  };

  const fullDetail = level === 'VIEW' && occurrence.visibility === 'PUBLIC';

  if (!fullDetail) {
    // Deliberately no title, description, location, attendees or link. The
    // viewer learns only that the slot is taken.
    return { ...base, redacted: true };
  }

  return {
    ...base,
    redacted: false,
    title: occurrence.title,
    description: occurrence.description,
    location: occurrence.location,
    category: occurrence.category,
    priority: occurrence.priority,
    isOnline: occurrence.isOnline,
    meetingLink: occurrence.meetingLink,
    attendees: occurrence.attendees,
  };
}

/** A period during which someone is unavailable. No detail whatsoever. */
export interface BusyInterval {
  startAt: Date;
  endAt: Date;
}

/**
 * Reduce a person's occurrences to merged busy intervals.
 *
 * Merging matters for privacy as well as tidiness: three back-to-back meetings
 * become one block, so the shape of someone's day is not exposed by counting
 * the gaps between them.
 *
 * `FREE` events are excluded — that is what marking a slot free means.
 */
export function toBusyIntervals(occurrences: EventOccurrence[]): BusyInterval[] {
  const spans = occurrences
    .filter((o) => o.showAs !== 'FREE' && o.visibility !== 'PRIVATE')
    .map((o) => ({ startAt: o.startAt, endAt: o.endAt }))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const merged: BusyInterval[] = [];

  for (const span of spans) {
    const last = merged[merged.length - 1];
    // Touching intervals are merged too (`<=`), so 09:00–10:00 followed by
    // 10:00–11:00 reads as one 09:00–11:00 block rather than two.
    if (last && span.startAt <= last.endAt) {
      if (span.endAt > last.endAt) last.endAt = span.endAt;
    } else {
      merged.push({ startAt: span.startAt, endAt: span.endAt });
    }
  }

  return merged;
}
