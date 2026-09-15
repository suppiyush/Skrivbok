/**
 * The `/api/v1` router.
 *
 * This file is the complete index of the public API: every module router is
 * mounted here and nowhere else, so the routing surface can be read at a glance.
 * The legacy server declared ~115 routes inline across 4,600 lines, and had
 * duplicate definitions nobody noticed.
 *
 * Versioning under `/api/v1` means a future breaking change can ship as `/v2`
 * while the old clients keep working.
 */
import { Router } from 'express';
import { authRouter } from '../modules/auth/index.js';
import { adminRouter, publicStatsRouter } from '../modules/admin/index.js';
import {
  billingRouter,
  billingWebhookRouter,
  publicPlansRouter,
} from '../modules/billing/index.js';
import { calendarRouter } from '../modules/calendar/index.js';
import { careerGoalsRouter } from '../modules/career-goals/index.js';
import { deadlinesRouter } from '../modules/deadlines/index.js';
import { futureWorkRouter } from '../modules/future-work/index.js';
import { ideasRouter } from '../modules/ideas/index.js';
import { internalRouter } from '../modules/internal/index.js';
import { journalRouter } from '../modules/journal/index.js';
import { literatureRouter } from '../modules/literature/index.js';
import { notesRouter } from '../modules/notes/index.js';
import { notificationsRouter } from '../modules/notifications/index.js';
import { profileRouter } from '../modules/profile/index.js';
import { projectsRouter } from '../modules/projects/index.js';
import { reportsRouter } from '../modules/reports/index.js';
import { searchRouter } from '../modules/search/index.js';
import {
  adminReviewsRouter,
  publicReviewsRouter,
  reviewsRouter,
} from '../modules/reviews/index.js';

export const apiRouter: Router = Router();

// ── Module routers ────────────────────────────────────────────────────────────
apiRouter.use('/auth', authRouter);
apiRouter.use('/ideas', ideasRouter);
apiRouter.use('/notes', notesRouter);
apiRouter.use('/journal', journalRouter);
apiRouter.use('/deadlines', deadlinesRouter);
apiRouter.use('/future-work', futureWorkRouter);
apiRouter.use('/literature', literatureRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/career-goals', careerGoalsRouter);
apiRouter.use('/calendar', calendarRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/reviews', reviewsRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/admin/reviews', adminReviewsRouter);
// Unauthenticated: the provider signature authenticates these.
apiRouter.use('/webhooks', billingWebhookRouter);
// Scheduled passes for hosts without a worker process; secret-gated.
apiRouter.use('/internal', internalRouter);
// Public: reachable without a session. Approved reviews and coarse counters
// are the only things the marketing site reads.
apiRouter.use('/public', publicReviewsRouter);
apiRouter.use('/public', publicStatsRouter);
apiRouter.use('/public', publicPlansRouter);

// Added as each part lands:
//

/** Cheap endpoint for the frontend to confirm which API version it reached. */
apiRouter.get('/', (_req, res) => {
  res.json({ api: 'skrivbok', version: 'v1' });
});
