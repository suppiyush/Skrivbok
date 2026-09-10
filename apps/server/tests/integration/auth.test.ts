/**
 * Auth, sessions and the guards.
 *
 * The regression suite for the legacy application's worst flaw: every route
 * trusting an identity supplied by the caller.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  app,
  disconnect,
  makeAdmin,
  prisma,
  registerUser,
  request,
  resetDatabase,
} from './helpers.js';

beforeAll(resetDatabase);
afterAll(disconnect);

describe('registration and login', () => {
  it('registers, sets an httpOnly session cookie, and returns no password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Ada', email: 'Ada@Example.COM', password: 'password12345' })
      .expect(201);

    const body = response.body as { user: Record<string, unknown> };

    // Normalised on the way in, so uniqueness is genuinely case-insensitive.
    expect(body.user['email']).toBe('ada@example.com');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.user).not.toHaveProperty('password');

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const session = cookies.find((c) => c.startsWith('skrivbok_sid='));

    expect(session).toContain('HttpOnly');
    expect(session).toContain('SameSite=Lax');
  });

  it('stores only a hash of the session token, never the token', async () => {
    const sessions = await prisma.session.findMany({ select: { tokenHash: true } });

    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) {
      // SHA-256 hex.
      expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('rejects a duplicate email', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Impostor', email: 'ada@example.com', password: 'another-password' })
      .expect(409)
      .expect((r) =>
        expect((r.body as { error: { code: string } }).error.code).toBe('EMAIL_TAKEN'),
      );
  });

  it('rejects a short password', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Short', email: 'short@example.com', password: 'short' })
      .expect(422);
  });

  it('rejects an unrecognised timezone', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'X',
        email: 'tz@example.com',
        password: 'password12345',
        timezone: 'Mars/Olympus',
      })
      .expect(422);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ada@example.com', password: 'not-the-password' })
      .expect(401);

    const unknownAccount = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'not-the-password' })
      .expect(401);

    // Identical code and message: the response must not reveal which accounts
    // exist. (Timing is equalised separately by `fakeVerify`.)
    expect(unknownAccount.body).toMatchObject({
      error: { code: (wrongPassword.body as { error: { code: string } }).error.code },
    });
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
    const user = await registerUser('expiry@example.com');

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
    const user = await registerUser('logout@example.com');

    await request(app).get('/api/v1/auth/me').set('Cookie', user.cookie).expect(200);
    await request(app).post('/api/v1/auth/logout').set('Cookie', user.cookie).expect(204);

    // Replaying the same cookie must fail — this is the bug found in Part 3,
    // where logout cleared the cookie and left the session alive.
    await request(app).get('/api/v1/auth/me').set('Cookie', user.cookie).expect(401);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('leaves other devices signed in', async () => {
    const first = await registerUser('devices@example.com');

    const secondLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'devices@example.com', password: 'password12345' })
      .expect(200);

    const cookies = secondLogin.headers['set-cookie'] as unknown as string[];
    const second = (cookies.find((c) => c.startsWith('skrivbok_sid=')) ?? '').split(';')[0] ?? '';

    await request(app).post('/api/v1/auth/logout').set('Cookie', first.cookie).expect(204);

    await request(app).get('/api/v1/auth/me').set('Cookie', first.cookie).expect(401);
    await request(app).get('/api/v1/auth/me').set('Cookie', second).expect(200);
  });
});

describe('password change', () => {
  it('revokes every other session but keeps the current one', async () => {
    const user = await registerUser('pwchange@example.com');

    // A second and third device.
    for (let i = 0; i < 2; i += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'pwchange@example.com', password: 'password12345' })
        .expect(200);
    }

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(3);

    await request(app)
      .put('/api/v1/auth/password')
      .set('Cookie', user.cookie)
      .send({ currentPassword: 'password12345', newPassword: 'a-brand-new-password' })
      .expect(200)
      .expect((r) => expect((r.body as { revokedSessions: number }).revokedSessions).toBe(2));

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    await request(app).get('/api/v1/auth/me').set('Cookie', user.cookie).expect(200);
  });

  it('rejects a wrong current password', async () => {
    const user = await registerUser('pwwrong@example.com');

    await request(app)
      .put('/api/v1/auth/password')
      .set('Cookie', user.cookie)
      .send({ currentPassword: 'not-it', newPassword: 'a-brand-new-password' })
      .expect(401);
  });
});

describe('admin guard', () => {
  it('refuses a normal user and allows an admin', async () => {
    const user = await registerUser('plain@example.com');
    const admin = await registerUser('admin@example.com');
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
