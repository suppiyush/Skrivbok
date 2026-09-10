/**
 * Project roles and the calendar visibility model.
 *
 * The two places where authorization is more than "is it yours".
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, disconnect, registerUser, request, resetDatabase, type TestUser } from './helpers.js';

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let projectId: string;

beforeAll(async () => {
  await resetDatabase();
  owner = await registerUser('owner@example.com');
  editor = await registerUser('editor@example.com');
  viewer = await registerUser('viewer@example.com');
  outsider = await registerUser('outsider@example.com');

  const response = await request(app)
    .post('/api/v1/projects')
    .set('Cookie', owner.cookie)
    .send({
      name: 'Verified Consensus',
      members: [
        { email: editor.email, role: 'EDITOR' },
        { email: viewer.email, role: 'VIEWER' },
        { email: 'notyet@example.com', role: 'EDITOR' },
      ],
    })
    .expect(201);

  projectId = (response.body as { id: string }).id;
});

afterAll(disconnect);

describe('role matrix', () => {
  const read = (user: TestUser) =>
    request(app).get(`/api/v1/projects/${projectId}`).set('Cookie', user.cookie);
  const edit = (user: TestUser) =>
    request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('Cookie', user.cookie)
      .send({ progress: 50 });
  const invite = (user: TestUser) =>
    request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', user.cookie)
      .send({ email: 'someone-new@example.com', role: 'VIEWER' });

  it('lets everyone on the project read it, and nobody else', async () => {
    await read(owner).expect(200);
    await read(editor).expect(200);
    await read(viewer).expect(200);
    // 404 rather than 403 — an outsider must not learn the project exists.
    await read(outsider).expect(404);
  });

  it('lets owner and editor change it, but not a viewer', async () => {
    await edit(owner).expect(200);
    await edit(editor).expect(200);
    await edit(viewer).expect(403);
    await edit(outsider).expect(404);
  });

  it('lets only the owner manage members', async () => {
    await invite(editor).expect(403);
    await invite(viewer).expect(403);
    await invite(outsider).expect(404);
    await invite(owner).expect(201);
  });
});

describe('membership', () => {
  it('creates an owner row so the project is visible to its creator', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const members = (response.body as { members: { email: string; role: string }[] }).members;
    expect(members.find((m) => m.email === owner.email)?.role).toBe('OWNER');
  });

  it('holds an invite for someone with no account, and links it on registration', async () => {
    const before = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const pending = (before.body as { members: { email: string; user: unknown }[] }).members.find(
      (m) => m.email === 'notyet@example.com',
    );
    expect(pending?.user).toBeNull();

    const claimed = await registerUser('notyet@example.com');

    const projects = await request(app)
      .get('/api/v1/projects')
      .set('Cookie', claimed.cookie)
      .expect(200);

    const body = projects.body as { data: { id: string; myRole: string }[] };
    expect(body.data.find((p) => p.id === projectId)?.myRole).toBe('EDITOR');
  });

  it('refuses to remove the owner row', async () => {
    const members = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const ownerRow = (members.body as { members: { id: string; role: string }[] }).members.find(
      (m) => m.role === 'OWNER',
    );

    await request(app)
      .delete(`/api/v1/projects/${projectId}/members/${ownerRow?.id}`)
      .set('Cookie', owner.cookie)
      .expect(400);
  });

  it('lets a member remove themselves without asking the owner', async () => {
    const members = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const viewerRow = (members.body as { members: { id: string; email: string }[] }).members.find(
      (m) => m.email === viewer.email,
    );

    await request(app)
      .delete(`/api/v1/projects/${projectId}/members/${viewerRow?.id}`)
      .set('Cookie', viewer.cookie)
      .expect(204);

    await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Cookie', viewer.cookie)
      .expect(404);
  });
});

describe('free-tier limits', () => {
  it('stops at five owned projects and reports the quota', async () => {
    const user = await registerUser('quota@example.com');

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/projects')
        .set('Cookie', user.cookie)
        .send({ name: `Project ${i}` })
        .expect(201);
    }

    await request(app)
      .post('/api/v1/projects')
      .set('Cookie', user.cookie)
      .send({ name: 'One too many' })
      .expect(403)
      .expect((r) =>
        expect((r.body as { error: { code: string } }).error.code).toBe('FREE_LIMIT_REACHED'),
      );

    await request(app)
      .get('/api/v1/projects/quota')
      .set('Cookie', user.cookie)
      .expect(200)
      .expect((r) => expect(r.body).toMatchObject({ limited: true, used: 5, remaining: 0 }));
  });

  it('does not count projects someone else invited you to', async () => {
    const guest = await registerUser('guest@example.com');

    await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: guest.email, role: 'VIEWER' })
      .expect(201);

    await request(app)
      .get('/api/v1/projects/quota')
      .set('Cookie', guest.cookie)
      .expect(200)
      .expect((r) => expect((r.body as { used: number }).used).toBe(0));
  });
});
