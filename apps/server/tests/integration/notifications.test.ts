/**
 * Who is told what.
 *
 * Every write here goes through the API exactly as the app does it, and the
 * assertion is on the `Notification` rows that appear — for the right person,
 * with a title that says what happened and a link that goes somewhere. Email
 * is not asserted: the transport logs instead of delivering in tests, and the
 * dispatch is fire-and-forget by design.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  app,
  createUser,
  disconnect,
  makeAdmin,
  prisma,
  request,
  resetDatabase,
  type TestUser,
} from './helpers.js';

let admin: TestUser;
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let projectId: string;
let members: { id: string; email: string }[];

/** The bell for one person: newest first, titles only. */
async function bell(user: TestUser, type?: string) {
  return prisma.notification.findMany({
    where: { userId: user.id, ...(type ? { type: type as never } : {}) },
    orderBy: { createdAt: 'desc' },
    select: { type: true, title: true, message: true, link: true },
  });
}

async function clearBells(): Promise<void> {
  await prisma.notification.deleteMany({});
}

const memberId = (email: string) => members.find((m) => m.email === email)?.id as string;

beforeAll(async () => {
  await resetDatabase();
  admin = await createUser('admin@example.com');
  await makeAdmin(admin.id);
  owner = await createUser('owner@example.com');
  editor = await createUser('editor@example.com');
  viewer = await createUser('viewer@example.com');

  const created = await request(app)
    .post('/api/v1/projects')
    .set('Cookie', owner.cookie)
    .send({
      name: 'Field study',
      members: [
        { email: editor.email, role: 'EDITOR' },
        { email: viewer.email, role: 'VIEWER' },
      ],
    })
    .expect(201);
  projectId = (created.body as { id: string }).id;

  const listed = await request(app)
    .get(`/api/v1/projects/${projectId}/members`)
    .set('Cookie', owner.cookie)
    .expect(200);
  members = (listed.body as { members: { id: string; email: string }[] }).members;
});

afterAll(disconnect);

describe('preferences', () => {
  it('exist for every account, with the defaults', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/preferences')
      .set('Cookie', viewer.cookie)
      .expect(200);
    expect(res.body).toMatchObject({
      preferences: {
        deadlineRemindersEnabled: true,
        dailyAgendaEnabled: true,
        meetingRequestsEnabled: true,
        reminderDaysBefore: [1, 3, 5],
        notificationTime: '09:00',
      },
    });
  });

  it('can be changed, including "on the day", and are stored tidily', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/preferences')
      .set('Cookie', viewer.cookie)
      .send({
        reminderDaysBefore: [7, 0, 1, 1],
        notificationTime: '18:30',
        dailyAgendaEnabled: false,
      })
      .expect(200);
    expect(res.body).toMatchObject({
      preferences: {
        reminderDaysBefore: [0, 1, 7],
        notificationTime: '18:30',
        dailyAgendaEnabled: false,
        // Untouched.
        deadlineRemindersEnabled: true,
      },
    });
  });

  it('refuses a time that is not a time', async () => {
    await request(app)
      .patch('/api/v1/notifications/preferences')
      .set('Cookie', viewer.cookie)
      .send({ notificationTime: '25:99' })
      .expect(422);
  });
});

describe('the team', () => {
  it('tells the owner when someone accepts', async () => {
    await clearBells();
    await request(app)
      .post(`/api/v1/projects/${projectId}/members/accept`)
      .set('Cookie', editor.cookie)
      .expect(200);

    const [latest] = await bell(owner, 'TEAM');
    expect(latest?.title).toMatch(/joined Field study/);
    expect(latest?.link).toBe(`/projects/${projectId}`);
  });

  it('tells a member their role changed, and not when it did not', async () => {
    await clearBells();
    await request(app)
      .patch(`/api/v1/projects/${projectId}/members/${memberId(viewer.email)}`)
      .set('Cookie', owner.cookie)
      .send({ role: 'EDITOR' })
      .expect(200);
    expect((await bell(viewer, 'TEAM'))[0]?.title).toBe('You are now an editor on Field study');

    await clearBells();
    await request(app)
      .patch(`/api/v1/projects/${projectId}/members/${memberId(viewer.email)}`)
      .set('Cookie', owner.cookie)
      .send({ role: 'EDITOR' })
      .expect(200);
    expect(await bell(viewer, 'TEAM')).toHaveLength(0);
  });

  it('tells the new owner, and the old one stays quiet about it', async () => {
    await clearBells();
    await request(app)
      .post(`/api/v1/projects/${projectId}/transfer-ownership`)
      .set('Cookie', owner.cookie)
      .send({ memberId: memberId(editor.email) })
      .expect(200);

    const [latest] = await bell(editor, 'TEAM');
    expect(latest?.title).toBe('You now own Field study');
    expect(await bell(owner)).toHaveLength(0);

    // Hand it back for the tests that follow.
    await request(app)
      .post(`/api/v1/projects/${projectId}/transfer-ownership`)
      .set('Cookie', editor.cookie)
      .send({ memberId: memberId(owner.email) })
      .expect(200);
  });

  it('tells someone they were removed, unless they left on their own', async () => {
    const leaver = await createUser('leaver@example.com');
    await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: leaver.email, role: 'VIEWER' })
      .expect(201);
    const listed = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const leaverMember = (listed.body as { members: { id: string; email: string }[] }).members.find(
      (m) => m.email === leaver.email,
    ) as { id: string };

    await clearBells();
    await request(app)
      .delete(`/api/v1/projects/${projectId}/members/${leaverMember.id}`)
      .set('Cookie', leaver.cookie)
      .expect(204);
    expect(await bell(leaver)).toHaveLength(0);

    // Back in, then out by the owner's hand.
    await request(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .send({ email: leaver.email, role: 'VIEWER' })
      .expect(201);
    const again = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const id = (again.body as { members: { id: string; email: string }[] }).members.find(
      (m) => m.email === leaver.email,
    )?.id as string;

    await clearBells();
    await request(app)
      .delete(`/api/v1/projects/${projectId}/members/${id}`)
      .set('Cookie', owner.cookie)
      .expect(204);
    const [latest] = await bell(leaver, 'TEAM');
    expect(latest?.title).toBe('You were removed from Field study');
    expect(latest?.link).toBeNull();
  });
});

