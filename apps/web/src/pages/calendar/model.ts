/**
 * The calendar's arithmetic, kept apart from how it is drawn.
 *
 * Which days a view covers and what window to fetch for them, where an event
 * sits in an hour grid when several overlap, and how the user's own events and
 * their teammates' become one list the views can draw without caring where
 * each came from.
 *
 * All day arithmetic is in local time and goes through `new Date(y, m, d)`, so
 * a view that crosses a daylight-saving change still lands on midnights.
 */
import type { CalendarEvent, SharedCalendar } from '../../lib/api';
import { paletteFor } from '../../lib/features';

/* ── Views ────────────────────────────────────────────────────────────────── */

export type CalendarView = 'day' | 'workweek' | 'week' | 'month' | 'agenda';

export const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'workweek', label: 'Workweek' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'agenda', label: 'Agenda' },
];

export function isView(value: unknown): value is CalendarView {
  return typeof value === 'string' && VIEWS.some((v) => v.value === value);
}

/** Height of one hour in the day and week grids. */
export const HOUR_PX = 48;

const MINUTE = 60_000;
const DAY_MS = 86_400_000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Monday-first weekday index, 0–6. `getDay()` is Sunday-first. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export interface ViewWindow {
  /** The columns (day and week views) or cells (month). Empty for the agenda. */
  days: Date[];
  from: Date;
  to: Date;
}

/**
 * What a view shows for a given cursor.
 *
 *   - day       the cursor's day
 *   - workweek  Monday to Friday of the cursor's week; on a weekend, the week
 *               about to start, since the one just gone is not what anyone
 *               opening a work week on Sunday wants
 *   - week      seven days from the cursor
 *   - month     whole Monday-first weeks covering the cursor's month
 *   - agenda    the cursor's month, as a list
 */
export function viewWindow(view: CalendarView, cursor: Date): ViewWindow {
  const day = startOfDay(cursor);

  switch (view) {
    case 'day':
      return { days: [day], from: day, to: addDays(day, 1) };

    case 'workweek': {
      const weekday = day.getDay();
      const monday = addDays(day, weekday === 0 ? 1 : weekday === 6 ? 2 : 1 - weekday);
      return {
        days: Array.from({ length: 5 }, (_, i) => addDays(monday, i)),
        from: monday,
        to: addDays(monday, 5),
      };
    }

    case 'week':
      return {
        days: Array.from({ length: 7 }, (_, i) => addDays(day, i)),
        from: day,
        to: addDays(day, 7),
      };

    case 'month': {
      const first = monthStart(day);
      const start = addDays(first, -mondayIndex(first));
      const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const total = Math.ceil((mondayIndex(first) + daysInMonth) / 7) * 7;
      return {
        days: Array.from({ length: total }, (_, i) => addDays(start, i)),
        from: start,
        to: addDays(start, total),
      };
    }

    case 'agenda': {
      const first = monthStart(day);
      return { days: [], from: first, to: new Date(first.getFullYear(), first.getMonth() + 1, 1) };
    }
  }
}

/** One step back or forward in a view's own unit. */
export function shift(view: CalendarView, cursor: Date, direction: 1 | -1): Date {
  if (view === 'day') return addDays(cursor, direction);
  if (view === 'workweek' || view === 'week') return addDays(cursor, 7 * direction);
  return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
}

export function viewTitle(view: CalendarView, window: ViewWindow, cursor: Date): string {
  if (view === 'day') {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(cursor);
  }
  if (view === 'workweek' || view === 'week') {
    const first = window.days[0] ?? cursor;
    return `Week of ${new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(first)}`;
  }
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    monthStart(cursor),
  );
}

/* ── One list of things to draw ───────────────────────────────────────────── */

export interface Teammate {
  email: string;
  name: string | null;
  colour: string;
}

/** Distinct from each other and from the section colours the user's own events wear. */
const TEAM_COLOURS = ['#2f6bfa', '#0e9f6e', '#9b51e0', '#c2410c', '#0891b2', '#be185d', '#4d7c0f'];

export function teamColour(index: number): string {
  return TEAM_COLOURS[index % TEAM_COLOURS.length] ?? '#2f6bfa';
}

export function shortName(teammate: Teammate): string {
  const base = teammate.name?.trim() || teammate.email.split('@')[0] || teammate.email;
  return base.split(' ')[0] || base;
}

export interface DisplayEvent {
  key: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  recurring: boolean;
  /** Only the times are known: drawn as a hatched Busy block. */
  redacted: boolean;
  location: string | null;
  description: string | null;
  /** The user's own event, or something read in from another section. */
  own: CalendarEvent | null;
  /** Set when this came from a teammate's calendar. */
  teammate: Teammate | null;
}

/**
 * The user's events and every shown teammate's, in time order.
 *
 * A meeting the user shares with a teammate is on both calendars; the copy
 * from the teammate's side is dropped when the user's own matches it by title
 * and time, so it is drawn once, as the user's.
 */
