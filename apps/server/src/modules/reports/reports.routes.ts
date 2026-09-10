/**
 * Report routes.
 *
 * Submission uses the stricter rate-limit bucket: it is an unauthenticated-ish
 * write path in spirit (any signed-in user can post freely), and the legacy
 * equivalent had no limit at all, so it was an open channel into the
 * maintainers' inbox.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { expensiveLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './reports.controller.js';
import { createReportSchema, listOwnReportsSchema } from './reports.schema.js';

export const reportsRouter: Router = Router();

reportsRouter.use(requireAuth);

reportsRouter.get('/', validate({ query: listOwnReportsSchema }), controller.listOwn);
reportsRouter.post(
  '/',
  expensiveLimiter,
  validate({ body: createReportSchema }),
  controller.create,
);