describe('project meetings', () => {
  const inTwoDays = () => new Date(Date.now() + 2 * 86_400_000).toISOString();
  const lastWeek = () => new Date(Date.now() - 7 * 86_400_000).toISOString();

  it('tells attendees a meeting was scheduled, but not the person scheduling it', async () => {
    await clearBells();
    await request(app)
      .post(`/api/v1/projects/${projectId}/meetings`)
      .set('Cookie', owner.cookie)
      .send({
        title: 'Kick-off',
        heldAt: inTwoDays(),
        attendeeIds: [memberId(owner.email), memberId(editor.email), memberId(viewer.email)],
      })
      .expect(201);

    expect((await bell(editor, 'PROJECT_MEETING'))[0]?.title).toBe('Meeting: Kick-off');
    expect((await bell(editor, 'PROJECT_MEETING'))[0]?.link).toBe(
      `/projects/${projectId}/meetings`,
    );
    expect(await bell(viewer, 'PROJECT_MEETING')).toHaveLength(1);
    expect(await bell(owner, 'PROJECT_MEETING')).toHaveLength(0);
  });

  it('says nothing about a meeting logged after the fact', async () => {
    await clearBells();
    await request(app)
      .post(`/api/v1/projects/${projectId}/meetings`)
      .set('Cookie', owner.cookie)
      .send({
        title: 'Retro',
        heldAt: lastWeek(),
        notes: 'Went fine.',
        attendeeIds: [memberId(editor.email)],
      })
      .expect(201);
    expect(await bell(editor)).toHaveLength(0);
  });

  it('tells the right people when it moves, gains or loses an attendee, or is cancelled', async () => {
    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/meetings`)
      .set('Cookie', owner.cookie)
      .send({ title: 'Design review', heldAt: inTwoDays(), attendeeIds: [memberId(editor.email)] })
      .expect(201);
    const meetingId = (created.body as { id: string }).id;

    // Notes only: silence.
    await clearBells();
    await request(app)
      .patch(`/api/v1/projects/${projectId}/meetings/${meetingId}`)
      .set('Cookie', owner.cookie)
      .send({ notes: 'Agenda: the figures.' })
      .expect(200);
    expect(await bell(editor)).toHaveLength(0);

    // Moved, and the viewer added while the editor is dropped.
    await clearBells();
    await request(app)
      .patch(`/api/v1/projects/${projectId}/meetings/${meetingId}`)
      .set('Cookie', owner.cookie)
      .send({
        heldAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        attendeeIds: [memberId(viewer.email)],
      })
      .expect(200);
    expect((await bell(viewer, 'PROJECT_MEETING'))[0]?.title).toBe('Meeting: Design review');
    expect((await bell(editor, 'PROJECT_MEETING'))[0]?.title).toBe(
      'You are no longer on: Design review',
    );

    // Moved again with the viewer kept: "Moved".
    await clearBells();
    await request(app)
      .patch(`/api/v1/projects/${projectId}/meetings/${meetingId}`)
      .set('Cookie', owner.cookie)
      .send({ heldAt: new Date(Date.now() + 4 * 86_400_000).toISOString() })
      .expect(200);
    expect((await bell(viewer, 'PROJECT_MEETING'))[0]?.title).toBe('Moved: Design review');

    await clearBells();
    await request(app)
      .delete(`/api/v1/projects/${projectId}/meetings/${meetingId}`)
      .set('Cookie', owner.cookie)
      .expect(204);
    expect((await bell(viewer, 'PROJECT_MEETING'))[0]?.title).toBe('Cancelled: Design review');
  });
});

describe('reports and reviews', () => {
  it('tells every admin about a new report, and the author when it is closed', async () => {
    await clearBells();
    const sent = await request(app)
      .post('/api/v1/reports')
      .set('Cookie', viewer.cookie)
      .send({
        type: 'BUG',
        title: 'Calendar is blank',
        description: 'Nothing renders in week view.',
      })
      .expect(201);
    const reportId = (sent.body as { id: string }).id;

    const [toAdmin] = await bell(admin, 'ADMIN');
    expect(toAdmin?.title).toMatch(/^New bug from/);
    expect(toAdmin?.link).toContain('tab=reports');
    // Not to a regular user, and not to the author.
    expect(await bell(viewer)).toHaveLength(0);

    // Taking it on is silent.
    await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Cookie', admin.cookie)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(await bell(viewer)).toHaveLength(0);

    await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Cookie', admin.cookie)
      .send({ status: 'RESOLVED', resolution: 'Fixed in the latest deploy — thank you.' })
      .expect(200);
    const [toAuthor] = await bell(viewer, 'REPORT');
    expect(toAuthor?.title).toBe('Resolved: Calendar is blank');
    expect(toAuthor?.message).toBe('Fixed in the latest deploy — thank you.');
    expect(toAuthor?.link).toBe('/help');

    // Resolving again (no status change) says nothing more.
    await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Cookie', admin.cookie)
      .send({ resolution: 'Edited note.' })
      .expect(200);
    expect(await bell(viewer, 'REPORT')).toHaveLength(1);
  });

  it('tells admins a review is waiting, and the author what became of it', async () => {
    await clearBells();
    const saved = await request(app)
      .put('/api/v1/reviews/me')
      .set('Cookie', editor.cookie)
      .send({ rating: 5, body: 'Skrivbok replaced four spreadsheets and a wall of sticky notes.' })
      .expect(200);
    const reviewId = (saved.body as { review: { id: string } }).review.id;
    expect((await bell(admin, 'ADMIN'))[0]?.title).toBe('A review is waiting for approval');

    await request(app)
      .patch(`/api/v1/admin/reviews/${reviewId}`)
      .set('Cookie', admin.cookie)
      .send({ status: 'REJECTED', adminNote: 'Could you name the spreadsheets?' })
      .expect(200);
    const [latest] = await bell(editor, 'REPORT');
    expect(latest?.title).toBe('Your review was not published');
    expect(latest?.message).toBe('Could you name the spreadsheets?');
  });
});

describe('admin actions on an account', () => {
  it('tell the person about a role or plan change, and nothing when nothing changed', async () => {
    await clearBells();
    await request(app)
      .patch(`/api/v1/admin/users/${viewer.id}`)
      .set('Cookie', admin.cookie)
      .send({ name: 'Renamed Viewer' })
      .expect(200);
    expect(await bell(viewer)).toHaveLength(0);

    await request(app)
      .patch(`/api/v1/admin/users/${viewer.id}`)
      .set('Cookie', admin.cookie)
      .send({
        plan: 'PRO',
        subscriptionEndsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .expect(200);
    expect((await bell(viewer, 'SUBSCRIPTION'))[0]?.title).toBe('PRO was added to your account');

    await request(app)
      .patch(`/api/v1/admin/users/${viewer.id}`)
      .set('Cookie', admin.cookie)
      .send({ role: 'ADMIN' })
      .expect(200);
    expect((await bell(viewer, 'SYSTEM'))[0]?.title).toBe('You are now an administrator');

    // Tidy up: viewer back to a regular free account.
    await request(app)
      .patch(`/api/v1/admin/users/${viewer.id}`)
      .set('Cookie', admin.cookie)
      .send({ role: 'USER', plan: 'FREE', subscriptionEndsAt: null })
      .expect(200);
  });

  it('do not announce an admin editing their own account', async () => {
    await clearBells();
    await request(app)
      .patch(`/api/v1/admin/users/${admin.id}`)
      .set('Cookie', admin.cookie)
      .send({ plan: 'PRO' })
      .expect(200);
    expect(await bell(admin)).toHaveLength(0);
    await request(app)
      .patch(`/api/v1/admin/users/${admin.id}`)
      .set('Cookie', admin.cookie)
      .send({ plan: 'FREE' })
      .expect(200);
  });
});

describe('a new account', () => {
  it('is nudged once to set a timezone', async () => {
    const fresh = await createUser('fresh@example.com');
    const [latest] = await bell(fresh, 'SYSTEM');
    expect(latest?.title).toMatch(/timezone/);
    expect(latest?.link).toBe('/settings');
  });
});
