/**
 * Literature: filtering by several tags, and the CSV download.
 *
 * The export is tested as a spreadsheet would read it — the header row, one
 * row per entry, quoting that survives commas, quotes and newlines, and a
 * formula typed into a summary arriving as text rather than being evaluated.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createUser, disconnect, request, resetDatabase, type TestUser } from './helpers.js';

let user: TestUser;
let other: TestUser;

beforeEach(async () => {
  await resetDatabase();
  user = await createUser('reader@example.com');
  other = await createUser('someone-else@example.com');
});

afterAll(disconnect);

async function add(owner: TestUser, body: Record<string, unknown>): Promise<void> {
  await request(app).post('/api/v1/literature').set('Cookie', owner.cookie).send(body).expect(201);
}

async function titles(query: string): Promise<string[]> {
  const res = await request(app)
    .get(`/api/v1/literature?${query}`)
    .set('Cookie', user.cookie)
    .expect(200);
  return (res.body as { data: { title: string }[] }).data.map((e) => e.title).sort();
}

describe('filtering by several tags', () => {
  beforeEach(async () => {
    await add(user, { title: 'Raft', tags: ['consensus', 'raft'] });
    await add(user, { title: 'Paxos', tags: ['consensus', 'paxos'] });
    await add(user, { title: 'Spanner', tags: ['databases'] });
  });

  it('matches any of them by default', async () => {
    expect(await titles('tag=raft&tag=databases')).toEqual(['Raft', 'Spanner']);
  });

  it('matches all of them when asked', async () => {
    expect(await titles('tag=consensus&tag=raft&tagMatch=all')).toEqual(['Raft']);
  });
});

describe('GET /literature/export', () => {
  it('downloads the whole library as a CSV named for today', async () => {
    await add(user, {
      title: 'In Search of an Understandable Consensus Algorithm',
      links: ['https://raft.github.io/raft.pdf', 'https://example.com/a,b'],
      tags: ['consensus', 'raft'],
      summary: 'Leader election, then "log replication".\nSecond line.',
    });
    await add(other, { title: 'Not mine', tags: ['private'] });

    const res = await request(app)
      .get('/api/v1/literature/export')
      .set('Cookie', user.cookie)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="skrivbok-literature-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.headers['cache-control']).toBe('no-store');

    const text = res.text;
    // Excel needs the byte-order mark to read UTF-8.
    expect(text.startsWith('\uFEFF')).toBe(true);

    const [header, ...rest] = text.slice(1).split('\r\n');
    expect(header).toBe('Title,Links,Tags,Summary,Created Date');

    const body = rest.join('\r\n');
    expect(body).toContain('In Search of an Understandable Consensus Algorithm,');
    // Two links, one per line, quoted because of the newline and the comma.
    expect(body).toContain('"https://raft.github.io/raft.pdf\nhttps://example.com/a,b"');
    expect(body).toContain('"consensus, raft"');
    // Quotes doubled, the newline kept inside the quoted cell.
    expect(body).toContain('"Leader election, then ""log replication"".\nSecond line."');
    expect(body).toMatch(/,\d{4}-\d{2}-\d{2}\r\n$/);
    // Someone else's library is not in it.
    expect(body).not.toContain('Not mine');
  });

  it('neutralises a formula typed into a cell', async () => {
    await add(user, { title: '=HYPERLINK("https://evil.example")', summary: '+1 for this' });

    const res = await request(app)
      .get('/api/v1/literature/export')
      .set('Cookie', user.cookie)
      .expect(200);

    expect(res.text).toContain(`"'=HYPERLINK(""https://evil.example"")"`);
    expect(res.text).toContain(",'+1 for this,");
  });

  it('is a header row alone for an empty library', async () => {
    const res = await request(app)
      .get('/api/v1/literature/export')
      .set('Cookie', user.cookie)
      .expect(200);
    expect(res.text).toBe('\uFEFFTitle,Links,Tags,Summary,Created Date\r\n');
  });

  it('requires a session', async () => {
    await request(app).get('/api/v1/literature/export').expect(401);
  });
});
