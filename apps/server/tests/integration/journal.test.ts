/**
 * Journal tags, and the writing streak.
 *
 * The streak is the part worth testing: it is the one number on the screen
 * derived by walking rows rather than counting them, and every interesting case
 * is a boundary — the day it starts, the day it is allowed to lapse, and the
 * day it breaks. Dates are `@db.Date` at UTC midnight, so the fixtures are
 * built the same way rather than from local time.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createUser, disconnect, prisma, request, resetDatabase } from './helpers.js';

const DAY = 86_400_000;

/** `YYYY-MM-DD`, `daysAgo` days before today in UTC. */
function day(daysAgo: number): string {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - daysAgo * DAY).toISOString().slice(0, 10);
}

let user: { id: string; email: string; cookie: string };

beforeEach(async () => {
  await resetDatabase();
  user = await createUser('journal@example.com');
});

afterAll(disconnect);

async function write(
  entryDate: string,
  extra: { title?: string; content?: string; tags?: string[] } = {},
): Promise<string> {
  const response = await request(app)
    .post('/api/v1/journal')
    .set('Cookie', user.cookie)
    .send({ content: 'Wrote some words today.', entryDate, ...extra })
    .expect(201);

  return (response.body as { id: string }).id;
}

async function stats(): Promise<{ entries: number; streak: number }> {
  const response = await request(app)
    .get('/api/v1/journal/stats')
    .set('Cookie', user.cookie)
    .expect(200);

  return response.body as { entries: number; streak: number };
}

describe('the writing streak', () => {
  it('is zero with nothing written', async () => {
    expect(await stats()).toEqual({ entries: 0, streak: 0 });
  });

  it('counts today alone as one', async () => {
    await write(day(0));
    expect((await stats()).streak).toBe(1);
  });

  it('counts consecutive days', async () => {
    await write(day(0));
    await write(day(1));
    await write(day(2));
    expect((await stats()).streak).toBe(3);
  });

  it('survives the day not being over yet', async () => {
    // Written yesterday and the day before, nothing yet today. That is a run of
    // two that is still alive, not a broken one.
    await write(day(1));
    await write(day(2));
    expect((await stats()).streak).toBe(2);
  });

  it('breaks once a whole day has been missed', async () => {
    await write(day(2));
    await write(day(3));
    expect((await stats()).streak).toBe(0);
  });

  it('stops at the first gap rather than counting every entry', async () => {
    await write(day(0));
    await write(day(1));
    // A gap at day 2, then more writing behind it.
    await write(day(3));
    await write(day(4));

    const result = await stats();
    expect(result.streak).toBe(2);
    expect(result.entries).toBe(4);
  });

  it('counts a day once however many times it was written in', async () => {
    await write(day(0), { title: 'Morning' });
    await write(day(0), { title: 'Evening' });
    await write(day(1));

    const result = await stats();
    expect(result.streak).toBe(2);
    expect(result.entries).toBe(3);
  });

  it('belongs to one user only', async () => {
    await write(day(0));
    await write(day(1));

    const other = await createUser('someone-else@example.com');
    const response = await request(app)
      .get('/api/v1/journal/stats')
      .set('Cookie', other.cookie)
      .expect(200);

    expect(response.body).toEqual({ entries: 0, streak: 0 });
  });
});

describe('tags', () => {
  it('are lowercased and de-duplicated on the way in', async () => {
    const id = await write(day(0), { tags: ['Fieldwork', 'fieldwork', 'READING'] });

    const stored = await prisma.journalEntry.findUniqueOrThrow({ where: { id } });
    expect(stored.tags).toEqual(['fieldwork', 'reading']);
  });

  it('filter the list', async () => {
    await write(day(0), { title: 'Lab', tags: ['fieldwork'] });
    await write(day(1), { title: 'Desk', tags: ['reading'] });

    const response = await request(app)
      .get('/api/v1/journal?tag=fieldwork')
      .set('Cookie', user.cookie)
      .expect(200);

    const body = response.body as { data: { title: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.title).toBe('Lab');
  });

  it('widen the list when more than one is given', async () => {
    await write(day(0), { tags: ['fieldwork'] });
    await write(day(1), { tags: ['reading'] });
    await write(day(2), { tags: ['admin'] });

    const response = await request(app)
      .get('/api/v1/journal?tag=fieldwork&tag=reading')
      .set('Cookie', user.cookie)
      .expect(200);

    expect((response.body as { data: unknown[] }).data).toHaveLength(2);
  });

  it('come back with counts, most used first', async () => {
    await write(day(0), { tags: ['fieldwork', 'reading'] });
    await write(day(1), { tags: ['fieldwork'] });

    const response = await request(app)
      .get('/api/v1/journal/tags')
      .set('Cookie', user.cookie)
      .expect(200);

    expect((response.body as { tags: unknown[] }).tags).toEqual([
      { tag: 'fieldwork', count: 2 },
      { tag: 'reading', count: 1 },
    ]);
  });

  it('are left alone by a PATCH that does not mention them', async () => {
    const id = await write(day(0), { tags: ['fieldwork'] });

    await request(app)
      .patch(`/api/v1/journal/${id}`)
      .set('Cookie', user.cookie)
      .send({ title: 'A new title' })
      .expect(200);

    const stored = await prisma.journalEntry.findUniqueOrThrow({ where: { id } });
    expect(stored.tags).toEqual(['fieldwork']);
  });

  it('can be cleared deliberately', async () => {
    const id = await write(day(0), { tags: ['fieldwork'] });

    await request(app)
      .patch(`/api/v1/journal/${id}`)
      .set('Cookie', user.cookie)
      .send({ tags: [] })
      .expect(200);

    const stored = await prisma.journalEntry.findUniqueOrThrow({ where: { id } });
    expect(stored.tags).toEqual([]);
  });
});
