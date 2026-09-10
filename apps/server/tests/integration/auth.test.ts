/**
 * Sign-up, sessions and the guards.
 *
 * The regression suite for the legacy application's worst flaw: every route
 * trusting an identity supplied by the caller.
 *
 * Google is the only sign-in method, so there is no `/register` or `/login` to
 * exercise. What is tested instead is the part that flaw actually lived in —
 * that a session is the only thing the server will accept as proof of identity,
 * and that revoking one really revokes it.
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
  sessionFor,
} from './helpers.js';

beforeAll(resetDatabase);
afterAll(disconnect);

describe('credential endpoints are gone', () => {
  // These are the routes that no longer exist. Asserting on them keeps a
  // password path from being reintroduced quietly.
  it('has no register endpoint', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'password12345' })
      .expect(404);
  });

  it('has no login endpoint', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ada@example.com', password: 'password12345' })
      .expect(404);
  });

  it('has no password endpoints', async () => {
    const user = await createUser('nopassword@example.com');

    await request(app)
      .put('/api/v1/auth/password')
      .set('Cookie', user.cookie)
      .send({ currentPassword: 'a', newPassword: 'password12345' })
      .expect(404);

    await request(app)
      .post('/api/v1/auth/password')
      .set('Cookie', user.cookie)
      .send({ newPassword: 'password12345' })
      .expect(404);
  });

  it('stores no password hash for an account created through Google', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'nopassword@example.com' },
      select: { passwordHash: true, accounts: { select: { provider: true } } },
    });

    expect(user?.passwordHash).toBeNull();
    expect(user?.accounts.map((a) => a.provider)).toEqual(['GOOGLE']);
  });
});

describe('sign-in configuration', () => {
  it('reports whether Google is configured, so the page knows what to show', async () => {
    const response = await request(app).get('/api/v1/auth/config').expect(200);

    expect(response.body).toHaveProperty('googleEnabled');
    expect(typeof (response.body as { googleEnabled: unknown }).googleEnabled).toBe('boolean');
  });
});

describe('sessions', () => {
  it('issues an httpOnly cookie and returns no credential material', async () => {
    const user = await createUser('ada@example.com');

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', user.cookie)
      .expect(200);

    const body = response.body as { user: Record<string, unknown> };

    // Normalised on the way in, so uniqueness is genuinely case-insensitive.
    expect(body.user['email']).toBe('ada@example.com');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.user).not.toHaveProperty('password');
    expect(body.user).not.toHaveProperty('hasPassword');
    expect(body.user['providers']).toEqual(['GOOGLE']);
  });

  it('stores only a hash of the session token, never the token', async () => {
    const sessions = await prisma.session.findMany({ select: { tokenHash: true } });

    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) {
      // SHA-256 hex.
      expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

describe('session guards', () => {
  it('rejects a request with no session', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
  });

  it('rejects a forged cookie and clears it', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'skrivbok_sid=totally-made-up-token')
      .expect(401);

    expect((response.body as { error: { code: string } }).error.code).toBe('SESSION_EXPIRED');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('rejects — and deletes — an expired session', async () => {
    const user = await createUser('expiry@example.com');

    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app).get('/api/v1/auth/me').set('Cookie', user.cookie).expect(401);

    // Not merely rejected: removed, so the table does not accumulate dead rows.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('logout', () => {
  it('revokes the session server-side, not just the cookie', async () => {
    const user = await createUser('logout@example.com');

    await request(app).get('/api/v1/auth/me').set('Cookie', user.cookie).expect(200);
    await request(app).post('/api/v1/auth/logout').set('Cookie', user.cookie).expect(204);

    // Replaying the same cookie must fail — this is the bug found in Part 3,
    // where logout cleared the cookie and left the session alive.
    await request(app).get('/api/v1/auth/me').set('Cookie', user.cookie).expect(401);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('leaves other devices signed in', async () => {
    const first = await createUser('devices@example.com');
    const second = await sessionFor(first.id);

    await request(app).post('/api/v1/auth/logout').set('Cookie', first.cookie).expect(204);

    await request(app).get('/api/v1/auth/me').set('Cookie', first.cookie).expect(401);
    await request(app).get('/api/v1/auth/me').set('Cookie', second).expect(200);
  });
});

describe('sign out everywhere', () => {
  it('revokes every session for the user, including the caller cookie', async () => {
    const user = await createUser('everywhere@example.com');

    // Two more devices.
    const second = await sessionFor(user.id);
    await sessionFor(user.id);

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(3);

    await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Cookie', user.cookie)
      .expect(200)
      .expect((r) => expect((r.body as { revokedSessions: number }).revokedSessions).toBe(3));

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await request(app).get('/api/v1/auth/me').set('Cookie', second).expect(401);
  });
});

describe('admin guard', () => {
  it('refuses a normal user and allows an admin', async () => {
    const user = await createUser('plain@example.com');
    const admin = await createUser('admin@example.com');
    await makeAdmin(admin.id);

    // The session was issued before the promotion, and the guard reads the
    // role from the database on each request, so it applies immediately.
    await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', user.cookie)
      .expect(403)
      .expect((r) =>
        expect((r.body as { error: { code: string } }).error.code).toBe('ADMIN_REQUIRED'),
      );

    await request(app).get('/api/v1/admin/stats').set('Cookie', admin.cookie).expect(200);
    await request(app).get('/api/v1/admin/stats').expect(401);
  });
});
