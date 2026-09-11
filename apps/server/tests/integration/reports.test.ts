/**
 * The report loop, end to end: a user sends one, an admin sees it with the
 * counts, takes it on, closes it with a note, and the author reads the note.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  app,
  createUser,
  disconnect,
  makeAdmin,
  request,
  resetDatabase,
  type TestUser,
} from './helpers.js';

let author: TestUser;
let admin: TestUser;
let reportId: string;

beforeAll(async () => {
  await resetDatabase();
  author = await createUser('author@example.com');
  admin = await createUser('admin@example.com');
  await makeAdmin(admin.id);

  const response = await request(app)
    .post('/api/v1/reports')
    .set('Cookie', author.cookie)
    .send({
      type: 'BUG',
      title: 'Recurrence off by an hour',
      description: 'Weekly events shift after the clocks change.',
      featurePage: '/calendar',
    })
    .expect(201);
  reportId = (response.body as { id: string }).id;
});

afterAll(disconnect);

const adminList = (query = '') =>
  request(app).get(`/api/v1/admin/reports${query}`).set('Cookie', admin.cookie).expect(200);

describe('triage', () => {
  it('is for admins only', async () => {
    await request(app).get('/api/v1/admin/reports').set('Cookie', author.cookie).expect(403);
  });

  it('lists the report with who sent it, and counts by status', async () => {
    const body = (await adminList('?status=OPEN')).body as {
      data: { id: string; user: { email: string } | null }[];
      statusCounts: Record<string, number>;
    };
    expect(body.data.map((r) => r.id)).toContain(reportId);
    expect(body.data[0]?.user?.email).toBe(author.email);
    expect(body.statusCounts).toEqual({ OPEN: 1, IN_PROGRESS: 0, RESOLVED: 0, DISMISSED: 0 });
  });

  it('can be taken on, then resolved with a note the author reads', async () => {
    await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Cookie', admin.cookie)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const closed = await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Cookie', admin.cookie)
      .send({ status: 'RESOLVED', resolution: 'Fixed in today’s release.' })
      .expect(200);
    const report = closed.body as { resolvedAt: string | null };
    expect(report.resolvedAt).not.toBeNull();

    // The author's own list carries the note under its real name.
    const mine = await request(app).get('/api/v1/reports').set('Cookie', author.cookie).expect(200);
    const own = (
      mine.body as { data: { id: string; status: string; resolution: string | null }[] }
    ).data.find((r) => r.id === reportId);
    expect(own?.status).toBe('RESOLVED');
    expect(own?.resolution).toBe('Fixed in today’s release.');

    const counts = ((await adminList()).body as { statusCounts: Record<string, number> })
      .statusCounts;
    expect(counts['RESOLVED']).toBe(1);
    expect(counts['OPEN']).toBe(0);
  });

  it('reopening clears the closing note and stamp', async () => {
    const reopened = await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Cookie', admin.cookie)
      .send({ status: 'OPEN', resolution: null })
      .expect(200);
    const report = reopened.body as { resolvedAt: string | null; resolution: string | null };
    expect(report.resolvedAt).toBeNull();
    expect(report.resolution).toBeNull();
  });
});
