/**
 * Reminders: deadlines, the daily agenda, things about to start, and
 * subscriptions about to end.
 *
 * ## Two clocks
 *
 * Some reminders belong to a *time of day* — "tell me at 09:00, where I am".
 * The worker does not ask "is it 09:00?"; it wakes every few minutes and asks,
 * for each user, "what is the local wall-clock time for this person right now,
 * and has their slot just passed?" Deadline reminders, the agenda and
 * subscription notices run on this clock, so they arrive at the hour the user
 * chose.
 *
 * Others belong to a *moment* — "fifteen minutes before it starts". Those run
 * on every tick regardless of the hour, asking "does anything start in the
 * next N minutes?" Event reminders, project-meeting reminders and overdue
 * notices run on this clock.
 *
 * The legacy scheduler kept a hardcoded table of fixed UTC offsets per timezone
 * and compared strings against it, which is wrong for half the year in any
 * country with daylight saving.
 *
 * ## Not sending twice
 *
 * Every send is recorded in `SentReminder`, unique on
 * `(userId, itemType, itemId, sentFor)`. The row is written **before** the
 * message goes out: if the process dies mid-batch the worst case is a reminder
 * that was not delivered, never one delivered twice. Given the choice, a
 * missed reminder is the better failure — a duplicate erodes trust in every
 * future one.
 */
import { toZonedTime } from 'date-fns-tz';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { createLogger } from '../config/logger.js';
import { expandOccurrences } from '../modules/calendar/recurrence.js';
import { notify, notifyMany } from '../modules/notifications/notify.js';
import {
  dailyAgenda,
  deadlineReminder,
  subscriptionEnding,
  subscriptionExpired,
} from '../emails/templates.js';
import { sendMail } from '../emails/transport.js';

const log = createLogger('reminders');

/**
 * How far back a slot still counts as "just passed".
 *
 * Must be at least as long as the cron interval, or a slot could fall between
 * two ticks and be missed entirely. The default cron runs every five minutes,
 * so this leaves a comfortable margin.
 *
 * (Note for future edits: a literal cron expression cannot be written inside a
 * block comment — the star-slash in it terminates the comment.)
 */
const SLOT_WINDOW_MINUTES = 15;

/** How long before a project meeting its attendees are nudged. */
const MEETING_LEAD_MINUTES = 15;

/** The longest an event may ask to be reminded ahead. Bounds the query. */
const MAX_EVENT_LEAD_MINUTES = 24 * 60;

/** A deadline older than this is not announced as overdue on a first run. */
const OVERDUE_LOOKBACK_DAYS = 7;

/** Days before a subscription ends at which the user is told. */
const SUBSCRIPTION_WARNINGS = [7, 1];

/** A project meeting lasts this long on the calendar; the agenda agrees. */
const PROJECT_MEETING_HOURS = 1;

const DAY_MS = 86_400_000;

/** Minutes past local midnight, in the user's own zone. */
function localMinutesNow(timezone: string, now: Date): number {
  const local = toZonedTime(now, timezone);
  return local.getHours() * 60 + local.getMinutes();
}

