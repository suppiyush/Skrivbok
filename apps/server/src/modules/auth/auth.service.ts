/**
 * Auth business rules.
 *
 * Google is the only way in. There is no password to register with, verify or
 * change, so the only identity this file resolves is the one Google asserts.
 *
 * No function here reads `req` or writes `res`, and none of them accepts an
 * identity from the caller: `userId` always originates from a resolved session.
 */
import { prisma } from '../../db/prisma.js';
import { entitled } from '../billing/limits.service.js';
import { createLogger } from '../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { sendWelcome } from '../../emails/index.js';
import { claimPendingInvites } from '../projects/index.js';
import type { SessionUser } from './session.service.js';
import type { UpdateMeInput } from './auth.schema.js';

const log = createLogger('auth');

/** An explicit allowlist of columns safe to return to a client. */
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
  /** Linked identity providers, so the UI can name how this account signs in. */
  providers: string[];
  /** What the account may do, not what it bought: true for PRO and for staff. */
  isPro: boolean;
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
 *      over the matching Skrivbok account. This is also how an account created
 *      before Google became the only sign-in method is adopted.
 *   3. Neither → create the account. This is the sign-up path: there is no
 *      separate registration endpoint.
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
      emailVerifiedAt: identity.emailVerified ? new Date() : null,
      lastLoginAt: new Date(),
      // Every user gets notification preferences up front, so the reminder
      // worker never has to cope with a missing row.
      emailPreference: { create: {} },
      accounts: {
        create: { provider: 'GOOGLE', providerAccountId: identity.providerAccountId },
      },
    },
    select: publicUserSelect,
  });

  // Someone may have been invited to a project before they had an account.
  await claimPendingInvites(created.id, created.email);

  // This is now the only moment an account comes into existence, so the welcome
  // email is sent from here rather than from a registration handler.
  sendWelcome(created.email, created.name ?? created.email);

  log.info({ userId: created.id }, 'User registered via Google');
  return created;
}

// ── Account management ────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<MeResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...publicUserSelect,
      accounts: { select: { provider: true } },
    },
  });

  if (!user) throw new NotFoundError('User');

  const { accounts, ...rest } = user;
  return { ...rest, providers: accounts.map((a) => a.provider), isPro: entitled(user) };
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
