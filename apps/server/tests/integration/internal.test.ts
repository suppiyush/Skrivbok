/**
 * The scheduler's door.
 *
 * `/internal/*` lets an external timer run the reminder passes on hosts with
 * no worker process. It must be unreachable without the secret — it does real
 * work and touches every user — and must run the same idempotent pass the
 * worker runs, so calling it twice sends nothing twice.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, createUser, disconnect, prisma, request, resetDatabase } from './helpers.js';

const SECRET = 'test-only-scheduler-secret-0123';
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await resetDatabase();
  await createUser('someone@example.com');
});

afterAll(disconnect);

describe('GET /internal/reminders/tick', () => {
  it('refuses a missing or wrong secret without revealing the route exists', async () => {
    await request(app).get('/api/v1/internal/reminders/tick').expect(401);
    await request(app)
      .get('/api/v1/internal/reminders/tick')
      .set(bearer('test-only-scheduler-secret-XXXX'))
      .expect(401);
    await request(app)
      .get('/api/v1/internal/reminders/tick')
      .set(bearer(SECRET.slice(0, -1)))
      .expect(401);
  });

  it('runs a reminder pass and leaves the heartbeat', async () => {
    const res = await request(app)
      .get('/api/v1/internal/reminders/tick')
      .set(bearer(SECRET))
      .expect(200);

    expect(res.body).toMatchObject({ usersChecked: 1 });

    const status = await prisma.workerStatus.findUnique({ where: { key: 'reminders' } });
    expect(status).not.toBeNull();
  });

  it('accepts POST as well, for schedulers that insist on it', async () => {
    await request(app).post('/api/v1/internal/reminders/tick').set(bearer(SECRET)).expect(200);
  });
});

describe('GET /internal/cleanup', () => {
  it('reports what it swept', async () => {
    const res = await request(app).get('/api/v1/internal/cleanup').set(bearer(SECRET)).expect(200);
    expect(res.body).toEqual({ reminders: expect.any(Number), sessions: expect.any(Number) });
  });
});
