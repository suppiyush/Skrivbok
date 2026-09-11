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

/* ── The passes added with the notification work ─────────────────────────── */

/** The bell for the test user, filtered by type, newest first. */
async function bell(type: string) {
  return prisma.notification.findMany({
    where: { userId: user.id, type: type as never },
    orderBy: { createdAt: 'desc' },
    select: { title: true, message: true, link: true },
  });
}

describe('the bell gets what the inbox gets', () => {
  it('writes an in-app reminder alongside the deadline email', async () => {
    const now = justAfterSlot();
    await createDeadline(tomorrow(now), true);

    await runReminderTick(now);

    const [latest] = await bell('DEADLINE_DUE');
    expect(latest?.title).toBe('Due tomorrow: Submit the paper');
    expect(latest?.link).toBe('/deadlines');
  });

  it('reminds on the day itself when asked to', async () => {
    const now = justAfterSlot();
    await prisma.emailPreference.update({
      where: { userId: user.id },
      data: { reminderDaysBefore: [0] },
    });
    // Due later today.
    await createDeadline(new Date(now.getTime() + 3 * 3_600_000).toISOString(), true);

    const result = await runReminderTick(now);
    expect(result.deadlineEmails).toBe(1);
    expect((await bell('DEADLINE_DUE'))[0]?.title).toBe('Due today: Submit the paper');
  });

  it('says once, in the bell only, when a deadline has slipped past', async () => {
    const now = justAfterSlot();
    // An hour ago, still open.
    await createDeadline(new Date(now.getTime() - 3_600_000).toISOString(), true);

    const first = await runReminderTick(now);
    const second = await runReminderTick(now);
    expect(first.overdueNotices).toBe(1);
    expect(second.overdueNotices).toBe(0);
    expect(first.deadlineEmails).toBe(0);
    expect((await bell('DEADLINE_DUE'))[0]?.title).toBe('Overdue: Submit the paper');
  });
});

describe('things about to start', () => {
  /** Any moment: these passes do not care about the delivery slot. */
  const anyTime = () => {
    const now = new Date();
    now.setUTCHours(14, 37, 0, 0);
    return now;
  };

  async function createEvent(startInMinutes: number, reminderMinutes: number | null) {
    const now = anyTime();
    const startAt = new Date(now.getTime() + startInMinutes * 60_000);
    await request(app)
      .post('/api/v1/calendar/events')
      .set('Cookie', user.cookie)
      .send({
        title: 'Lab meeting',
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + 3_600_000).toISOString(),
        timezone: 'UTC',
        reminderMinutes,
      })
      .expect(201);
    return now;
  }

  it('reminds the chosen number of minutes before an event, once', async () => {
    const now = await createEvent(10, 15);

    const first = await runReminderTick(now);
    const second = await runReminderTick(now);
    expect(first.eventReminders).toBe(1);
    expect(second.eventReminders).toBe(0);

    const [latest] = await bell('EVENT_REMINDER');
    expect(latest?.title).toBe('Starting in 10 min: Lab meeting');
    expect(latest?.link).toMatch(/^\/calendar\?at=/);
  });

  it('waits when the event is further off than its lead', async () => {
    const now = await createEvent(40, 15);
    expect((await runReminderTick(now)).eventReminders).toBe(0);
    // …and fires once the window is reached.
    expect((await runReminderTick(new Date(now.getTime() + 30 * 60_000))).eventReminders).toBe(1);
  });

  it('leaves an event with no reminder alone', async () => {
    const now = await createEvent(5, null);
    expect((await runReminderTick(now)).eventReminders).toBe(0);
  });

  it('nudges every attendee of a project meeting a quarter of an hour ahead', async () => {
    const colleague = await createUser('colleague@example.com');
    const project = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', user.cookie)
      .send({ name: 'Survey', members: [{ email: colleague.email, role: 'EDITOR' }] })
      .expect(201);
    const projectId = (project.body as { id: string }).id;
    const listed = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', user.cookie)
      .expect(200);
    const memberIds = (listed.body as { members: { id: string }[] }).members.map((m) => m.id);

    const now = anyTime();
    await request(app)
      .post(`/api/v1/projects/${projectId}/meetings`)
      .set('Cookie', user.cookie)
      .send({
        title: 'Sync',
        heldAt: new Date(now.getTime() + 12 * 60_000).toISOString(),
        attendeeIds: memberIds,
      })
      .expect(201);

    const first = await runReminderTick(now);
    const second = await runReminderTick(now);
    // Both attendees, the owner included — this is a reminder, not an invite.
    expect(first.meetingReminders).toBe(2);
    expect(second.meetingReminders).toBe(0);

    const theirs = await prisma.notification.findFirst({
      where: { userId: colleague.id, type: 'PROJECT_MEETING', title: { startsWith: 'Meeting in' } },
    });
    expect(theirs?.title).toBe('Meeting in 12 min: Sync');
    expect(theirs?.link).toBe(`/projects/${projectId}/meetings`);
  });
});