/** The user's current local calendar day, as a UTC-midnight Date for `@db.Date`. */
function localDateKey(timezone: string, now: Date): Date {
  const local = toZonedTime(now, timezone);
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

/** Parse "HH:mm" into minutes past midnight. Falls back to 09:00. */
function parseNotificationTime(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return 9 * 60;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return 9 * 60;

  return hours * 60 + minutes;
}

/**
 * Has the user's notification slot passed within the last `SLOT_WINDOW_MINUTES`?
 *
 * The window does not wrap across midnight: a slot at 00:05 is simply picked up
 * on the tick after it, which is what the comparison below already does.
 */
function slotJustPassed(timezone: string, notificationTime: string, now: Date): boolean {
  const nowMinutes = localMinutesNow(timezone, now);
  const slotMinutes = parseNotificationTime(notificationTime);
  const elapsed = nowMinutes - slotMinutes;
  return elapsed >= 0 && elapsed < SLOT_WINDOW_MINUTES;
}

type ItemType = 'DEADLINE' | 'DAILY_AGENDA' | 'CALENDAR_EVENT' | 'MEETING' | 'SUBSCRIPTION';

/**
 * Claim the right to send one reminder.
 *
 * Returns false when it has already been sent. The unique constraint does the
 * work, so two workers racing on the same row cannot both win.
 */
async function claim(userId: string, itemType: ItemType, itemId: string, sentFor: Date) {
  // `createMany` with `skipDuplicates` rather than `create` in a try/catch:
  // both are safe, but the exception route makes Prisma log a constraint
  // violation at error level on every duplicate. Since duplicates are the
  // *expected* outcome on most ticks, that would fill the log with noise and
  // train everyone to ignore real errors. Here a duplicate is simply `count: 0`.
  const result = await prisma.sentReminder.createMany({
    data: [{ userId, itemType, itemId, sentFor }],
    skipDuplicates: true,
  });

  return result.count === 1;
}

/** "in 15 min", "in 2 h", "now" — for a bell title, short. */
function inLabel(startAt: Date, now: Date): string {
  const minutes = Math.round((startAt.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `in ${hours} h`;
}

function timeIn(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, timeStyle: 'short' }).format(date);
}

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO';
  subscriptionEndsAt: Date | null;
  preference: {
    deadlineRemindersEnabled: boolean;
    dailyAgendaEnabled: boolean;
    reminderDaysBefore: number[];
    notificationTime: string;
  };
}

/** Everyone with notification preferences, i.e. everyone. */
async function recipients(): Promise<Recipient[]> {
  const users = await prisma.user.findMany({
    where: { emailPreference: { isNot: null } },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      role: true,
      plan: true,
      subscriptionEndsAt: true,
      emailPreference: {
        select: {
          deadlineRemindersEnabled: true,
          dailyAgendaEnabled: true,
          reminderDaysBefore: true,
          notificationTime: true,
        },
      },
    },
  });

  return users
    .filter(
      (u): u is typeof u & { emailPreference: NonNullable<typeof u.emailPreference> } =>
        u.emailPreference !== null,
    )
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      timezone: u.timezone,
      role: u.role,
      plan: u.plan,
      subscriptionEndsAt: u.subscriptionEndsAt,
      preference: u.emailPreference,
    }));
}

function greetingName(user: { name: string | null; email: string }): string {
  return user.name ?? user.email.split('@')[0] ?? 'there';
}

// ── Deadline reminders ────────────────────────────────────────────────────────

/**
 * Deadlines this user should hear about today.
 *
 * "N days before" is measured in *local calendar days*, not in hours: a
 * deadline at 23:00 tomorrow is "1 day away" regardless of the time now. Zero
 * days is "today", and is a reminder like any other.
 */
async function dueDeadlinesFor(user: Recipient, now: Date) {
  const today = localDateKey(user.timezone, now);
  const daysAhead = [...new Set(user.preference.reminderDaysBefore)].filter(
    (d) => d >= 0 && d <= 60,
  );

  if (daysAhead.length === 0) return [];

  const horizon = new Date(today.getTime() + (Math.max(...daysAhead) + 1) * DAY_MS);

  const deadlines = await prisma.deadline.findMany({
    where: {
      userId: user.id,
      reminderEnabled: true,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueAt: { gte: now, lte: horizon },
    },
    orderBy: { dueAt: 'asc' },
  });

  return deadlines
    .map((deadline) => {
      const dueDay = localDateKey(deadline.timezone || user.timezone, deadline.dueAt);
      const daysUntil = Math.round((dueDay.getTime() - today.getTime()) / DAY_MS);
      return { deadline, daysUntil };
    })
    .filter((d) => daysAhead.includes(d.daysUntil));
}

