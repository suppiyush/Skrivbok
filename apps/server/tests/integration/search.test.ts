/**
 * The header's search: finds by name, across kinds, and only what is yours.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, createUser, disconnect, request, resetDatabase, type TestUser } from './helpers.js';

let me: TestUser;
let other: TestUser;

type Hit = { kind: string; id: string; title: string; subtitle: string | null };

async function find(user: TestUser, q: string): Promise<Hit[]> {
  const response = await request(app)
    .get(`/api/v1/search?q=${encodeURIComponent(q)}`)
    .set('Cookie', user.cookie)
    .expect(200);
  return (response.body as { results: Hit[] }).results;
}

beforeAll(async () => {
  await resetDatabase();
  me = await createUser('me@example.com');
  other = await createUser('other@example.com');

  const mine = (path: string, body: object) =>
    request(app).post(`/api/v1/${path}`).set('Cookie', me.cookie).send(body).expect(201);

  await mine('ideas', { title: 'Raft consensus explainer' });
  await mine('notes', { title: 'Raft meeting notes' });
  await mine('deadlines', { title: 'Raft paper draft', dueAt: '2027-01-10T09:00:00Z' });
  await mine('literature', { title: 'In Search of an Understandable Consensus Algorithm' });
  await mine('career-goals', { title: 'Publish on consensus' });
  await mine('journal', { title: 'Raft day one', content: 'Started reading.' });

  // A project the other user owns but I am on — findable by me through
  // membership, not ownership.
  await request(app)
    .post('/api/v1/projects')
    .set('Cookie', other.cookie)
    .send({ name: 'Raft implementation', members: [{ email: me.email, role: 'VIEWER' }] })
    .expect(201);

  // The other user's own things, which I must never see.
  await request(app)
    .post('/api/v1/ideas')
    .set('Cookie', other.cookie)
    .send({ title: 'Raft, but private' })
    .expect(201);
});

afterAll(disconnect);

describe('search', () => {
  it('finds by name across every kind, and says what each is', async () => {
    const hits = await find(me, 'raft');
    const kinds = new Set(hits.map((h) => h.kind));
    expect(kinds).toEqual(new Set(['idea', 'note', 'deadline', 'journal', 'project']));
    expect(hits.find((h) => h.kind === 'deadline')?.subtitle).toBe('Due 2027-01-10');
  });

  it('is case-insensitive and matches inside a title', async () => {
    const hits = await find(me, 'CONSENSUS');
    expect(hits.map((h) => h.kind).sort()).toEqual(['career-goal', 'idea', 'literature']);
  });

  it('never returns another person’s records', async () => {
    const titles = (await find(me, 'raft')).map((h) => h.title);
    expect(titles).not.toContain('Raft, but private');

    // And the other way round: the project is theirs, the rest is mine.
    const theirs = (await find(other, 'raft')).map((h) => h.title);
    expect(theirs.sort()).toEqual(['Raft implementation', 'Raft, but private']);
  });

  it('needs two characters', async () => {
    await request(app).get('/api/v1/search?q=r').set('Cookie', me.cookie).expect(422);
  });

  it('is empty, not an error, when nothing matches', async () => {
    expect(await find(me, 'zzzz')).toEqual([]);
  });
});