describe('the agenda', () => {
  it('lists a project meeting held today, even with nothing else on', async () => {
    const now = justAfterSlot();
    await prisma.emailPreference.update({
      where: { userId: user.id },
      data: { dailyAgendaEnabled: true, deadlineRemindersEnabled: false },
    });

    const project = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', user.cookie)
      .send({ name: 'Survey' })
      .expect(201);
    const projectId = (project.body as { id: string }).id;
    const listed = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', user.cookie)
      .expect(200);
    const [me] = (listed.body as { members: { id: string }[] }).members;

    await request(app)
      .post(`/api/v1/projects/${projectId}/meetings`)
      .set('Cookie', user.cookie)
      .send({
        title: 'Sync',
        heldAt: new Date(now.getTime() + 5 * 3_600_000).toISOString(),
        attendeeIds: [me?.id],
      })
      .expect(201);

    expect((await runReminderTick(now)).agendaEmails).toBe(1);
  });
});

describe('a subscription running out', () => {
  const pro = (endsInDays: number) =>
    prisma.user.update({
      where: { id: user.id },
      data: {
        plan: 'PRO',
        subscriptionEndsAt: new Date(justAfterSlot().getTime() + endsInDays * 86_400_000),
      },
    });

  it('is announced a week out and the day before, at the delivery time, once each', async () => {
    await pro(7);
    const now = justAfterSlot();
    expect((await runReminderTick(now)).subscriptionNotices).toBe(1);
    expect((await runReminderTick(now)).subscriptionNotices).toBe(0);
    expect((await bell('SUBSCRIPTION'))[0]?.title).toBe('Your PRO plan ends in 7 days');

    await pro(1);
    expect((await runReminderTick(now)).subscriptionNotices).toBe(1);
    expect((await bell('SUBSCRIPTION'))[0]?.title).toBe('Your PRO plan ends tomorrow');
  });

  it('is announced once it has ended', async () => {
    await pro(-1);
    const now = justAfterSlot();
    expect((await runReminderTick(now)).subscriptionNotices).toBe(1);
    expect((await runReminderTick(now)).subscriptionNotices).toBe(0);
    expect((await bell('SUBSCRIPTION'))[0]?.title).toBe('Your PRO plan has ended');
  });

  it('never warns an admin, whose PRO has no end', async () => {
    await pro(1);
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    expect((await runReminderTick(justAfterSlot())).subscriptionNotices).toBe(0);
  });

  it('is quiet outside the delivery slot', async () => {
    await pro(7);
    const wrongHour = justAfterSlot();
    wrongHour.setUTCHours(15);
    expect((await runReminderTick(wrongHour)).subscriptionNotices).toBe(0);
  });
});

describe('the pulse', () => {
  it('is left after every pass', async () => {
    const now = justAfterSlot();
    await runReminderTick(now);
    const status = await prisma.workerStatus.findUnique({ where: { key: 'reminders' } });
    expect(status?.lastTickAt.toISOString()).toBe(now.toISOString());
    expect(status?.lastResult).toMatchObject({ usersChecked: 1 });
  });
});
