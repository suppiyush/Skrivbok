/**
 * Rate limiting.
 *
 * The legacy server had none: `/login` could be brute-forced and `/test-email`
 * could be used to send unlimited mail.
 *
 * Three buckets:
 *   • `generalLimiter`  — every API route, generous.
 *   • `authLimiter`     — the entry point of the Google sign-in flow, strict,
 *                         counts only failures so a working client is never
 *                         punished.
 *   • `expensiveLimiter`— routes that send mail or call a third party.
 *
 * Limits are enforced per IP. Note that this is in-process memory: with more
 * than one instance each holds its own counters. A shared Redis store is the
 * upgrade path if the app is ever scaled horizontally.
 */
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../config/env.js';
import { ErrorCode } from '../utils/errors.js';

/** Consistent 429 body, matching the shape the error handler produces. */
function limitResponse(message: string) {
  return {
    error: {
      code: ErrorCode.RATE_LIMITED,
      message,
    },
  };
}

const shared = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Health probes must never be throttled — a limiter tripping would take the
  // instance out of rotation.
  skip: (req: { path: string }) => req.path.startsWith('/health'),
} as const;

export const generalLimiter: RateLimitRequestHandler = rateLimit({
  ...shared,
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  message: limitResponse('Too many requests — please slow down and try again shortly.'),
});

export const authLimiter: RateLimitRequestHandler = rateLimit({
  ...shared,
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.authMax,
  // A successful sign-in does not consume the budget, so only guessing costs.
  skipSuccessfulRequests: true,
  message: limitResponse('Too many attempts. Please wait a few minutes and try again.'),
});

export const expensiveLimiter: RateLimitRequestHandler = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: limitResponse('You have made too many of these requests in the last hour.'),
});
