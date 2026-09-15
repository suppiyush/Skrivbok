/**
 * The price list.
 *
 * The public pricing page, the plan page and the policy pages all quote PRO's
 * price from here, so it has to answer for a visitor who is not signed in, and
 * before the payment provider's keys are set — the test environment has none,
 * which is exactly the state a site is in while its payment account is being
 * reviewed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, createUser, disconnect, request, resetDatabase, type TestUser } from './helpers.js';

interface Pricing {
  currency: string;
  plans: { id: string; months: number; amountPaise: number; amountDisplay: string }[];
  freeLimits: { projects: number; careerGoals: number; literature: number };
}

let user: TestUser;

beforeAll(async () => {
  await resetDatabase();
  user = await createUser('buyer@example.com');
});

afterAll(disconnect);

function expectPricing(body: Pricing) {
  expect(body.currency).toMatch(/^[A-Z]{3}$/);
  expect(body.plans.map((p) => [p.id, p.months])).toEqual([
    ['MONTHLY', 1],
    ['YEARLY', 12],
  ]);
  for (const plan of body.plans) {
    expect(Number.isInteger(plan.amountPaise) && plan.amountPaise > 0).toBe(true);
    expect(plan.amountDisplay).toBe(`${body.currency} ${(plan.amountPaise / 100).toFixed(2)}`);
  }
  for (const value of Object.values(body.freeLimits)) {
    expect(Number.isInteger(value)).toBe(true);
  }
}

describe('GET /public/plans', () => {
  it('answers a visitor who has not signed in', async () => {
    const res = await request(app).get('/api/v1/public/plans').expect(200);
    expectPricing(res.body as Pricing);
  });
});

describe('GET /billing/plans', () => {
  it('answers before payments are configured, rather than refusing', async () => {
    const res = await request(app)
      .get('/api/v1/billing/plans')
      .set('Cookie', user.cookie)
      .expect(200);
    expectPricing(res.body as Pricing);
  });

  it('matches the public list exactly', async () => {
    const [signedIn, visitor] = await Promise.all([
      request(app).get('/api/v1/billing/plans').set('Cookie', user.cookie),
      request(app).get('/api/v1/public/plans'),
    ]);
    expect(signedIn.body).toEqual(visitor.body);
  });
});
