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
import { findOrCreateGoogleUser } from '../../src/modules/auth/auth.service.js';
import { createSession } from '../../src/modules/auth/session.service.js';
import { env } from '../../src/config/env.js';

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
 * Create a user and a signed-in session for them.
 *
 * Sign-up now happens inside the Google callback, and driving that over HTTP
 * would mean standing up a fake Google. Instead the two halves the callback is
 * made of are called directly — `findOrCreateGoogleUser` and `createSession` —
 * so the account really is created by the production sign-up path (invites are
 * claimed, the welcome mail fires) and the cookie really is a valid session
 * token, not a fixture that merely resembles one. Only the token exchange with
 * Google is skipped.
 */
export async function createUser(email: string): Promise<TestUser> {
  const normalised = email.toLowerCase();

  const user = await findOrCreateGoogleUser({
    providerAccountId: `google-sub-${normalised}`,
    email: normalised,
    name: normalised.split('@')[0] ?? null,
    emailVerified: true,
  });

  return { id: user.id, email: user.email, cookie: await sessionFor(user.id) };
}

/** A second session for an existing user, as signing in on another device would. */
export async function sessionFor(userId: string): Promise<string> {
  const token = await createSession(userId);
  return `${env.session.cookieName}=${token}`;
}

/** Promote a user to admin directly, since nothing in the API can do it first. */
export async function makeAdmin(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma, request };
