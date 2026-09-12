/**
 * The admin's "Send test email" button.
 *
 * The test environment has no mail provider configured, so the interesting
 * assertion is that the endpoint says so honestly rather than pretending, and
 * that it only ever addresses the caller — an admin cannot use it to mail a
 * third party.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  app,
  createUser,
  disconnect,
  makeAdmin,
  request,
  resetDatabase,
  type TestUser,
} from './helpers.js';

let admin: TestUser;
let user: TestUser;

beforeAll(async () => {
  await resetDatabase();
  admin = await createUser('admin@example.com');
  await makeAdmin(admin.id);
  user = await createUser('user@example.com');
});

afterAll(disconnect);

describe('POST /admin/mail/test', () => {
  it('reports that mail is not configured, addressed to the admin', async () => {
    const res = await request(app)
      .post('/api/v1/admin/mail/test')
      .set('Cookie', admin.cookie)
      .expect(200);

    expect(res.body).toEqual({ to: admin.email, sent: false, skipped: 'mail-disabled' });
  });

  it('ignores any address in the body', async () => {
    const res = await request(app)
      .post('/api/v1/admin/mail/test')
      .set('Cookie', admin.cookie)
      .send({ to: 'someone-else@example.com' })
      .expect(200);

    expect((res.body as { to: string }).to).toBe(admin.email);
  });

  it('is for administrators only', async () => {
    await request(app).post('/api/v1/admin/mail/test').set('Cookie', user.cookie).expect(403);
  });
});
