/**
 * A meet with several teammates: who may be asked, whose calendar it lands
 * on and when, and what cancelling it takes with it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  app,
  createUser,
  disconnect,
  prisma,
  request,
  resetDatabase,
  type TestUser,
} from './helpers.js';

let host: TestUser;
let alice: TestUser;
let bob: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  await resetDatabase();
  host = await createUser('host@example.com');
  alice = await createUser('alice@example.com');
  bob = await createUser('bob@example.com');
  stranger = await createUser('stranger@example.com');

  // Alice and Bob share a project with the host; the stranger shares nothing.
  await request(app)
    .post('/api/v1/projects')
    .set('Cookie', host.cookie)
    .send({
      name: 'Shared',
      members: [
        { email: alice.email, role: 'EDITOR' },
        { email: bob.email, role: 'VIEWER' },
      ],
    })
    .expect(201);
});

afterAll(disconnect);

const meet = (user: TestUser, body: object) =>
  request(app)
    .post('/api/v1/calendar/meeting-requests/group')
    .set('Cookie', user.cookie)
    .send({
      title: 'Planning',
      date: '2027-05-10',
      startTime: '10:00',
      endTime: '11:00',
      timezone: 'Europe/Stockholm',
      ...body,
    });

const eventsOf = (userId: string) =>
  prisma.calendarEvent.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

describe('contacts', () => {
  it('are the people who share a project, once each, and never the caller', async () => {
    const response = await request(app)
      .get('/api/v1/calendar/meeting-requests/contacts')
      .set('Cookie', host.cookie)
      .expect(200);

    const contacts = (response.body as { contacts: { email: string; projects: string[] }[] })
      .contacts;
    expect(contacts.map((c) => c.email).sort()).toEqual([alice.email, bob.email]);
    expect(contacts[0]?.projects).toEqual(['Shared']);
  });
});

describe('asking', () => {
  it('refuses anyone who is not a teammate', async () => {
    await meet(host, { attendeeIds: [stranger.id] }).expect(400);
  });

  it('refuses a meet with only yourself in it', async () => {
    await meet(host, { attendeeIds: [host.id] }).expect(400);
  });

  it('turns the wall-clock time in the zone into the right instant', async () => {
    const response = await meet(host, { attendeeIds: [alice.id] }).expect(201);
    const { eventId } = response.body as { eventId: string };

    const event = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: eventId } });
    // 10:00 in Stockholm on 10 May is CEST, UTC+2.
    expect(event.startAt.toISOString()).toBe('2027-05-10T08:00:00.000Z');
    expect(event.endAt.toISOString()).toBe('2027-05-10T09:00:00.000Z');
    expect(event.timezone).toBe('Europe/Stockholm');
  });

  it('puts it on the host’s calendar at once, and only asks the others', async () => {
    const before = (await eventsOf(alice.id)).length;
    const response = await meet(host, { attendeeIds: [alice.id, bob.id] }).expect(201);
    const { groupId, requestIds } = response.body as { groupId: string; requestIds: string[] };

    expect(requestIds).toHaveLength(2);

    const hostEvents = await prisma.calendarEvent.findMany({ where: { meetingGroupId: groupId } });
    expect(hostEvents).toHaveLength(1);
    expect(hostEvents[0]?.userId).toBe(host.id);
    expect(hostEvents[0]?.attendees.sort()).toEqual([alice.email, bob.email].sort());

    expect((await eventsOf(alice.id)).length).toBe(before);

    // Told in the app.
    const notes = await prisma.notification.findMany({
      where: { userId: bob.id, type: 'MEETING_REQUEST' },
    });
    expect(notes.length).toBeGreaterThan(0);
  });
});

describe('answering', () => {
  it('accepting adds it to that person’s calendar alone', async () => {
    const created = await meet(host, { attendeeIds: [alice.id, bob.id] }).expect(201);
    const { groupId, requestIds } = created.body as { groupId: string; requestIds: string[] };

    const aliceRequest = await prisma.meetingRequest.findFirstOrThrow({
      where: { id: { in: requestIds }, receiverId: alice.id },
    });

    await request(app)
      .post(`/api/v1/calendar/meeting-requests/${aliceRequest.id}/accept`)
      .set('Cookie', alice.cookie)
      .expect(200);

    const groupEvents = await prisma.calendarEvent.findMany({ where: { meetingGroupId: groupId } });
    expect(groupEvents.map((e) => e.userId).sort()).toEqual([alice.id, host.id].sort());
    // Not a second copy for the host, as a pair request would have made.
    expect(groupEvents.filter((e) => e.userId === host.id)).toHaveLength(1);
  });
});

describe('cancelling', () => {
  it('is the host’s to do, and clears every calendar it reached', async () => {
    const created = await meet(host, { attendeeIds: [alice.id, bob.id] }).expect(201);
    const { groupId, requestIds } = created.body as { groupId: string; requestIds: string[] };

    const aliceRequest = await prisma.meetingRequest.findFirstOrThrow({
      where: { id: { in: requestIds }, receiverId: alice.id },
    });
    await request(app)
      .post(`/api/v1/calendar/meeting-requests/${aliceRequest.id}/accept`)
      .set('Cookie', alice.cookie)
      .expect(200);

    await request(app)
      .post(`/api/v1/calendar/meeting-requests/group/${groupId}/cancel`)
      .set('Cookie', alice.cookie)
      .expect(403);

    await request(app)
      .post(`/api/v1/calendar/meeting-requests/group/${groupId}/cancel`)
      .set('Cookie', host.cookie)
      .expect(204);

    expect(await prisma.calendarEvent.count({ where: { meetingGroupId: groupId } })).toBe(0);
    const statuses = await prisma.meetingRequest.findMany({
      where: { groupId },
      select: { status: true },
    });
    expect(statuses.every((s) => s.status === 'CANCELLED')).toBe(true);
  });
});
