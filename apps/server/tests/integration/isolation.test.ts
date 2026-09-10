/**
 * Cross-user isolation.
 *
 * This file exists because of one specific legacy behaviour: every data route
 * took an email or an id from the request and returned whatever matched.
 * `GET /projects/victim@example.com` returned that person's projects;
 * `DELETE /ideas/42` deleted whoever's idea 42 was.
 *
 * Each test below is that attack, run against a real database with the
 * attacker holding the victim's exact record id.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, disconnect, registerUser, request, resetDatabase, type TestUser } from './helpers.js';

let victim: TestUser;
let attacker: TestUser;

beforeAll(async () => {
  await resetDatabase();
  victim = await registerUser('victim@example.com');
  attacker = await registerUser('attacker@example.com');
});

afterAll(disconnect);

/** Create a record as the victim and return its id. */
async function createAsVictim(path: string, body: object): Promise<string> {
  const response = await request(app)
    .post(`/api/v1/${path}`)
    .set('Cookie', victim.cookie)
    .send(body)
    .expect(201);

  return (response.body as { id: string }).id;
}

describe('single-owner resources', () => {
  const cases: { name: string; path: string; body: object; patch: object }[] = [
    { name: 'ideas', path: 'ideas', body: { title: 'Secret idea' }, patch: { title: 'pwned' } },
    { name: 'notes', path: 'notes', body: { title: 'Secret note' }, patch: { title: 'pwned' } },
    {
      name: 'journal',
      path: 'journal',
      body: { content: 'A private entry that is long enough.' },
      patch: { content: 'pwned' },
    },
    {
      name: 'deadlines',
      path: 'deadlines',
      body: { title: 'Secret deadline', dueAt: '2028-01-01T09:00:00Z' },
      patch: { title: 'pwned' },
    },
    {
      name: 'future-work',
      path: 'future-work',
      body: { title: 'Secret plan' },
      patch: { title: 'pwned' },
    },
    {
      name: 'literature',
      path: 'literature',
      body: { title: 'Secret paper' },
      patch: { title: 'pwned' },
    },
    {
      name: 'career-goals',
      path: 'career-goals',
      body: { title: 'Secret goal' },
      patch: { title: 'pwned' },
    },
  ];

  for (const testCase of cases) {
    describe(testCase.name, () => {
      it('hides the record from another user entirely', async () => {
        const id = await createAsVictim(testCase.path, testCase.body);

        // 404, not 403: a 403 would confirm the record exists.
        await request(app)
          .get(`/api/v1/${testCase.path}/${id}`)
          .set('Cookie', attacker.cookie)
          .expect(404);

        await request(app)
          .patch(`/api/v1/${testCase.path}/${id}`)
          .set('Cookie', attacker.cookie)
          .send(testCase.patch)
          .expect(404);

        await request(app)
          .delete(`/api/v1/${testCase.path}/${id}`)
          .set('Cookie', attacker.cookie)
          .expect(404);

        // And the record is untouched.
        await request(app)
          .get(`/api/v1/${testCase.path}/${id}`)
          .set('Cookie', victim.cookie)
          .expect(200);
      });

      it('excludes it from the other user list', async () => {
        const response = await request(app)
          .get(`/api/v1/${testCase.path}`)
          .set('Cookie', attacker.cookie)
          .expect(200);

        const body = response.body as { data: { userId?: string }[] };
        expect(body.data.every((row) => row.userId !== victim.id)).toBe(true);
      });
    });
  }
});

describe('empty PATCH must not reset fields to their defaults', () => {
  // The Part 4 bug: `.partial()` does not strip `.default()`, so an empty body
  // materialised every default and silently overwrote stored values.
  it('rejects an empty body rather than blanking the record', async () => {
    const response = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', victim.cookie)
      .send({ title: 'Keep my colour', category: 'teaching', color: 'BLUE' })
      .expect(201);

    const id = (response.body as { id: string }).id;

    await request(app)
      .patch(`/api/v1/ideas/${id}`)
      .set('Cookie', victim.cookie)
      .send({})
      .expect(422);

    const after = await request(app)
      .get(`/api/v1/ideas/${id}`)
      .set('Cookie', victim.cookie)
      .expect(200);

    expect(after.body).toMatchObject({ category: 'teaching', color: 'BLUE' });
  });

  it('leaves untouched fields alone on a partial update', async () => {
    const created = await request(app)
      .post('/api/v1/ideas')
      .set('Cookie', victim.cookie)
      .send({ title: 'Original', category: 'research', color: 'GREEN' })
      .expect(201);

    const id = (created.body as { id: string }).id;

    const updated = await request(app)
      .patch(`/api/v1/ideas/${id}`)
      .set('Cookie', victim.cookie)
      .send({ title: 'Renamed' })
      .expect(200);

    expect(updated.body).toMatchObject({
      title: 'Renamed',
      category: 'research',
      color: 'GREEN',
    });
  });
});

describe('notifications', () => {
  it('cannot be marked read by another user', async () => {
    // Produce a real notification by inviting the victim to a project.
    const project = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', attacker.cookie)
      .send({ name: 'Shared project' })
      .expect(201);

    await request(app)
      .post(`/api/v1/projects/${(project.body as { id: string }).id}/members`)
      .set('Cookie', attacker.cookie)
      .send({ email: victim.email, role: 'VIEWER' })
      .expect(201);

    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Cookie', victim.cookie)
      .expect(200);

    const ids = (list.body as { data: { id: string }[] }).data.map((n) => n.id);
    expect(ids.length).toBeGreaterThan(0);

    // The attacker knows the ids but cannot act on them.
    await request(app)
      .post('/api/v1/notifications/read')
      .set('Cookie', attacker.cookie)
      .send({ ids })
      .expect(200)
      .expect((r) => expect((r.body as { marked: number }).marked).toBe(0));

    await request(app)
      .delete(`/api/v1/notifications/${ids[0]}`)
      .set('Cookie', attacker.cookie)
      .expect(404);
  });
});
