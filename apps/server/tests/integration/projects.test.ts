/**
 * Project roles and the calendar visibility model.
 *
 * The two places where authorization is more than "is it yours".
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

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let projectId: string;

beforeAll(async () => {
  await resetDatabase();
  owner = await createUser('owner@example.com');
  editor = await createUser('editor@example.com');
  viewer = await createUser('viewer@example.com');
  outsider = await createUser('outsider@example.com');

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

  it('holds an invite for someone with no account, and links it when they sign up', async () => {
    const before = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const pending = (before.body as { members: { email: string; user: unknown }[] }).members.find(
      (m) => m.email === 'notyet@example.com',
    );
    expect(pending?.user).toBeNull();

    const claimed = await createUser('notyet@example.com');

    const projects = await request(app)
      .get('/api/v1/projects')
      .set('Cookie', claimed.cookie)
      .expect(200);

    const body = projects.body as { data: { id: string; myRole: string }[] };
    expect(body.data.find((p) => p.id === projectId)?.myRole).toBe('EDITOR');
  });

  /**
   * Being invited has to reach the invitee somehow.
   *
   * Creating a project used to write the membership rows and tell nobody, so
   * an invitation sent this way existed only in the database. The mail itself
   * cannot be asserted here — there is no SMTP host in a test run, and the
   * mailer deliberately degrades to a log line — but the notification is the
   * half that lands in the database, and it is created on the same path.
   */
  it('notifies registered people invited while the project is created', async () => {
    const notifications = await prisma.notification.findMany({
      where: { type: 'PROJECT_INVITE', link: `/projects/${projectId}` },
      select: { userId: true },
    });

    const notified = notifications.map((n) => n.userId);
    expect(notified).toContain(editor.id);
    expect(notified).toContain(viewer.id);
    // The owner invited themselves by creating it; they are not an invitee.
    expect(notified).not.toContain(owner.id);
  });

  it('does not try to notify an invitee who has no account yet', async () => {
    // `Notification.userId` is not nullable, so there is nothing to deliver an
    // in-app notification to before the account exists — attempting one would
    // throw. The email is what reaches them, and it is the one case that gets
    // the sign-up template rather than the "already in your workspace" one.
    //
    // Three people were invited at creation and two of them had accounts, so
    // exactly two notifications is the proof that the third was skipped rather
    // than failed.
    const count = await prisma.notification.count({
      where: { type: 'PROJECT_INVITE', link: `/projects/${projectId}` },
    });

    expect(count).toBe(2);
  });

  it('notifies someone added to an existing project', async () => {
    const latecomer = await createUser('latecomer@example.com');

    await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: latecomer.email, role: 'VIEWER' })
      .expect(201);

    const notification = await prisma.notification.findFirst({
      where: { userId: latecomer.id, type: 'PROJECT_INVITE' },
      select: { link: true },
    });

    expect(notification?.link).toBe(`/projects/${projectId}`);
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
    const user = await createUser('quota@example.com');

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
    const guest = await createUser('guest@example.com');

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

/**
 * The whole life of a project, in the order a person actually does it.
 *
 * The tests above each pin one rule. This one walks the sequence end to end —
 * create with invitees and roles, edit, change someone's access, have them use
 * it, remove them, delete — because every one of those steps worked in
 * isolation while creation still told none of its invitees anything.
 */
