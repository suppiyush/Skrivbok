/**
 * Admin routes.
 *
 * `requireAuth` then `requireAdmin` are applied to the whole router, so a route
 * added later is protected by default rather than by remembering to add a
 * guard. This is the single most important line in the module: the legacy admin
 * API had no equivalent, and every one of its endpoints — including user
 * deletion — was open to anyone.
 */
import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { idParamSchema, paginationSchema, validate } from '../../middleware/validate.js';
import * as controller from './admin.controller.js';
import {
  analyticsSchema,
  deleteUserSchema,
  listPaymentsSchema,
  listReportsSchema,
  listUsersSchema,
  updateReportSchema,
  updateUserSchema,
} from './admin.schema.js';

export const adminRouter: Router = Router();

adminRouter.use(requireAuth, requireAdmin);

// ── Dashboard ─────────────────────────────────────────────────────────────────
adminRouter.get('/stats', controller.stats);
adminRouter.get('/analytics', validate({ query: analyticsSchema }), controller.analytics);
adminRouter.post('/mail/test', controller.testMail);

// ── Users ─────────────────────────────────────────────────────────────────────
adminRouter.get('/users', validate({ query: listUsersSchema }), controller.listUsers);
adminRouter.get('/users/:id', validate({ params: idParamSchema }), controller.getUser);
adminRouter.patch(
  '/users/:id',
  validate({ params: idParamSchema, body: updateUserSchema }),
  controller.updateUser,
);
// Typed confirmation in the body — see deleteUserSchema.
adminRouter.delete(
  '/users/:id',
  validate({ params: idParamSchema, body: deleteUserSchema }),
  controller.deleteUser,
);
adminRouter.post(
  '/users/:id/revoke-sessions',
  validate({ params: idParamSchema }),
  controller.revokeSessions,
);

// ── Billing ───────────────────────────────────────────────────────────────────
adminRouter.get(
  '/subscriptions',
  validate({ query: paginationSchema }),
  controller.listSubscriptions,
);
adminRouter.get('/payments', validate({ query: listPaymentsSchema }), controller.listPayments);

// ── Reports ───────────────────────────────────────────────────────────────────
adminRouter.get('/reports', validate({ query: listReportsSchema }), controller.listReports);
adminRouter.get('/reports/:id', validate({ params: idParamSchema }), controller.getReport);
adminRouter.patch(
  '/reports/:id',
  validate({ params: idParamSchema, body: updateReportSchema }),
  controller.updateReport,
);

/**
 * Landing-page counters. Public and deliberately coarse — see publicStats.
 * Declared here because it shares the analytics service, but it is not admin.
 */
export const publicStatsRouter: Router = Router();

publicStatsRouter.get('/stats', controller.publicStats);
