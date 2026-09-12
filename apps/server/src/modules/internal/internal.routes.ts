/**
 * Scheduled work over HTTP.
 *
 * The reminder worker (`jobs/worker.ts`) is a long-lived process with a cron
 * loop. A serverless host has no such process, so these routes expose the same
 * passes to an external scheduler — Vercel Cron, cron-job.org, a GitHub Action
 * — which calls them on a timer. The passes themselves are unchanged and
 * idempotent: a call that comes twice, or late, sends nothing twice.
 *
 * Callers prove themselves with a shared secret, compared in constant time.
 * With no secret configured the routes answer 404, as if they did not exist —
 * a deployment that runs the real worker has no reason to expose them.
 */
import { timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { runCleanup, runReminderTick } from '../../jobs/reminders.service.js';
import { NotFoundError, UnauthorizedError } from '../../utils/errors.js';

function bearerMatches(header: string | undefined, secret: string): boolean {
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const left = Buffer.from(token);
  const right = Buffer.from(secret);
  // Length is compared first because `timingSafeEqual` throws on a mismatch.
  return left.length === right.length && timingSafeEqual(left, right);
}

const requireCronSecret: RequestHandler = (req, _res, next) => {
  const secret = env.reminders.cronSecret;
  if (!secret) {
    next(new NotFoundError('Route'));
    return;
  }
  if (!bearerMatches(req.headers.authorization, secret)) {
    next(new UnauthorizedError('Invalid scheduler credentials'));
    return;
  }
  next();
};

export const internalRouter: Router = Router();

internalRouter.use(requireCronSecret);

// GET as well as POST: Vercel Cron and most free schedulers only send GET.
const tick: RequestHandler = async (_req, res) => {
  res.json(await runReminderTick());
};
const cleanup: RequestHandler = async (_req, res) => {
  res.json(await runCleanup());
};

internalRouter.get('/reminders/tick', tick);
internalRouter.post('/reminders/tick', tick);
internalRouter.get('/cleanup', cleanup);
internalRouter.post('/cleanup', cleanup);