async function deadlinePass(user: Recipient, now: Date, result: TickResult): Promise<void> {
  const today = localDateKey(user.timezone, now);
  const due = await dueDeadlinesFor(user, now);

  // Grouped by how far away they are, so a user gets one "due tomorrow"
  // email rather than one per deadline.
  const byDays = new Map<number, typeof due>();
  for (const item of due) {
    byDays.set(item.daysUntil, [...(byDays.get(item.daysUntil) ?? []), item]);
  }

  for (const [daysUntil, items] of byDays) {
    const key = `deadlines-${daysUntil}`;
    if (!(await claim(user.id, 'DEADLINE', key, today))) {
      result.skipped += 1;
      continue;
    }

    // The bell gets the same thing the inbox does, so the reminder is there
    // when they open the app even if the mail is still in transit.
    const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
    await notify(user.id, {
      type: 'DEADLINE_DUE',
      title:
        items.length === 1
          ? `Due ${when}: ${items[0]?.deadline.title ?? ''}`
          : `${items.length} deadlines due ${when}`,
      message: items.length === 1 ? null : items.map((i) => i.deadline.title).join(' · '),
      link: '/deadlines',
    });

    await sendMail(
      deadlineReminder(user.email, {
        recipientName: greetingName(user),
        timezone: user.timezone,
        daysUntil,
        deadlines: items.map((i) => ({
          title: i.deadline.title,
          dueAt: i.deadline.dueAt,
          priority: i.deadline.priority,
          description: i.deadline.description,
        })),
      }),
    );
    result.deadlineEmails += 1;
  }
}

// ── Overdue ───────────────────────────────────────────────────────────────────

/**
 * A deadline that has just passed while still open gets one bell, once. No
 * email: an overdue nag by mail is the kind people unsubscribe over.
 *
 * Bounded to the last week so that a first run over an old database does not
 * announce every deadline anyone ever missed.
 */
async function overduePass(now: Date, result: TickResult): Promise<void> {
  const since = new Date(now.getTime() - OVERDUE_LOOKBACK_DAYS * DAY_MS);
  const overdue = await prisma.deadline.findMany({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      reminderEnabled: true,
      dueAt: { lt: now, gte: since },
    },
    select: { id: true, userId: true, title: true, dueAt: true, timezone: true },
  });

  for (const d of overdue) {
    const dueDay = localDateKey(d.timezone || 'UTC', d.dueAt);
    if (!(await claim(d.userId, 'DEADLINE', `overdue:${d.id}`, dueDay))) continue;

    await notify(d.userId, {
      type: 'DEADLINE_DUE',
      title: `Overdue: ${d.title}`,
      message: 'Mark it done, or move the date.',
      link: '/deadlines',
    });
    result.overdueNotices += 1;
  }
}

// ── Things about to start ─────────────────────────────────────────────────────

/**
 * Calendar events, `reminderMinutes` before they start.
 *
 * Runs across everyone at once rather than per user: the question is about
 * the next day of events, not about anyone's slot. Recurring rows are
 * expanded, and the ledger is keyed by occurrence start so a weekly event
 * reminds every week.
 */
async function eventReminderPass(now: Date, result: TickResult): Promise<void> {
  const horizon = new Date(now.getTime() + MAX_EVENT_LEAD_MINUTES * 60_000);

  const rows = await prisma.calendarEvent.findMany({
    where: {
      reminderMinutes: { not: null },
      isAllDay: false,
      OR: [
        { recurrence: 'NONE', startAt: { gte: now, lte: horizon } },
        {
          recurrence: { not: 'NONE' },
          startAt: { lte: horizon },
          OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: now } }],
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      title: true,
      startAt: true,
      endAt: true,
      recurrence: true,
      recurrenceEndAt: true,
      reminderMinutes: true,
      timezone: true,
      meetingGroupId: true,
      meetingRequestId: true,
    },
  });

  for (const event of rows) {
    const lead = (event.reminderMinutes ?? 0) * 60_000;
    for (const occurrence of expandOccurrences(event, now, horizon)) {
      // Fire in the window [start - lead, start): early enough to matter, and
      // never after it has begun.
      if (occurrence.startAt.getTime() - lead > now.getTime()) continue;
      if (occurrence.startAt <= now) continue;

      const key = `${event.id}:${occurrence.startAt.toISOString()}`;
      const day = localDateKey(event.timezone, occurrence.startAt);
      if (!(await claim(event.userId, 'CALENDAR_EVENT', key, day))) continue;

      const meet = event.meetingGroupId !== null || event.meetingRequestId !== null;
      await notify(event.userId, {
        type: 'EVENT_REMINDER',
        title: `${meet ? 'Meet' : 'Starting'} ${inLabel(occurrence.startAt, now)}: ${event.title}`,
        message: `${timeIn(occurrence.startAt, event.timezone)} – ${timeIn(occurrence.endAt, event.timezone)}`,
        link: `/calendar?at=${occurrence.startAt.toISOString()}`,
      });
      result.eventReminders += 1;
    }
  }
}

