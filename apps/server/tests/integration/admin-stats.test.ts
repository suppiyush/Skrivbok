/**
 * The admin overview says what the database says.
 *
 * Known rows go in; every headline figure, content count, and adoption share
 * is checked against what was put there. The point is not that the arithmetic
 * is hard — it is that a dashboard nobody has checked against known data is a
 * dashboard nobody can trust.
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
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  await resetDatabase();
  admin = await createUser('admin@example.com');
  await makeAdmin(admin.id);
  alice = await createUser('alice@example.com');
  bob = await createUser('bob@example.com');

  // Alice: PRO, two projects, one idea. Bob: free, one deadline, never signed in.
  await prisma.user.update({
    where: { id: alice.id },
    data: { plan: 'PRO', subscriptionEndsAt: new Date(Date.now() + 10 * 86_400_000) },
  });
  await prisma.user.update({ where: { id: bob.id }, data: { lastLoginAt: null } });

  const as = (u: TestUser) => (path: string, body: object) =>
    request(app).post(`/api/v1/${path}`).set('Cookie', u.cookie).send(body).expect(201);

  await as(alice)('projects', { name: 'One' });
  await as(alice)('projects', { name: 'Two' });
  await as(alice)('ideas', { title: 'An idea' });
  await as(bob)('deadlines', { title: 'A deadline', dueAt: '2028-01-01T09:00:00Z' });

  // Two payments: one captured, one failed. Only the captured one is revenue.
  await prisma.payment.createMany({
    data: [
      {
        userId: alice.id,
        razorpayOrderId: 'order_1',
        amount: 49_900,
        status: 'CAPTURED',
        plan: 'MONTHLY',
      },
      {
        userId: alice.id,
        razorpayOrderId: 'order_2',
        amount: 49_900,
        status: 'FAILED',
        plan: 'MONTHLY',
      },
    ],
  });
});

afterAll(disconnect);

const get = (path: string) =>
  request(app).get(`/api/v1/admin/${path}`).set('Cookie', admin.cookie).expect(200);

describe('overview', () => {
  it('is for admins only', async () => {
    await request(app).get('/api/v1/admin/stats').set('Cookie', alice.cookie).expect(403);
  });

  it('counts users, plans and sign-ins as they are', async () => {
    const stats = (await get('stats')).body as {
      users: Record<string, number>;
      engagement: Record<string, number>;
    };
    expect(stats.users).toMatchObject({ total: 3, pro: 1, free: 2, admins: 1, newThisWeek: 3 });
    // The admin and Alice signed in when created; Bob was reset to never.
    expect(stats.users['activeThisWeek']).toBe(2);
    expect(stats.engagement).toMatchObject({ withProjects: 1, neverLoggedIn: 1 });
  });

  it('counts content and revenue as they are', async () => {
    const stats = (await get('stats')).body as {
      content: Record<string, number>;
      revenue: Record<string, number>;
    };
    expect(stats.content).toMatchObject({ projects: 2, ideas: 1, deadlines: 1, notes: 0 });
    expect(stats.revenue).toMatchObject({
      capturedPaise: 49_900,
      capturedCount: 1,
      failedCount: 1,
    });
  });

  it('reports adoption as how many users have used each area', async () => {
    const analytics = (await get('analytics?days=30')).body as {
      featureAdoption: { feature: string; users: number }[];
      revenue: { paise: number }[];
      signups: { count: number }[];
    };
    const adoption = Object.fromEntries(analytics.featureAdoption.map((f) => [f.feature, f.users]));
    expect(adoption).toMatchObject({ projects: 1, ideas: 1, deadlines: 1, notes: 0 });

    // The thirty-day series sum to the same things the overview shows.
    expect(analytics.revenue.reduce((s, d) => s + d.paise, 0)).toBe(49_900);
    expect(analytics.signups.reduce((s, d) => s + d.count, 0)).toBe(3);
  });
});

describe('users and subscriptions', () => {
  it('lists accounts with their content counted, and filters by plan and role', async () => {
    const all = (await get('users')).body as {
      data: { email: string }[];
      pagination: { total: number };
    };
    expect(all.pagination.total).toBe(3);

    const pro = (await get('users?plan=PRO')).body as {
      data: { email: string; _count: { ownedProjects: number; ideas: number } }[];
    };
    expect(pro.data).toHaveLength(1);
    expect(pro.data[0]?.email).toBe(alice.email);
    expect(pro.data[0]?._count).toMatchObject({ ownedProjects: 2, ideas: 1 });

    const admins = (await get('users?role=ADMIN')).body as { data: { email: string }[] };
    expect(admins.data.map((u) => u.email)).toEqual([admin.email]);
  });

  it('lists PRO accounts with the days left, soonest first', async () => {
    const subs = (await get('subscriptions')).body as {
      data: { email: string; daysRemaining: number | null; isExpired: boolean }[];
    };
    expect(subs.data).toHaveLength(1);
    expect(subs.data[0]?.email).toBe(alice.email);
    expect(subs.data[0]?.isExpired).toBe(false);
    expect(subs.data[0]?.daysRemaining).toBeGreaterThanOrEqual(9);
    expect(subs.data[0]?.daysRemaining).toBeLessThanOrEqual(10);
  });
});
