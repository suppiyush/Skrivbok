/**
 * Project meetings: who may write the log, and who may be listed in it.
 *
 * The second question is the one with teeth. An attendee is a member id, and
 * a member id from *another* project is a perfectly valid row as far as the
 * foreign key is concerned — so the service has to check the project itself,
 * and the case is here to make sure it keeps doing so.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, createUser, disconnect, request, resetDatabase, type TestUser } from './helpers.js';

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let projectId: string;
let otherProjectId: string;
let members: { id: string; email: string }[];
let strangerMemberId: string;

beforeAll(async () => {
  await resetDatabase();
  owner = await createUser('owner@example.com');
  editor = await createUser('editor@example.com');
  viewer = await createUser('viewer@example.com');
  outsider = await createUser('outsider@example.com');

  const created = await request(app)
    .post('/api/v1/projects')
    .set('Cookie', owner.cookie)
    .send({
      name: 'Field study',
      members: [
        { email: editor.email, role: 'EDITOR' },
        { email: viewer.email, role: 'VIEWER' },
        { email: 'notyet@example.com', name: 'Not Yet', role: 'VIEWER' },
      ],
    })
    .expect(201);
  projectId = (created.body as { id: string }).id;

  const listed = await request(app)
    .get(`/api/v1/projects/${projectId}/members`)
    .set('Cookie', owner.cookie)
    .expect(200);
  members = (listed.body as { members: { id: string; email: string }[] }).members;

  // A second project the outsider owns, to borrow a member id from.
  const other = await request(app)
    .post('/api/v1/projects')
    .set('Cookie', outsider.cookie)
    .send({ name: 'Unrelated', members: [{ email: 'stranger@example.com' }] })
    .expect(201);
  otherProjectId = (other.body as { id: string }).id;

  const otherMembers = await request(app)
    .get(`/api/v1/projects/${otherProjectId}/members`)
    .set('Cookie', outsider.cookie)
    .expect(200);
  strangerMemberId = (
    otherMembers.body as { members: { id: string; email: string }[] }
  ).members.find((m) => m.email === 'stranger@example.com')!.id;
});

afterAll(disconnect);

const memberId = (email: string) => members.find((m) => m.email === email)!.id;

function log(user: TestUser, body: object) {
  return request(app)
    .post(`/api/v1/projects/${projectId}/meetings`)
    .set('Cookie', user.cookie)
    .send({ title: 'Weekly sync', heldAt: '2026-09-14T10:00:00Z', ...body });
}

describe('who may write the log', () => {
  it('owner and editor may, a viewer may not, an outsider cannot see it', async () => {
    await log(owner, {}).expect(201);
    await log(editor, {}).expect(201);
    await log(viewer, {}).expect(403);
    await log(outsider, {}).expect(404);
  });

  it('everyone on the project can read it', async () => {
    for (const user of [owner, editor, viewer]) {
      await request(app)
        .get(`/api/v1/projects/${projectId}/meetings`)
        .set('Cookie', user.cookie)
        .expect(200);
    }
    await request(app)
      .get(`/api/v1/projects/${projectId}/meetings`)
      .set('Cookie', outsider.cookie)
      .expect(404);
  });
});

describe('who may be listed as there', () => {
  it('any member of the project, signed up or not', async () => {
    const response = await log(owner, {
      attendeeIds: [memberId(editor.email), memberId('notyet@example.com')],
    }).expect(201);

    const body = response.body as { attendees: { email: string; name: string | null }[] };
    expect(body.attendees.map((a) => a.email).sort()).toEqual(
      [editor.email, 'notyet@example.com'].sort(),
    );
    // The invited-by-email member shows the name the inviter typed.
    expect(body.attendees.find((a) => a.email === 'notyet@example.com')?.name).toBe('Not Yet');
  });

  it('but never a member of some other project', async () => {
    const response = await log(owner, { attendeeIds: [strangerMemberId] }).expect(400);
    expect((response.body as { error: { message: string } }).error.message).toMatch(/member/i);
  });

  it('is stored once however many times it was sent', async () => {
    const id = memberId(viewer.email);
    const response = await log(owner, { attendeeIds: [id, id, id] }).expect(201);
    expect((response.body as { attendees: unknown[] }).attendees).toHaveLength(1);
  });
});

describe('editing', () => {
  it('replaces the attendee list whole, and leaves it alone when unmentioned', async () => {
    const created = await log(owner, { attendeeIds: [memberId(editor.email)] }).expect(201);
    const id = (created.body as { id: string }).id;

    // Notes only: attendees untouched.
    const noted = await request(app)
      .patch(`/api/v1/projects/${projectId}/meetings/${id}`)
      .set('Cookie', editor.cookie)
      .send({ notes: 'Agreed the sampling plan.' })
      .expect(200);
    expect((noted.body as { attendees: unknown[] }).attendees).toHaveLength(1);

    // A new list: the old one is gone.
    const relisted = await request(app)
      .patch(`/api/v1/projects/${projectId}/meetings/${id}`)
      .set('Cookie', editor.cookie)
      .send({ attendeeIds: [memberId(viewer.email), memberId(owner.email)] })
      .expect(200);
    const emails = (relisted.body as { attendees: { email: string }[] }).attendees.map(
      (a) => a.email,
    );
    expect(emails.sort()).toEqual([owner.email, viewer.email].sort());
  });

  it('is refused to a viewer and invisible to an outsider', async () => {
    const created = await log(owner, {}).expect(201);
    const id = (created.body as { id: string }).id;

    await request(app)
      .patch(`/api/v1/projects/${projectId}/meetings/${id}`)
      .set('Cookie', viewer.cookie)
      .send({ title: 'Renamed' })
      .expect(403);
    await request(app)
      .delete(`/api/v1/projects/${projectId}/meetings/${id}`)
      .set('Cookie', outsider.cookie)
      .expect(404);
  });

  it('cannot reach a meeting through the wrong project', async () => {
    const created = await log(owner, {}).expect(201);
    const id = (created.body as { id: string }).id;

    // The outsider owns `otherProjectId`, so the role check passes there —
    // the meeting still has to belong to the project in the path.
    await request(app)
      .delete(`/api/v1/projects/${otherProjectId}/meetings/${id}`)
      .set('Cookie', outsider.cookie)
      .expect(404);
  });
});