/** Project meetings, a fixed lead before they are held, to every attendee. */
async function meetingReminderPass(now: Date, result: TickResult): Promise<void> {
  const horizon = new Date(now.getTime() + MEETING_LEAD_MINUTES * 60_000);

  const meetings = await prisma.projectMeeting.findMany({
    where: { heldAt: { gt: now, lte: horizon } },
    select: {
      id: true,
      title: true,
      heldAt: true,
      projectId: true,
      project: { select: { name: true } },
      attendees: { select: { member: { select: { userId: true } } } },
    },
  });

  for (const meeting of meetings) {
    const attendees = meeting.attendees
      .map((a) => a.member.userId)
      .filter((id): id is string => id !== null);
    const day = localDateKey('UTC', meeting.heldAt);

    const fresh: string[] = [];
    for (const userId of attendees) {
      if (await claim(userId, 'MEETING', meeting.id, day)) fresh.push(userId);
    }

    await notifyMany(fresh, {
      type: 'PROJECT_MEETING',
      title: `Meeting ${inLabel(meeting.heldAt, now)}: ${meeting.title}`,
      message: meeting.project.name,
      link: `/projects/${meeting.projectId}/meetings`,
    });
    result.meetingReminders += fresh.length;
  }
}

// ── Daily agenda ──────────────────────────────────────────────────────────────

