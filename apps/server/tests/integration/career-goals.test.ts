/**
 * A goal's stage timeline.
 *
 * The timeline screen reads `GET /:id/history` and writes through
 * `PUT /:id/stage`; these pin down what it relies on — the starting stage is
 * recorded with the description it was created with, each later stage adds an
 * entry carrying what happened, and nobody else can read the log.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createUser, disconnect, request, resetDatabase, type TestUser } from './helpers.js';

interface Entry {
  stage: number;
  description: string | null;
  recordedAt: string;
}

let user: TestUser;

beforeEach(async () => {
  await resetDatabase();
  user = await createUser('goals@example.com');
});

afterAll(disconnect);

async function createGoal(body: Record<string, unknown>): Promise<string> {
  const res = await request(app)
    .post('/api/v1/career-goals')
    .set('Cookie', user.cookie)
    .send(body)
    .expect(201);
  return (res.body as { id: string }).id;
}

async function history(id: string, as: TestUser = user): Promise<Entry[]> {
  const res = await request(app)
    .get(`/api/v1/career-goals/${id}/history`)
    .set('Cookie', as.cookie)
    .expect(200);
  return (res.body as { history: Entry[] }).history;
}

describe('the stage timeline', () => {
  it('starts with the stage and description the goal was created at', async () => {
    const id = await createGoal({
      title: 'Publish a research paper',
      totalStages: 4,
      currentStage: 1,
      stageDescription: 'Outline drafted',
    });

    const entries = await history(id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ stage: 1, description: 'Outline drafted' });
  });

  it('adds each later stage with what happened, newest first', async () => {
    const id = await createGoal({ title: 'Grant', totalStages: 3, currentStage: 1 });

    const moved = await request(app)
      .put(`/api/v1/career-goals/${id}/stage`)
      .set('Cookie', user.cookie)
      .send({ stage: 2, description: 'Submitted to the council' })
      .expect(200);
    expect(moved.body).toMatchObject({
      currentStage: 2,
      stageDescription: 'Submitted to the council',
    });

    const entries = await history(id);
    expect(entries.map((e) => e.stage)).toEqual([2, 1]);
    expect(entries[0]?.description).toBe('Submitted to the council');
  });

  it('completes the goal when the final stage is recorded', async () => {
    const id = await createGoal({ title: 'Course', totalStages: 2, currentStage: 1 });

    const done = await request(app)
      .put(`/api/v1/career-goals/${id}/stage`)
      .set('Cookie', user.cookie)
      .send({ stage: 2, description: 'Taught the last lecture' })
      .expect(200);
    expect((done.body as { achievedAt: string | null }).achievedAt).not.toBeNull();
  });

  it('refuses to record the stage the goal is already at', async () => {
    const id = await createGoal({ title: 'Skill', totalStages: 3, currentStage: 1 });
    await request(app)
      .put(`/api/v1/career-goals/${id}/stage`)
      .set('Cookie', user.cookie)
      .send({ stage: 1, description: 'Again' })
      .expect(400);
    expect(await history(id)).toHaveLength(1);
  });

  it('is not readable by anyone else', async () => {
    const id = await createGoal({ title: 'Private', totalStages: 3, currentStage: 1 });
    const other = await createUser('other@example.com');
    await request(app)
      .get(`/api/v1/career-goals/${id}/history`)
      .set('Cookie', other.cookie)
      .expect(404);
  });
});
