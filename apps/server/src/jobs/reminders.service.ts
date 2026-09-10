/**
 * Deadline reminders and the daily agenda.
 *
 * ## Delivering at the right local time
 *
 * Users set a notification time — say 09:00 — and expect mail at 09:00 *where
 * they are*. The worker therefore does not ask "is it 09:00?"; it wakes every
 * few minutes and asks, for each user, "what is the local wall-clock time for
 * this person right now, and has their slot just passed?"
 *
 * The legacy scheduler kept a hardcoded table of fixed UTC offsets per timezone
 * and compared strings against it, which is wrong for half the year in any
 * country with daylight saving.
 *
 * ## Not sending twice
 *
 * Every send is recorded in `SentReminder`, unique on
 * `(userId, itemType, itemId, sentFor)`. The row is written **before** the mail
 * goes out: if the process dies mid-batch the worst case is a reminder that was
 * not delivered, never one delivered twice. Given the choice, a missed reminder
 * is the better failure — a duplicate erodes trust in every future one.
 */
import { toZonedTime } from 'date-fns-tz';
import { prisma } from '../db/prisma.js';
import { createLogger } from '../config/logger.js';
import { expandOccurrences } from '../modules/calendar/recurrence.js';
import { dailyAgenda, deadlineReminder } from '../emails/templates.js';
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

/**
 * Claim the right to send one reminder.
 *
 * Returns false when it has already been sent. The unique constraint does the
 * work, so two workers racing on the same row cannot both win.
 */
async function claim(
  userId: string,
  itemType: 'DEADLINE' | 'DAILY_AGENDA',
  itemId: string,
  sentFor: Date,
): Promise<boolean> {
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

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
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
      preference: u.emailPreference,
    }));
}

// ── Deadline reminders ────────────────────────────────────────────────────────

/**
 * Deadlines this user should hear about today.
 *
 * "N days before" is measured in *local calendar days*, not in hours: a
 * deadline at 23:00 tomorrow is "1 day away" regardless of the time now.
 */
async function dueDeadlinesFor(user: Recipient, now: Date) {
  const today = localDateKey(user.timezone, now);
  const daysAhead = [...new Set(user.preference.reminderDaysBefore)].filter(
    (d) => d >= 0 && d <= 60,
  );

  if (daysAhead.length === 0) return [];

  const horizon = new Date(today.getTime() + (Math.max(...daysAhead) + 1) * 86_400_000);

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
      const daysUntil = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
      return { deadline, daysUntil };
    })
    .filter((d) => daysAhead.includes(d.daysUntil));
}

// ── The tick ──────────────────────────────────────────────────────────────────

export interface TickResult {
  usersChecked: number;
  deadlineEmails: number;
  agendaEmails: number;
  skipped: number;
}

/**
 * One pass over every user. Safe to run as often as the cron fires.
 *
 * Users are processed sequentially rather than in parallel: this runs in a
 * background worker with no one waiting, and a burst of concurrent SMTP
 * connections is a good way to get a sending domain rate-limited.
 */
export async function runReminderTick(now = new Date()): Promise<TickResult> {
  const result: TickResult = { usersChecked: 0, deadlineEmails: 0, agendaEmails: 0, skipped: 0 };
  const users = await recipients();

  for (const user of users) {
    result.usersChecked += 1;

    if (!slotJustPassed(user.timezone, user.preference.notificationTime, now)) continue;

    const today = localDateKey(user.timezone, now);

    // ── Deadlines ──
    if (user.preference.deadlineRemindersEnabled) {
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

        await sendMail(
          deadlineReminder(user.email, {
            recipientName: user.name ?? user.email.split('@')[0] ?? 'there',
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

    // ── Daily agenda ──
    if (user.preference.dailyAgendaEnabled) {
      if (!(await claim(user.id, 'DAILY_AGENDA', 'agenda', today))) {
        result.skipped += 1;
        continue;
      }

      const dayStart = new Date(today.getTime());
      const dayEnd = new Date(today.getTime() + 86_400_000);

      const [eventRows, deadlines] = await Promise.all([
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
      ]);

      // Recurring events still need expanding — the query only narrows.
      const events = eventRows
        .flatMap((row) =>
          expandOccurrences(row, dayStart, dayEnd).map((o) => ({
            title: row.title,
            startAt: o.startAt,
            endAt: o.endAt,
            isAllDay: row.isAllDay,
            location: row.location,
          })),
        )
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

      // Nothing on: no email. An empty agenda is noise, and noise gets muted.
      if (events.length === 0 && deadlines.length === 0) continue;

      await sendMail(
        dailyAgenda(user.email, {
          recipientName: user.name ?? user.email.split('@')[0] ?? 'there',
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
  }

  return result;
}

/**
 * Housekeeping: drop reminder ledger rows and expired sessions.
 *
 * The ledger only has to remember long enough to prevent a duplicate, so 90
 * days is generous. Without this it grows for ever.
 */
export async function runCleanup(): Promise<{ reminders: number; sessions: number }> {
  const cutoff = new Date(Date.now() - 90 * 86_400_000);

  const [reminders, sessions] = await prisma.$transaction([
    prisma.sentReminder.deleteMany({ where: { sentFor: { lt: cutoff } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
  ]);

  log.info({ reminders: reminders.count, sessions: sessions.count }, 'Cleanup complete');

  return { reminders: reminders.count, sessions: sessions.count };
}