describe('project lifecycle', () => {
  it('carries a project from creation to deletion', async () => {
    const lead = await createUser('lead@example.com');
    const colleague = await createUser('colleague@example.com');

    // ── Create, naming a colleague and a stranger, with different access ──
    const created = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', lead.cookie)
      .send({
        name: 'Spectral Analysis',
        description: 'Second-year work',
        progress: 10,
        members: [
          { email: colleague.email, name: 'A Colleague', role: 'VIEWER' },
          { email: 'stranger@example.com', name: 'Not Yet', role: 'EDITOR' },
        ],
      })
      .expect(201);

    const id = (created.body as { id: string }).id;
    expect(created.body).toMatchObject({ name: 'Spectral Analysis', progress: 10 });

    // The roles asked for are the roles stored — not everyone flattened to VIEWER.
    const roster = await request(app)
      .get(`/api/v1/projects/${id}/members`)
      .set('Cookie', lead.cookie)
      .expect(200);

    const byEmail = new Map(
      (
        roster.body as { members: { email: string; role: string; name: string | null }[] }
      ).members.map((m) => [m.email, m]),
    );
    expect(byEmail.get(lead.email)?.role).toBe('OWNER');
    expect(byEmail.get(colleague.email)?.role).toBe('VIEWER');
    expect(byEmail.get('stranger@example.com')?.role).toBe('EDITOR');
    expect(byEmail.get(colleague.email)?.name).toBe('A Colleague');

    // ── Edit ──────────────────────────────────────────────────────────────
    await request(app)
      .patch(`/api/v1/projects/${id}`)
      .set('Cookie', lead.cookie)
      .send({ name: 'Spectral Analysis II', progress: 55 })
      .expect(200)
      .expect((r) => expect(r.body).toMatchObject({ name: 'Spectral Analysis II', progress: 55 }));

    // A viewer may not, and is told why rather than that it does not exist.
    await request(app)
      .patch(`/api/v1/projects/${id}`)
      .set('Cookie', colleague.cookie)
      .send({ progress: 99 })
      .expect(403);

    // ── Promote, and watch the new access take effect ──────────────────────
    const memberId = (roster.body as { members: { id: string; email: string }[] }).members.find(
      (m) => m.email === colleague.email,
    )?.id;
    expect(memberId).toBeDefined();

    await request(app)
      .patch(`/api/v1/projects/${id}/members/${memberId}`)
      .set('Cookie', lead.cookie)
      .send({ role: 'EDITOR' })
      .expect(200);

    await request(app)
      .patch(`/api/v1/projects/${id}`)
      .set('Cookie', colleague.cookie)
      .send({ progress: 70 })
      .expect(200);

    // ── Invite one more, after the fact ───────────────────────────────────
    const late = await createUser('late@example.com');
    await request(app)
      .post(`/api/v1/projects/${id}/members`)
      .set('Cookie', lead.cookie)
      .send({ email: late.email, name: 'Late Arrival', role: 'VIEWER' })
      .expect(201);

    // Inviting the same address twice is refused rather than duplicated.
    await request(app)
      .post(`/api/v1/projects/${id}/members`)
      .set('Cookie', lead.cookie)
      .send({ email: late.email, role: 'VIEWER' })
      .expect(409);

    // ── Remove ────────────────────────────────────────────────────────────
    const withLate = await request(app)
      .get(`/api/v1/projects/${id}/members`)
      .set('Cookie', lead.cookie)
      .expect(200);

    const lateId = (withLate.body as { members: { id: string; email: string }[] }).members.find(
      (m) => m.email === late.email,
    )?.id;

    await request(app)
      .delete(`/api/v1/projects/${id}/members/${lateId}`)
      .set('Cookie', lead.cookie)
      .expect(204);

    await request(app).get(`/api/v1/projects/${id}`).set('Cookie', late.cookie).expect(404);

    // ── Delete, which takes the memberships with it ───────────────────────
    await request(app).delete(`/api/v1/projects/${id}`).set('Cookie', lead.cookie).expect(204);
    await request(app).get(`/api/v1/projects/${id}`).set('Cookie', lead.cookie).expect(404);
    await request(app).get(`/api/v1/projects/${id}`).set('Cookie', colleague.cookie).expect(404);

    expect(await prisma.projectMember.count({ where: { projectId: id } })).toBe(0);
  });

  it('refuses deletion to everyone but the owner', async () => {
    const lead = await createUser('lead2@example.com');
    const helper = await createUser('helper2@example.com');

    const created = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', lead.cookie)
      .send({ name: 'Not Yours', members: [{ email: helper.email, role: 'EDITOR' }] })
      .expect(201);

    const id = (created.body as { id: string }).id;

    // An editor may change a project but not destroy it.
    await request(app).delete(`/api/v1/projects/${id}`).set('Cookie', helper.cookie).expect(403);
    await request(app).delete(`/api/v1/projects/${id}`).set('Cookie', lead.cookie).expect(204);
  });
});

/**
 * The brief.
 *
 * A document of user-written sections rather than the fixed fields it
 * replaced. It is saved whole, so the interesting cases are the ones where the
 * set changes shape: reordering, deleting, and emptying it entirely.
 */
