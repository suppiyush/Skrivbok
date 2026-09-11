/**
 * The profile as one document: the record round-trips, the lists round-trip,
 * and a save that mentions only some fields leaves the rest alone.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, createUser, disconnect, request, resetDatabase, type TestUser } from './helpers.js';

let me: TestUser;

beforeAll(async () => {
  await resetDatabase();
  me = await createUser('me@example.com');
});

afterAll(disconnect);

const save = (body: object) =>
  request(app).put('/api/v1/profile').set('Cookie', me.cookie).send(body);

const read = async () => {
  const response = await request(app).get('/api/v1/profile').set('Cookie', me.cookie).expect(200);
  return (response.body as { profile: Record<string, unknown> }).profile;
};

describe('the record', () => {
  it('saves every section and reads it back the same', async () => {
    const record = {
      fullName: 'A. Lindqvist',
      designation: 'Assistant Professor',
      department: 'Computer Science',
      institution: 'Uppsala University',
      officialEmail: 'a.lindqvist@uu.se',
      alternateEmail: 'anna@example.com',
      phone: '+46 18 471 0000',
      website: 'https://lindqvist.example',
      officeAddress: 'Room 4212, ITC',
      degrees: [
        {
          degree: 'PhD',
          field: 'Distributed systems',
          institution: 'KTH',
          startYear: '2015',
          endYear: '2020',
        },
      ],
      positions: [
        {
          title: 'Postdoc',
          organisation: 'ETH Zürich',
          startYear: '2020',
          endYear: '2022',
          description: 'Consensus under partial synchrony.',
        },
      ],
      researchKeywords: 'consensus, formal methods',
      researchDescription: 'I work on making distributed systems provably correct.',
      scholarLink: 'https://scholar.google.com/citations?user=abc',
      courses: [
        {
          title: 'Distributed Systems',
          code: 'CS 401',
          level: 'MSc',
          institution: 'UU',
          years: '2023–',
        },
      ],
      grants: [
        { title: 'Verified Consensus', funder: 'VR', amount: '4 MSEK', year: '2024', role: 'PI' },
      ],
      professionalActivities: 'PC member, PODC 2025\nReviewer, JACM',
      awards: [{ title: 'Best paper', issuer: 'DISC', year: '2021' }],
      skills: 'TLA+, Coq, Rust',
      outreach: 'Science week talks',
    };

    await save(record).expect(200);
    const stored = await read();

    for (const [key, value] of Object.entries(record)) {
      expect(stored[key]).toEqual(value);
    }
  });

  it('leaves the lists alone when a save does not mention them', async () => {
    await save({ phone: '+46 18 471 1111' }).expect(200);
    const stored = await read();
    expect(stored['phone']).toBe('+46 18 471 1111');
    expect(stored['degrees']).toHaveLength(1);
    expect(stored['awards']).toHaveLength(1);
  });

  it('clears a list when sent empty', async () => {
    await save({ awards: [] }).expect(200);
    expect((await read())['awards']).toEqual([]);
  });

  it('refuses a row missing the one field it needs', async () => {
    const response = await save({ degrees: [{ degree: '', field: 'Physics' }] }).expect(422);
    const details = (response.body as { error: { details: { path: string }[] } }).error.details;
    expect(details.some((d) => d.path.includes('degrees'))).toBe(true);
  });

  it('refuses a link that is not http(s)', async () => {
    await save({ website: 'javascript:alert(1)' }).expect(422);
  });
});
