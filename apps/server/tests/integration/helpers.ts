/**
 * Integration-test helpers.
 *
 * These tests drive the real Express app against the real `skrivbok_test`
 * database — no mocked Prisma. Mocking the database here would defeat the
 * point: most of what is being tested is whether a `where` clause actually
 * scopes a query, and a mock would happily agree that it does.
 */
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

export const app = createApp() as unknown as App;

/** Wipe every table between test files. Order does not matter — cascades handle it. */
export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.sentReminder.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.report.deleteMany(),
    prisma.calendarAccessRequest.deleteMany(),
    prisma.calendarAccess.deleteMany(),
    prisma.calendarEvent.deleteMany(),
    prisma.meetingRequest.deleteMany(),
    prisma.careerStageHistory.deleteMany(),
    prisma.careerGoal.deleteMany(),
    prisma.literature.deleteMany(),
    prisma.futureWork.deleteMany(),
    prisma.deadline.deleteMany(),
    prisma.journalEntry.deleteMany(),
    prisma.note.deleteMany(),
    prisma.idea.deleteMany(),
    prisma.projectBrief.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.emailPreference.deleteMany(),
    prisma.session.deleteMany(),
    prisma.oAuthAccount.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export interface TestUser {
  id: string;
  email: string;
  /** The raw `Set-Cookie` value, replayed on subsequent requests. */
  cookie: string;
}

/**
 * Pull the session cookie out of a response.
 *
 * Supertest types the `headers` bag loosely, so the shape is narrowed here once
 * rather than at every call site.
 */
export function sessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  const cookies: string[] = Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === 'string')
    : typeof raw === 'string'
      ? [raw]
      : [];

  const cookie = cookies.find((c) => c.startsWith('skrivbok_sid='));

  if (!cookie) throw new Error('Response carried no session cookie');
  return cookie.split(';')[0] ?? '';
}

/** Register a user and keep their session cookie. */
export async function registerUser(email: string, password = 'password12345'): Promise<TestUser> {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: email.split('@')[0], email, password })
    .expect(201);

  return {
    id: (response.body as { user: { id: string } }).user.id,
    email,
    cookie: sessionCookie(response),
  };
}

/** Promote a user to admin directly, since nothing in the API can do it first. */
export async function makeAdmin(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma, request };
