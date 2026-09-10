/**
 * Authentication and authorization guards.
 *
 * This file is the fix for the single worst flaw in the legacy application.
 * Previously every data route trusted an email supplied by the caller —
 * `GET /projects/victim@example.com` returned that person's projects, and
 * `DELETE /ideas/42` deleted whoever's idea 42 was.
 *
 * From here on the caller's identity comes from one place only: a signed,
 * httpOnly session cookie resolved against the database. `req.user` cannot be
 * set by any request. Services take `userId` from `req.user.id` and scope every
 * query by it.
 */
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ErrorCode, ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { clearSessionCookie, resolveSession } from '../modules/auth/session.service.js';

/** Read the session token from the cookie, falling back to a Bearer header. */
function extractToken(req: Parameters<RequestHandler>[0]): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  const fromCookie = cookies?.[env.session.cookieName];
  if (fromCookie) return fromCookie;

  // Supported for non-browser clients (scripts, integration tests). Browsers
  // always use the cookie, which is not readable by JavaScript.
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);

  return undefined;
}

/**
 * Require a valid session. Populates `req.user` and `req.sessionId`.
 *
 * Mount this on every route that touches user data — which is all of them
 * except registration, login, the Google callback, the health probes and the
 * Razorpay webhook.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    next(new UnauthorizedError('You must be signed in to do that'));
    return;
  }

  resolveSession(token).then((resolved) => {
    if (!resolved) {
      // The cookie is stale or forged. Clear it so the browser stops sending it
      // and the frontend can redirect to login cleanly.
      clearSessionCookie(res);
      next(
        new UnauthorizedError(
          'Your session has expired — please sign in again',
          ErrorCode.SESSION_EXPIRED,
        ),
      );
      return;
    }

    req.user = resolved.user;
    req.sessionId = resolved.sessionId;
    next();
  }, next);
};

/**
 * Populate `req.user` when a session exists, but allow the request through
 * either way. For endpoints whose response differs for signed-in users without
 * requiring them to be.
 */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  resolveSession(token).then((resolved) => {
    if (resolved) {
      req.user = resolved.user;
      req.sessionId = resolved.sessionId;
    }
    next();
  }, next);
};

/**
 * Require an administrator. Mount *after* `requireAuth`.
 *
 * The legacy admin API had no check at all: `DELETE /api/admin/users/:email`
 * was callable by anyone, and the "login" was a hardcoded string compared in
 * the browser.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(new UnauthorizedError('You must be signed in to do that'));
    return;
  }

  if (req.user.role !== 'ADMIN') {
    next(new ForbiddenError('Administrator access required', ErrorCode.ADMIN_REQUIRED));
    return;
  }

  next();
};

/**
 * Narrow `req.user` to non-null inside a controller mounted behind
 * `requireAuth`. Throws rather than returning undefined, so a guard accidentally
 * omitted from a route fails loudly instead of leaking data.
 */
export function currentUser(req: { user?: Express.AuthenticatedUser }): Express.AuthenticatedUser {
  if (!req.user) {
    throw new UnauthorizedError('You must be signed in to do that');
  }
  return req.user;
}