export function mergeCalendars(
  own: CalendarEvent[],
  shared: { calendar: SharedCalendar; teammate: Teammate }[],
): DisplayEvent[] {
  const mine: DisplayEvent[] = own.map((event, i) => ({
    key: `own:${event.id}:${event.startAt}:${i}`,
    title: event.title,
    start: new Date(event.startAt),
    end: new Date(event.endAt),
    isAllDay: event.isAllDay,
    recurring: event.recurrence !== 'NONE',
    redacted: Boolean(event.redacted),
    location: event.location,
    description: event.description,
    own: event,
    teammate: null,
  }));

  const signature = (title: string, start: Date, end: Date) =>
    `${title}|${start.getTime()}|${end.getTime()}`;
  const seen = new Set(mine.map((e) => signature(e.title, e.start, e.end)));

  const theirs = shared.flatMap(({ calendar, teammate }) =>
    calendar.events.flatMap((occurrence, i): DisplayEvent[] => {
      const start = new Date(occurrence.startAt);
      const end = new Date(occurrence.endAt);
      if (!occurrence.redacted && seen.has(signature(occurrence.title ?? '', start, end))) {
        return [];
      }
      return [
        {
          key: `${teammate.email}:${occurrence.id}:${occurrence.startAt}:${i}`,
          title: occurrence.redacted ? 'Busy' : (occurrence.title ?? 'Busy'),
          start,
          end,
          isAllDay: occurrence.isAllDay,
          recurring: occurrence.isRecurrence,
          redacted: occurrence.redacted,
          location: occurrence.location ?? null,
          description: occurrence.description ?? null,
          own: null,
          teammate,
        },
      ];
    }),
  );

  return [...mine, ...theirs].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/* ── Placing events in an hour grid ───────────────────────────────────────── */

/** All-day, or long enough that an hour grid cannot draw it usefully. */
export function isAllDayLike(event: DisplayEvent): boolean {
  return event.isAllDay || event.end.getTime() - event.start.getTime() >= DAY_MS;
}

export function overlapsDay(event: DisplayEvent, day: Date): boolean {
  const dayStart = day.getTime();
  const dayEnd = addDays(day, 1).getTime();
  // A moment — a deadline — sits on the day it falls in.
  if (event.end.getTime() === event.start.getTime()) {
    return event.start.getTime() >= dayStart && event.start.getTime() < dayEnd;
  }
  return event.start.getTime() < dayEnd && event.end.getTime() > dayStart;
}

export interface Placed {
  event: DisplayEvent;
  /** Minutes from the day's midnight. */
  top: number;
  height: number;
  column: number;
  columns: number;
}

/** The shortest block drawn, so a deadline or a five-minute call is still clickable. */
const MIN_MINUTES = 30;

/**
 * Lay a day's timed events out side by side where they overlap.
 *
 * Events are taken in start order and each goes into the first column that is
 * free by then. A run of events that overlap one another, directly or through
 * a chain, shares a column count, so the widths within it agree; the next run
 * starts afresh at full width.
 */
export function placeTimed(events: DisplayEvent[], day: Date): Placed[] {
  const dayStart = day.getTime();

  const items = events
    .map((event) => {
      const startMin = Math.max(0, (event.start.getTime() - dayStart) / MINUTE);
      const endMin = Math.min(1440, (event.end.getTime() - dayStart) / MINUTE);
      const top = Math.min(startMin, 1440 - MIN_MINUTES);
      return { event, top, bottom: Math.max(endMin, top + MIN_MINUTES) };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const placed: Placed[] = [];
  let run: { item: (typeof items)[number]; column: number }[] = [];
  let columnEnds: number[] = [];
  let runEnd = -1;

  const close = () => {
    for (const { item, column } of run) {
      placed.push({
        event: item.event,
        top: item.top,
        height: item.bottom - item.top,
        column,
        columns: columnEnds.length,
      });
    }
    run = [];
    columnEnds = [];
    runEnd = -1;
  };

  for (const item of items) {
    if (run.length > 0 && item.top >= runEnd) close();

    let column = columnEnds.findIndex((end) => end <= item.top);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.bottom);
    } else {
      columnEnds[column] = item.bottom;
    }

    run.push({ item, column });
    runEnd = Math.max(runEnd, item.bottom);
  }
  close();

  return placed;
}

/* ── Colour ───────────────────────────────────────────────────────────────── */

/**
 * What kind of thing a chip is, and how it is drawn.
 *
 * Four kinds share the grid and each wears the colour of the section it came
 * from, so the calendar reads as a view over the workspace rather than a
 * section of its own: a deadline is red because Deadlines is red, a team
 * meeting amber because Projects is. Teammates' events wear that teammate's
 * colour instead.
 */
export type ChipKind = 'event' | 'deadline' | 'team' | 'meeting';

export function chipKind(event: CalendarEvent): ChipKind {
  if (event.deadline) return 'deadline';
  if (event.project) return 'team';
  if (event.meetingRequestId) return 'meeting';
  return 'event';
}

export const CHIP: Record<
  ChipKind,
  {
    label: string;
    icon: string | null;
    palette: () => { tint: string; deep: string; brand: string };
  }
> = {
  event: {
    label: 'Event',
    icon: null,
    palette: () => ({
      tint: 'var(--color-brand-tint)',
      deep: 'var(--color-brand-deep)',
      brand: 'var(--color-brand)',
    }),
  },
  deadline: { label: 'Deadline', icon: 'flag', palette: () => paletteFor('/deadlines')! },
  team: { label: 'Team meeting', icon: 'groups', palette: () => paletteFor('/projects')! },
  meeting: { label: 'Meeting', icon: 'handshake', palette: () => paletteFor('/meetings')! },
};

export function coloursFor(event: DisplayEvent): {
  tint: string;
  deep: string;
  brand: string;
  icon: string | null;
} {
  if (event.teammate) {
    const colour = event.teammate.colour;
    return {
      tint: `color-mix(in srgb, ${colour} 14%, var(--color-surface))`,
      deep: colour,
      brand: colour,
      icon: null,
    };
  }
  const kind = event.own ? chipKind(event.own) : 'event';
  return { ...CHIP[kind].palette(), icon: CHIP[kind].icon };
}

/** The hatching on a Busy block: it must look withheld, not broken. */
export const HATCH =
  'repeating-linear-gradient(45deg, rgb(11 15 25 / 0.05) 0 5px, transparent 5px 10px)';
