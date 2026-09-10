/**
 * Auth controllers: HTTP in, HTTP out.
 *
 * No SQL and no authorization decisions here — those belong to the service.
 * Input arrives already validated by `validate()`, so nothing is re-checked.
 */
import type { Request, RequestHandler, Response } from 'express';
import { env } from '../../config/env.js';
import { createLogger } from '../../config/logger.js';
import { currentUser } from '../../middleware/auth.js';
import { BadRequestError, UnauthorizedError } from '../../utils/errors.js';
import type {
  ChangePasswordInput,
  GoogleCallbackQuery,
  LoginInput,
  RegisterInput,
  SetPasswordInput,
  UpdateMeInput,
} from './auth.schema.js';
import * as authService from './auth.service.js';
import * as google from './google.service.js';
import {
  clearSessionCookie,
  createSession,
  revokeAllSessions,
  revokeSession,
  setSessionCookie,
} from './session.service.js';

const log = createLogger('auth');

/** Everything needed to tie a session to the device that created it. */
function sessionContext(req: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

/** Issue a session and attach the cookie. Used by register, login and OAuth. */
async function startSession(req: Request, res: Response, userId: string): Promise<void> {
  const token = await createSession(userId, sessionContext(req));
  setSessionCookie(res, token);
}

// ── Password auth ─────────────────────────────────────────────────────────────

export const register: RequestHandler = async (req, res) => {
  const user = await authService.register(req.body as RegisterInput);
  await startSession(req, res, user.id);
  res.status(201).json({ user });
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body as LoginInput;
  const user = await authService.login(email, password);
  await startSession(req, res, user.id);
  res.json({ user });
};

export const logout: RequestHandler = async (req, res) => {
  if (req.sessionId) {
    await revokeSession(req.sessionId);
  }
  clearSessionCookie(res);
  // 204: nothing to say, and the client should not expect a body.
  res.status(204).end();
};

export const logoutAll: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const revoked = await revokeAllSessions(user.id);
  clearSessionCookie(res);
  res.json({ revokedSessions: revoked });
};

// ── Account ───────────────────────────────────────────────────────────────────

export const me: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ user: await authService.getMe(user.id) });
};

export const updateMe: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ user: await authService.updateMe(user.id, req.body as UpdateMeInput) });
};

export const changePassword: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  if (!req.sessionId) throw new UnauthorizedError('You must be signed in to do that');

  const result = await authService.changePassword(
    user.id,
    req.body as ChangePasswordInput,
    req.sessionId,
  );
  res.json(result);
};

export const setPassword: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  if (!req.sessionId) throw new UnauthorizedError('You must be signed in to do that');

  const { newPassword } = req.body as SetPasswordInput;
  const result = await authService.setPassword(user.id, newPassword, req.sessionId);
  res.json(result);
};

// ── Google OAuth ──────────────────────────────────────────────────────────────

export const googleStart: RequestHandler = (_req, res) => {
  const state = google.createState();

  // The state is stored in an httpOnly cookie and compared on the way back, so
  // a callback the user's browser did not initiate is rejected.
  res.cookie(google.OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: google.OAUTH_STATE_TTL_MS,
  });

  res.redirect(google.buildAuthUrl(state));
};

/**
 * The OAuth callback is reached by a browser redirect, not by fetch, so failures
 * cannot be reported as JSON — the user would see a raw error document. Instead
 * every outcome redirects back to the frontend, success or failure.
 */
export const googleCallback: RequestHandler = async (req, res) => {
  const query = req.query as GoogleCallbackQuery;
  const stateCookie = (req.cookies as Record<string, string> | undefined)?.[
    google.OAUTH_STATE_COOKIE
  ];

  res.clearCookie(google.OAUTH_STATE_COOKIE, { path: '/' });

  const fail = (reason: string, detail?: unknown): void => {
    log.warn({ reason, detail }, 'Google sign-in failed');
    res.redirect(`${env.webUrl}/login?error=${encodeURIComponent(reason)}`);
  };

  // The user pressed "cancel" on Google's consent screen.
  if (query.error) {
    fail('google_declined', query.error);
    return;
  }

  if (!query.code || !query.state) {
    fail('google_incomplete');
    return;
  }

  if (!stateCookie || stateCookie !== query.state) {
    // Either the cookie expired, or this callback was not started by this
    // browser. Both are refusals.
    fail('google_state_mismatch');
    return;
  }

  try {
    const accessToken = await google.exchangeCode(query.code);
    const identity = await google.fetchIdentity(accessToken);
    const user = await authService.findOrCreateGoogleUser(identity);
    await startSession(req, res, user.id);

    // No identity is passed in the URL. The legacy app redirected to
    // `?oauth=true&email=…&name=…`, which let anyone sign in as anybody by
    // typing that URL. The session cookie is now the only evidence of identity;
    // the frontend calls GET /auth/me to find out who it is.
    res.redirect(`${env.webUrl}/dashboard`);
  } catch (error) {
    fail('google_failed', error instanceof Error ? error.message : String(error));
  }
};

/** Lets the login page hide the Google button when the server has no keys. */
export const authConfig: RequestHandler = (_req, res) => {
  res.json({ googleEnabled: google.isGoogleEnabled() });
};

/** Guard for the Google routes when the integration is not configured. */
export const requireGoogleEnabled: RequestHandler = (_req, _res, next) => {
  if (!google.isGoogleEnabled()) {
    next(new BadRequestError('Google sign-in is not configured on this server'));
    return;
  }
  next();
};