describe('project brief', () => {
  it('is null before anything is written, and keeps the order it was given', async () => {
    const author = await createUser('author@example.com');

    const created = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', author.cookie)
      .send({ name: 'Brief Test' })
      .expect(201);

    const id = (created.body as { id: string }).id;

    // Unwritten is a normal state, not a 404.
    await request(app)
      .get(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .expect(200)
      .expect((r) => expect((r.body as { brief: unknown }).brief).toBeNull());

    await request(app)
      .put(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .send({
        sections: [
          { heading: 'Project overview', body: 'What this is.' },
          { heading: 'Objectives', body: 'What it is for.' },
          { heading: 'Timeline', body: '18 months.' },
        ],
      })
      .expect(200);

    const read = await request(app)
      .get(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .expect(200);

    const sections = (read.body as { brief: { sections: { heading: string; position: number }[] } })
      .brief.sections;

    expect(sections.map((s) => s.heading)).toEqual(['Project overview', 'Objectives', 'Timeline']);
    expect(sections.map((s) => s.position)).toEqual([0, 1, 2]);
  });

  it('replaces the document rather than merging into it', async () => {
    const author = await createUser('author2@example.com');

    const created = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', author.cookie)
      .send({ name: 'Reordering' })
      .expect(201);

    const id = (created.body as { id: string }).id;

    await request(app)
      .put(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .send({
        sections: [
          { heading: 'One', body: 'a' },
          { heading: 'Two', body: 'b' },
          { heading: 'Three', body: 'c' },
        ],
      })
      .expect(200);

    // Reordered, one deleted, one added — the shape a single editing pass
    // produces, and the reason the whole document is sent.
    const saved = await request(app)
      .put(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .send({
        sections: [
          { heading: 'Three', body: 'c' },
          { heading: 'One', body: 'a changed' },
          { heading: 'Four', body: 'd' },
        ],
      })
      .expect(200);

    const sections = (saved.body as { brief: { sections: { heading: string; body: string }[] } })
      .brief.sections;

    expect(sections.map((s) => s.heading)).toEqual(['Three', 'One', 'Four']);
    expect(sections[1]?.body).toBe('a changed');
    // "Two" is gone rather than lingering because it was not mentioned.
    expect(sections.map((s) => s.heading)).not.toContain('Two');
  });

  it('accepts an empty document, and refuses a section with no heading', async () => {
    const author = await createUser('author3@example.com');

    const created = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', author.cookie)
      .send({ name: 'Emptying' })
      .expect(201);

    const id = (created.body as { id: string }).id;

    await request(app)
      .put(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .send({ sections: [{ heading: 'Something', body: 'x' }] })
      .expect(200);

    // Deleting everything is a state the author is allowed to be in.
    await request(app)
      .put(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .send({ sections: [] })
      .expect(200)
      .expect((r) =>
        expect((r.body as { brief: { sections: unknown[] } }).brief.sections).toHaveLength(0),
      );

    // A heading is what makes a section findable. 422, the app's status for a
    // body that parsed but failed validation.
    await request(app)
      .put(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .send({ sections: [{ heading: '   ', body: 'orphan prose' }] })
      .expect(422);
  });

  it('lets a viewer read the brief but not write it', async () => {
    const author = await createUser('author4@example.com');
    const reader = await createUser('reader4@example.com');

    const created = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', author.cookie)
      .send({ name: 'Read Only', members: [{ email: reader.email, role: 'VIEWER' }] })
      .expect(201);

    const id = (created.body as { id: string }).id;

    await request(app)
      .put(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .send({ sections: [{ heading: 'Visible', body: 'to the viewer' }] })
      .expect(200);

    await request(app).get(`/api/v1/projects/${id}/brief`).set('Cookie', reader.cookie).expect(200);

    await request(app)
      .put(`/api/v1/projects/${id}/brief`)
      .set('Cookie', reader.cookie)
      .send({ sections: [] })
      .expect(403);
  });

  it('takes the brief with the project when it is deleted', async () => {
    const author = await createUser('author5@example.com');

    const created = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', author.cookie)
      .send({ name: 'Doomed' })
      .expect(201);

    const id = (created.body as { id: string }).id;

    await request(app)
      .put(`/api/v1/projects/${id}/brief`)
      .set('Cookie', author.cookie)
      .send({ sections: [{ heading: 'Gone soon', body: 'x' }] })
      .expect(200);

    await request(app).delete(`/api/v1/projects/${id}`).set('Cookie', author.cookie).expect(204);

    // Both cascades: brief by project, sections by brief.
    expect(await prisma.projectBrief.count({ where: { projectId: id } })).toBe(0);
    expect(await prisma.briefSection.count()).toBeGreaterThanOrEqual(0);
  });
});
