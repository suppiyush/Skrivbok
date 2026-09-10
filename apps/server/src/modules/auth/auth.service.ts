/**
 * Auth business rules.
 *
 * No function here reads `req` or writes `res`, and none of them accepts an
 * identity from the caller: `userId` always originates from a resolved session.
 */
import { prisma } from '../../db/prisma.js';
import { createLogger } from '../../config/logger.js';
import {
  BadRequestError,
  ConflictError,
  ErrorCode,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/errors.js';
import { fakeVerify, hashPassword, verifyPassword } from '../../utils/password.js';
import { sendWelcome } from '../../emails/index.js';
import { claimPendingInvites } from '../projects/index.js';
import { revokeAllSessions, type SessionUser } from './session.service.js';
import type { ChangePasswordInput, RegisterInput, UpdateMeInput } from './auth.schema.js';

const log = createLogger('auth');

/** Columns safe to return to a client. Deliberately excludes `passwordHash`. */
const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  plan: true,
  timezone: true,
  subscriptionEndsAt: true,
  createdAt: true,
} as const;

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO';
  timezone: string;
  subscriptionEndsAt: Date | null;
  createdAt: Date;
};

/** Additional flags the frontend needs but which are not stored columns. */
export interface MeResponse extends PublicUser {
  /** False for accounts created through Google that never set one. */
  hasPassword: boolean;
  /** Linked identity providers, so the UI can offer "set a password". */
  providers: string[];
}

// ── Registration ──────────────────────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true },
  });

  if (existing) {
    // Deliberate trade-off: this confirms an email is registered. The
    // alternative — a generic "check your inbox" — needs email verification to
    // be honest, and would break the immediate-login flow the app relies on.
    throw new ConflictError('An account with that email already exists', ErrorCode.EMAIL_TAKEN);
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      timezone: input.timezone ?? 'UTC',
      // Every user gets notification preferences up front, so the reminder
      // worker never has to cope with a missing row.
      emailPreference: { create: {} },
    },
    select: publicUserSelect,
  });

  // Someone may have been invited to a project before they had an account.
  await claimPendingInvites(user.id, user.email);

  sendWelcome(user.email, user.name ?? user.email);

  log.info({ userId: user.id }, 'User registered');
  return user;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...publicUserSelect, passwordHash: true },
  });

  // Both failure branches below burn the same CPU time as a real comparison and
  // return the same message, so neither timing nor wording reveals whether an
  // account exists.
  if (!user?.passwordHash) {
    await fakeVerify();
    throw new UnauthorizedError('Incorrect email or password', ErrorCode.INVALID_CREDENTIALS);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new UnauthorizedError('Incorrect email or password', ErrorCode.INVALID_CREDENTIALS);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { passwordHash: _passwordHash, ...publicUser } = user;
  log.info({ userId: user.id }, 'User signed in');
  return publicUser;
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

export interface GoogleIdentity {
  /** Google's stable `sub` claim — not the email, which a user can change. */
  providerAccountId: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

/**
 * Find or create the user behind a Google identity.
 *
 * Three cases:
 *   1. The provider link already exists  → sign that user in.
 *   2. No link, but the email matches an account → link the provider to it.
 *      Only done when Google reports the address as verified; otherwise anyone
 *      able to create a Google account with an unverified address could take
 *      over the matching Skrivbok account.
 *   3. Neither → create a new user with no password.
 */
export async function findOrCreateGoogleUser(identity: GoogleIdentity): Promise<PublicUser> {
  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: 'GOOGLE',
        providerAccountId: identity.providerAccountId,
      },
    },
    select: { user: { select: publicUserSelect } },
  });

  if (linked) {
    await prisma.user.update({
      where: { id: linked.user.id },
      data: {
        lastLoginAt: new Date(),
        // Backfill a name for accounts that registered without one.
        ...(linked.user.name ? {} : { name: identity.name }),
      },
    });
    return linked.user;
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: identity.email },
    select: publicUserSelect,
  });

  if (byEmail) {
    if (!identity.emailVerified) {
      throw new BadRequestError(
        'Your Google account email is not verified, so it cannot be linked to an existing Skrivbok account.',
      );
    }

    await prisma.$transaction([
      prisma.oAuthAccount.create({
        data: {
          userId: byEmail.id,
          provider: 'GOOGLE',
          providerAccountId: identity.providerAccountId,
        },
      }),
      prisma.user.update({
        where: { id: byEmail.id },
        data: {
          lastLoginAt: new Date(),
          emailVerifiedAt: new Date(),
          ...(byEmail.name ? {} : { name: identity.name }),
        },
      }),
    ]);

    log.info({ userId: byEmail.id }, 'Linked Google identity to existing account');
    return byEmail;
  }

  const created = await prisma.user.create({
    data: {
      email: identity.email,
      name: identity.name,
      // No password: the account is OAuth-only until the user sets one.
      passwordHash: null,
      emailVerifiedAt: identity.emailVerified ? new Date() : null,
      lastLoginAt: new Date(),
      emailPreference: { create: {} },
      accounts: {
        create: { provider: 'GOOGLE', providerAccountId: identity.providerAccountId },
      },
    },
    select: publicUserSelect,
  });

  await claimPendingInvites(created.id, created.email);

  log.info({ userId: created.id }, 'User registered via Google');
  return created;
}

// ── Account management ────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<MeResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...publicUserSelect,
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });

  if (!user) throw new NotFoundError('User');

  const { passwordHash, accounts, ...rest } = user;
  return {
    ...rest,
    hasPassword: passwordHash !== null,
    providers: accounts.map((a) => a.provider),
  };
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    },
    select: publicUserSelect,
  });
}

/**
 * Change a password, then revoke every other session.
 *
 * The revocation is the point: if someone changes their password because they
 * suspect their account is compromised, any cookie the attacker holds must stop
 * working immediately. The caller's own session is kept so they are not signed
 * out of the device they are using.
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  currentSessionId: string,
): Promise<{ revokedSessions: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) throw new NotFoundError('User');

  if (!user.passwordHash) {
    throw new BadRequestError(
      'This account signs in with Google and has no password yet. Set one instead.',
    );
  }

  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new UnauthorizedError(
      'Your current password is incorrect',
      ErrorCode.INVALID_CREDENTIALS,
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });

  const revokedSessions = await revokeAllSessions(userId, currentSessionId);
  log.info({ userId, revokedSessions }, 'Password changed');
  return { revokedSessions };
}

/** Set a first password on an OAuth-only account. */
export async function setPassword(
  userId: string,
  newPassword: string,
  currentSessionId: string,
): Promise<{ revokedSessions: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) throw new NotFoundError('User');

  if (user.passwordHash) {
    throw new ConflictError(
      'This account already has a password. Use the change-password endpoint instead.',
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  const revokedSessions = await revokeAllSessions(userId, currentSessionId);
  log.info({ userId }, 'Password set on OAuth account');
  return { revokedSessions };
}

/** Map a full user record down to what a session carries. */
export function toSessionUser(user: PublicUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    timezone: user.timezone,
  };
}
