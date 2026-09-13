/**
 * What one person is allowed to see of another person's event.
 *
 * This is the most security-sensitive function in the calendar. Everything that
 * leaves a shared or team endpoint passes through it, and the redaction happens
 * by **constructing a new object** rather than deleting fields from the stored
 * row — so a column added to the schema later is invisible by default instead
 * of leaking until someone remembers to exclude it.
 *
 * The rule, in order:
 *
 *   1. An event that involves the viewer is shown in full — they are one of
 *      its attendees, it is a meeting between the two of them, or it is a
 *      project meeting they attend. Nothing is revealed that they were not
 *      already part of.
 *   2. An event the owner marked PUBLIC, read through a VIEW grant, is shown
 *      in full. Both halves are the owner's choice.
 *   3. Everything else is an opaque block: the times, and that the slot is
 *      taken. Never a title, a place, a description or who else is there.
 *   4. Except an event marked FREE, which is not busy time and is not shown.
 *
 *   visibility │ involves viewer │ FREE_BUSY grant │ VIEW grant
 *   ───────────┼─────────────────┼─────────────────┼────────────
 *   PRIVATE    │ full detail     │ busy block      │ busy block
 *   BUSY       │ full detail     │ busy block      │ busy block
 *   PUBLIC     │ full detail     │ busy block      │ full detail
 *
 * PRIVATE is a busy block, not hidden. It is the default for every new event,
 * so hiding it meant a teammate given access saw an empty calendar, and a
 * calendar shared so people can find a time is worse than useless if it claims
 * someone is free when they are not. What PRIVATE protects is the detail, and
 * the detail stays protected.
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
  /** True when the viewer is part of this event, which is why they see it. */
  involvesViewer: boolean;

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
 * `involvesViewer` is worked out by the caller, which has the database to ask;
 * this function stays pure so the rule above can be read in one place.
 *
 * Returns `null` only for a FREE slot that does not involve the viewer — the
 * owner said that time is available, so there is nothing to show.
 */
export function projectForViewer(
  occurrence: EventOccurrence,
  level: CalendarAccessLevel,
  involvesViewer: boolean,
): SharedOccurrence | null {
  const fullDetail = involvesViewer || (level === 'VIEW' && occurrence.visibility === 'PUBLIC');

  if (!fullDetail && occurrence.showAs === 'FREE') return null;

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

  if (!fullDetail) {
    // Deliberately no title, description, location, attendees or link. The
    // viewer learns only that the slot is taken.
    return { ...base, redacted: true, involvesViewer: false };
  }

  return {
    ...base,
    redacted: false,
    involvesViewer,
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
 * `FREE` events are excluded — that is what marking a slot free means. PRIVATE
 * ones are included, for the reason given at the top of the file.
 */
export function toBusyIntervals(occurrences: EventOccurrence[]): BusyInterval[] {
  const spans = occurrences
    .filter((o) => o.showAs !== 'FREE')
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
