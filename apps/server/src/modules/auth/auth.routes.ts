/**
 * Auth routes: path -> guards -> validation -> controller. No logic here.
 *
 * `authLimiter` sits on every credential-accepting endpoint. It counts only
 * failures, so a legitimate user is never locked out by signing in normally,
 * while brute-forcing stops after ten wrong guesses per window.
 */
import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import {
  changePasswordSchema,
  googleCallbackSchema,
  loginSchema,
  registerSchema,
  setPasswordSchema,
  updateMeSchema,
} from './auth.schema.js';

export const authRouter: Router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
authRouter.get('/config', controller.authConfig);

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);

// ── Google OAuth ──────────────────────────────────────────────────────────────
authRouter.get('/google', authLimiter, controller.requireGoogleEnabled, controller.googleStart);
authRouter.get(
  '/google/callback',
  controller.requireGoogleEnabled,
  validate({ query: googleCallbackSchema }),
  controller.googleCallback,
);

// ── Authenticated ─────────────────────────────────────────────────────────────
// `optionalAuth`, not `requireAuth`: signing out with an already-invalid cookie
// should clear it and succeed rather than fail with a 401 — but the session must
// still be resolved, or logout would only drop the cookie and leave the server
// -side session alive for anyone holding a copy of the token.
authRouter.post('/logout', optionalAuth, controller.logout);

authRouter.get('/me', requireAuth, controller.me);
authRouter.patch('/me', requireAuth, validate({ body: updateMeSchema }), controller.updateMe);

authRouter.post('/logout-all', requireAuth, controller.logoutAll);

authRouter.put(
  '/password',
  requireAuth,
  authLimiter,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);
authRouter.post(
  '/password',
  requireAuth,
  authLimiter,
  validate({ body: setPasswordSchema }),
  controller.setPassword,
);
