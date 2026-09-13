/**
 * Seeing a teammate's calendar.
 *
 * The flow — ask, be refused until they agree, see it, lose it when access
 * ends — and, above all, what is visible once in: an event that involves the
 * viewer in full, and everything else, a private event included, only as a
 * busy block with no title, place or description.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, createUser, disconnect, request, resetDatabase, type TestUser } from './helpers.js';

interface Shared {
  id: string;
  startAt: string;
  redacted: boolean;
  involvesViewer: boolean;
  title?: string;
  location?: string | null;
}

let alice: TestUser;
let bob: TestUser;
let carol: TestUser;

const WINDOW = 'from=2026-10-01T00:00:00Z&to=2026-10-31T00:00:00Z';

beforeAll(async () => {
  await resetDatabase();
  alice = await createUser('alice@example.com');
  bob = await createUser('bob@example.com');
  carol = await createUser('carol@example.com');

  const event = (body: object) =>
    request(app)
      .post('/api/v1/calendar/events')
      .set('Cookie', alice.cookie)
      .send({ timezone: 'UTC', ...body })
      .expect(201);

  // Private by default.
  await event({
    title: 'Dentist',
    location: 'Clinic',
    startAt: '2026-10-05T09:00:00Z',
    endAt: '2026-10-05T10:00:00Z',
  });
  await event({
    title: 'Paper review with Bob',
    startAt: '2026-10-06T09:00:00Z',
    endAt: '2026-10-06T10:00:00Z',
    attendees: [bob.email],
  });
  await event({
    title: 'Department seminar',
    startAt: '2026-10-07T09:00:00Z',
    endAt: '2026-10-07T10:00:00Z',
    visibility: 'PUBLIC',
  });

  // A project with Bob in it, and two meetings in its log — one he attends.
  const project = await request(app)
    .post('/api/v1/projects')
    .set('Cookie', alice.cookie)
    .send({ name: 'Survey', members: [{ email: bob.email, role: 'VIEWER' }] })
    .expect(201);
  const projectId = (project.body as { id: string }).id;

  const listed = await request(app)
    .get(`/api/v1/projects/${projectId}/members`)
    .set('Cookie', alice.cookie)
    .expect(200);
  const members = (listed.body as { members: { id: string; email: string }[] }).members;
  const memberId = (email: string) => members.find((m) => m.email === email)!.id;

  const meeting = (title: string, heldAt: string, attendeeIds: string[]) =>
    request(app)
      .post(`/api/v1/projects/${projectId}/meetings`)
      .set('Cookie', alice.cookie)
      .send({ title, heldAt, attendeeIds })
      .expect(201);

  await meeting('Supervision', '2026-10-08T09:00:00Z', [
    memberId(alice.email),
    memberId(bob.email),
  ]);
  await meeting('Budget review', '2026-10-09T09:00:00Z', [memberId(alice.email)]);
});

afterAll(disconnect);

const shared = (viewer: TestUser) =>
  request(app).get(`/api/v1/calendar/shared/${alice.email}?${WINDOW}`).set('Cookie', viewer.cookie);

const at = (events: Shared[], iso: string) => events.find((e) => e.startAt === iso);

describe('asking for access', () => {
  it('is refused until the owner agrees', async () => {
    await shared(bob).expect(403);

    const asked = await request(app)
      .post('/api/v1/calendar/access/requests')
      .set('Cookie', bob.cookie)
      .send({ targetEmail: alice.email, message: 'For our meetings' })
      .expect(201);

    await shared(bob).expect(403);

    await request(app)
      .post(`/api/v1/calendar/access/requests/${(asked.body as { id: string }).id}/approve`)
      .set('Cookie', alice.cookie)
      .send({})
      .expect(200);

    await shared(bob).expect(200);
  });

  it('is still refused to anyone who was not given it', async () => {
    await shared(carol).expect(403);
  });
});

describe('what the teammate sees', () => {
  let events: Shared[];

  beforeAll(async () => {
    events = ((await shared(bob).expect(200)).body as { events: Shared[] }).events;
  });

  it('shows an event that does not involve them only as busy, a private one included', () => {
    const dentist = at(events, '2026-10-05T09:00:00.000Z');
    expect(dentist).toMatchObject({ redacted: true, involvesViewer: false });
    expect(dentist).not.toHaveProperty('title');
    expect(dentist).not.toHaveProperty('location');
  });

  it('shows an event they are an attendee of in full', () => {
    expect(at(events, '2026-10-06T09:00:00.000Z')).toMatchObject({
      redacted: false,
      involvesViewer: true,
      title: 'Paper review with Bob',
    });
  });

  it('treats project meetings the same way: in full if they attend, busy if not', () => {
    expect(at(events, '2026-10-08T09:00:00.000Z')).toMatchObject({
      redacted: false,
      title: 'Supervision',
    });
    const budget = at(events, '2026-10-09T09:00:00.000Z');
    expect(budget).toMatchObject({ redacted: true });
    expect(budget).not.toHaveProperty('title');
  });

  it('keeps a public event busy until the owner allows details', async () => {
    expect(at(events, '2026-10-07T09:00:00.000Z')).toMatchObject({ redacted: true });

    const granted = await request(app)
      .get('/api/v1/calendar/access/granted')
      .set('Cookie', alice.cookie)
      .expect(200);
    const grantId = (granted.body as { grants: { id: string }[] }).grants[0]!.id;

    await request(app)
      .patch(`/api/v1/calendar/access/${grantId}`)
      .set('Cookie', alice.cookie)
      .send({ level: 'VIEW' })
      .expect(200);

    const after = ((await shared(bob).expect(200)).body as { events: Shared[] }).events;
    expect(at(after, '2026-10-07T09:00:00.000Z')).toMatchObject({
      redacted: false,
      title: 'Department seminar',
    });
    // Details for public events only: the private one is still just busy.
    expect(at(after, '2026-10-05T09:00:00.000Z')).toMatchObject({ redacted: true });
  });
});

describe('ending access', () => {
  it('stops it at once when the viewer lets go', async () => {
    const held = await request(app)
      .get('/api/v1/calendar/access/held')
      .set('Cookie', bob.cookie)
      .expect(200);
    const grantId = (held.body as { grants: { id: string }[] }).grants[0]!.id;

    await request(app)
      .delete(`/api/v1/calendar/access/${grantId}`)
      .set('Cookie', bob.cookie)
      .expect(204);

    await shared(bob).expect(403);
  });
});
