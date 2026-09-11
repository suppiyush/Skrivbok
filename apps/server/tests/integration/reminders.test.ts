/**
 * Deadline reminders, end to end.
 *
 * This file exists to answer a question that code reading cannot settle: is
 * "Email me a reminder" a real switch, or a checkbox that stores a boolean
 * nobody consults? So the tick is run against a real database, with real rows
 * created through the real API, and the only thing faked is the clock.
 *
 * Mail is unconfigured in tests (`setup.ts` blanks `SMTP_HOST`), so nothing is
 * delivered — `sendMail` logs and returns. That does not weaken any of this:
 * every decision about *whether* to send happens before the transport is
 * reached, and `TickResult` counts the sends that were decided on.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { runReminderTick } from '../../src/jobs/reminders.service.js';
import { app, createUser, disconnect, prisma, request, resetDatabase } from './helpers.js';

/** The user's notification slot, and a `now` a few minutes past it. */
const NOTIFICATION_TIME = '09:00';

/**
 * A moment just after the slot, in UTC.
 *
 * The user is put in UTC so wall-clock and instant agree and the test does not
 * quietly depend on the machine's zone. The zone *handling* is covered by the
 * worker's own use of `date-fns-tz`; what is under test here is the switch.
 */
function justAfterSlot(): Date {
  const now = new Date();
  now.setUTCHours(9, 5, 0, 0);
  return now;
}

/** A deadline due tomorrow, which is one of the default reminder days. */
function tomorrow(from: Date): string {
  return new Date(from.getTime() + 86_400_000).toISOString();
}

let user: { id: string; email: string; cookie: string };

beforeEach(async () => {
  await resetDatabase();
  user = await createUser('reminders@example.com');

  await prisma.user.update({ where: { id: user.id }, data: { timezone: 'UTC' } });
  await prisma.emailPreference.update({
    where: { userId: user.id },
    data: {
      deadlineRemindersEnabled: true,
      dailyAgendaEnabled: false,
      reminderDaysBefore: [1],
      notificationTime: NOTIFICATION_TIME,
    },
  });
});

afterAll(disconnect);

/** Create a deadline through the API, exactly as the dialog does. */
async function createDeadline(dueAt: string, reminderEnabled: boolean): Promise<string> {
  const response = await request(app)
    .post('/api/v1/deadlines')
    .set('Cookie', user.cookie)
    .send({ title: 'Submit the paper', dueAt, timezone: 'UTC', reminderEnabled })
    .expect(201);

  return (response.body as { id: string }).id;
}

describe('the reminder checkbox', () => {
  it('is stored as sent, not dropped on the way in', async () => {
    const now = justAfterSlot();
    const id = await createDeadline(tomorrow(now), false);

    const stored = await prisma.deadline.findUniqueOrThrow({ where: { id } });
    expect(stored.reminderEnabled).toBe(false);
  });

  it('sends for a deadline that asked for one', async () => {
    const now = justAfterSlot();
    await createDeadline(tomorrow(now), true);

    const result = await runReminderTick(now);
    expect(result.deadlineEmails).toBe(1);
  });

  it('sends nothing for a deadline that did not', async () => {
    const now = justAfterSlot();
    await createDeadline(tomorrow(now), false);

    const result = await runReminderTick(now);
    expect(result.deadlineEmails).toBe(0);
  });

  it('is honoured per deadline, not per user', async () => {
    const now = justAfterSlot();
    await createDeadline(tomorrow(now), true);
    await createDeadline(tomorrow(now), false);

    // One mail, grouped by how far away they are — and the opted-out deadline
    // is simply not in it.
    const result = await runReminderTick(now);
    expect(result.deadlineEmails).toBe(1);
  });

  it('can be turned off after the fact', async () => {
    const now = justAfterSlot();
    const id = await createDeadline(tomorrow(now), true);

    await request(app)
      .patch(`/api/v1/deadlines/${id}`)
      .set('Cookie', user.cookie)
      .send({ reminderEnabled: false })
      .expect(200);

    const result = await runReminderTick(now);
    expect(result.deadlineEmails).toBe(0);
  });
});

describe('the rest of the gate', () => {
  it('stays quiet outside the notification slot', async () => {
    const now = justAfterSlot();
    await createDeadline(tomorrow(now), true);

    const wrongHour = new Date(now);
    wrongHour.setUTCHours(15, 5, 0, 0);

    const result = await runReminderTick(wrongHour);
    expect(result.usersChecked).toBe(1);
    expect(result.deadlineEmails).toBe(0);
  });

  it('respects the account-wide switch as well as the per-deadline one', async () => {
    const now = justAfterSlot();
    await createDeadline(tomorrow(now), true);

    await prisma.emailPreference.update({
      where: { userId: user.id },
      data: { deadlineRemindersEnabled: false },
    });

    const result = await runReminderTick(now);
    expect(result.deadlineEmails).toBe(0);
  });

  it('does not send the same reminder twice', async () => {
    const now = justAfterSlot();
    await createDeadline(tomorrow(now), true);

    const first = await runReminderTick(now);
    const second = await runReminderTick(now);

    expect(first.deadlineEmails).toBe(1);
    expect(second.deadlineEmails).toBe(0);
    expect(second.skipped).toBe(1);
  });

  it('leaves a completed deadline alone', async () => {
    const now = justAfterSlot();
    const id = await createDeadline(tomorrow(now), true);

    await request(app)
      .patch(`/api/v1/deadlines/${id}`)
      .set('Cookie', user.cookie)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const result = await runReminderTick(now);
    expect(result.deadlineEmails).toBe(0);
  });
});