async function agendaPass(user: Recipient, now: Date, result: TickResult): Promise<void> {
  const today = localDateKey(user.timezone, now);
  if (!(await claim(user.id, 'DAILY_AGENDA', 'agenda', today))) {
    result.skipped += 1;
    return;
  }

  const dayStart = new Date(today.getTime());
  const dayEnd = new Date(today.getTime() + DAY_MS);

  const [eventRows, deadlines, meetings] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        OR: [
          { recurrence: 'NONE', startAt: { lte: dayEnd }, endAt: { gte: dayStart } },
          {
            recurrence: { not: 'NONE' },
            startAt: { lte: dayEnd },
            OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: dayStart } }],
          },
        ],
      },
    }),
    prisma.deadline.findMany({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { dueAt: 'asc' },
    }),
    // Project meetings are on the calendar by reading through, not by being
    // copied into it, so the agenda reads through as well.
    prisma.projectMeeting.findMany({
      where: {
        heldAt: { gte: dayStart, lte: dayEnd },
        attendees: { some: { member: { userId: user.id } } },
      },
      select: { title: true, heldAt: true, location: true, project: { select: { name: true } } },
    }),
  ]);

  // Recurring events still need expanding — the query only narrows.
  const events = [
    ...eventRows.flatMap((row) =>
      expandOccurrences(row, dayStart, dayEnd).map((o) => ({
        title: row.title,
        startAt: o.startAt,
        endAt: o.endAt,
        isAllDay: row.isAllDay,
        location: row.location,
      })),
    ),
    ...meetings.map((m) => ({
      title: `${m.title} (${m.project.name})`,
      startAt: m.heldAt,
      endAt: new Date(m.heldAt.getTime() + PROJECT_MEETING_HOURS * 3_600_000),
      isAllDay: false,
      location: m.location,
    })),
  ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  // Nothing on: no email. An empty agenda is noise, and noise gets muted.
  if (events.length === 0 && deadlines.length === 0) return;

  await sendMail(
    dailyAgenda(user.email, {
      recipientName: greetingName(user),
      timezone: user.timezone,
      date: now,
      events,
      deadlines: deadlines.map((d) => ({
        title: d.title,
        dueAt: d.dueAt,
        priority: d.priority,
      })),
    }),
  );
  result.agendaEmails += 1;
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

/**
 * Told at the user's delivery time, like a deadline — a subscription ending
 * *is* a deadline. Admins are never warned: PRO comes with their account (see
 * `entitled`), and a lifetime grant has no end date to warn about.
 */
async function subscriptionPass(user: Recipient, now: Date, result: TickResult): Promise<void> {
  if (user.role === 'ADMIN' || user.plan !== 'PRO' || user.subscriptionEndsAt === null) return;

  const endsAt = user.subscriptionEndsAt;
  const today = localDateKey(user.timezone, now);
  const endDay = localDateKey(user.timezone, endsAt);
  const daysLeft = Math.round((endDay.getTime() - today.getTime()) / DAY_MS);
  const name = greetingName(user);

  if (SUBSCRIPTION_WARNINGS.includes(daysLeft)) {
    if (!(await claim(user.id, 'SUBSCRIPTION', `ending-${daysLeft}`, endDay))) return;

    await notify(user.id, {
      type: 'SUBSCRIPTION',
      title: `Your PRO plan ends ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}`,
      message: 'Renew to keep every cap lifted.',
      link: '/upgrade',
    });
    await sendMail(
      subscriptionEnding(user.email, { name, endsAt, daysLeft, timezone: user.timezone }),
    );
    result.subscriptionNotices += 1;
    return;
  }

  // The caps come back the moment the date passes (`entitled` checks the
  // instant); the person is told at their next slot rather than at 00:00.
  if (endsAt < now) {
    if (!(await claim(user.id, 'SUBSCRIPTION', 'expired', endDay))) return;

    await notify(user.id, {
      type: 'SUBSCRIPTION',
      title: 'Your PRO plan has ended',
      message: 'Everything is still here; the free limits apply again.',
      link: '/upgrade',
    });
    await sendMail(subscriptionExpired(user.email, { name }));
    result.subscriptionNotices += 1;
  }
}

// ── The tick ──────────────────────────────────────────────────────────────────

export interface TickResult {
  usersChecked: number;
  deadlineEmails: number;
  agendaEmails: number;
  /** Deadline and agenda claims that had already been sent. */
  skipped: number;
  overdueNotices: number;
  eventReminders: number;
  meetingReminders: number;
  subscriptionNotices: number;
}

/**
 * One pass over every user. Safe to run as often as the cron fires.
 *
 * Users are processed sequentially rather than in parallel: this runs in a
 * background worker with no one waiting, and a burst of concurrent SMTP
 * connections is a good way to get a sending domain rate-limited.
 */
export async function runReminderTick(now = new Date()): Promise<TickResult> {
  const result: TickResult = {
    usersChecked: 0,
    deadlineEmails: 0,
    agendaEmails: 0,
    skipped: 0,
    overdueNotices: 0,
    eventReminders: 0,
    meetingReminders: 0,
    subscriptionNotices: 0,
  };

  // The moment-based passes first: they are cheap, global, and the ones a
  // person is actually waiting on when they glance at the bell.
  await eventReminderPass(now, result);
  await meetingReminderPass(now, result);
  await overduePass(now, result);

  const users = await recipients();

  for (const user of users) {
    result.usersChecked += 1;

    if (!slotJustPassed(user.timezone, user.preference.notificationTime, now)) continue;

    if (user.preference.deadlineRemindersEnabled) await deadlinePass(user, now, result);
    if (user.preference.dailyAgendaEnabled) await agendaPass(user, now, result);
    await subscriptionPass(user, now, result);
  }

  await heartbeat(now, result);

  return result;
}

/**
 * Leave a pulse. The admin panel shows when reminders last ran; without this
 * it could only assume they do.
 */
async function heartbeat(now: Date, result: TickResult): Promise<void> {
  try {
    await prisma.workerStatus.upsert({
      where: { key: 'reminders' },
      create: {
        key: 'reminders',
        lastTickAt: now,
        lastResult: result as unknown as Prisma.JsonObject,
      },
      update: { lastTickAt: now, lastResult: result as unknown as Prisma.JsonObject },
    });
  } catch (error) {
    log.error({ err: error }, 'Could not record the worker heartbeat');
  }
}

/**
 * Housekeeping: drop reminder ledger rows and expired sessions.
 *
 * The ledger only has to remember long enough to prevent a duplicate, so 90
 * days is generous. Without this it grows for ever.
 */
export async function runCleanup(): Promise<{ reminders: number; sessions: number }> {
  const cutoff = new Date(Date.now() - 90 * DAY_MS);

  const [reminders, sessions] = await prisma.$transaction([
    prisma.sentReminder.deleteMany({ where: { sentFor: { lt: cutoff } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
  ]);

  log.info({ reminders: reminders.count, sessions: sessions.count }, 'Cleanup complete');

  return { reminders: reminders.count, sessions: sessions.count };
}
