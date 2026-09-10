/**
 * Session lifecycle.
 *
 * Sessions are opaque random tokens, not JWTs:
 *
 *   • The cookie holds 32 random bytes, base64url-encoded.
 *   • The database stores only the SHA-256 hash of that token, so a database
 *     dump yields nothing an attacker can present as a cookie.
 *   • Because the server owns the record, a session can be revoked instantly —
 *     on logout, on "sign out everywhere", or by an admin. A JWT cannot be.
 *
 * Expiry slides: a session in active use is extended, an idle one lapses.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';

/** Bytes of entropy in a session token. 256 bits — not brute-forceable. */
const TOKEN_BYTES = 32;

/**
 * How stale `lastUsedAt` must be before a request refreshes it. Without this
 * throttle every authenticated request would issue a write.
 */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** The shape `requireAuth` puts on `req.user`. Never includes the password hash. */
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO';
  timezone: string;
}

export interface ResolvedSession {
  sessionId: string;
  user: SessionUser;
}

/** Tokens are looked up by hash, so the raw value is never stored or logged. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a session and return the raw token for the cookie. The raw token exists
 * only in this return value and the response header — never in the database.
 */
export async function createSession(
  userId: string,
  context: { ipAddress?: string | undefined; userAgent?: string | undefined } = {},
): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + env.session.ttlMs),
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent?.slice(0, 512) ?? null,
    },
  });

  return token;
}

/**
 * Resolve a raw token to its user, or null if it is unknown or expired.
 *
 * An expired session is deleted on sight rather than merely rejected, so the
 * table does not accumulate dead rows between cleanup runs.
 */
export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastUsedAt: true,
      user: {
        select: { id: true, email: true, name: true, role: true, plan: true, timezone: true },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {
      // A concurrent request may have deleted it already; that is the desired
      // end state either way.
    });
    return null;
  }

  // Slide the window, but only occasionally.
  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + env.session.ttlMs),
      },
    });
  }

  return { sessionId: session.id, user: session.user };
}

/** Revoke one session (logout on this device). */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

/**
 * Revoke every session for a user — "sign out everywhere".
 *
 * This is the only lever a user has if they suspect a cookie has been stolen:
 * sign-in is delegated to Google, so there is no password here to change. Every
 * session dies at once, including the caller's own.
 */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
    },
  });
  return result.count;
}

/** Delete lapsed sessions. Called by the maintenance job in Part 12. */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return result.count;
}

// ── Cookie handling ───────────────────────────────────────────────────────────

/**
 * `SameSite=Lax` lets the cookie ride along on the top-level redirect back from
 * Google, which `Strict` would block. `httpOnly` keeps it away from JavaScript,
 * so an XSS bug cannot read it — unlike the legacy app, which kept auth state in
 * `sessionStorage` where any script could both read and forge it.
 */
function cookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  domain?: string;
} {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    ...(env.session.cookieDomain ? { domain: env.session.cookieDomain } : {}),
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.session.cookieName, token, { ...cookieOptions(), maxAge: env.session.ttlMs });
}

export function clearSessionCookie(res: Response): void {
  // Options must match those used to set it, or the browser keeps the cookie.
  res.clearCookie(env.session.cookieName, cookieOptions());
}
