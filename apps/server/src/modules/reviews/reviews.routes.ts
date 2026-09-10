/**
 * Review routes.
 *
 * Split into three routers because they have three different audiences: the
 * author, the public site, and an admin. Mounting them together and guarding
 * per-route would make it far too easy to add an endpoint that forgets its
 * guard — the public one in particular exposes other people's words.
 */
import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './reviews.controller.js';
import { listReviewsSchema, moderateReviewSchema, upsertReviewSchema } from './reviews.schema.js';

/** The author's own review. */
export const reviewsRouter: Router = Router();
reviewsRouter.use(requireAuth);

reviewsRouter.get('/me', controller.getOwn);
reviewsRouter.put('/me', validate({ body: upsertReviewSchema }), controller.upsertOwn);
reviewsRouter.delete('/me', controller.removeOwn);

/** Approved reviews, for the landing page. No authentication. */
export const publicReviewsRouter: Router = Router();
publicReviewsRouter.get('/reviews', controller.listPublic);

/** Moderation. */
export const adminReviewsRouter: Router = Router();
adminReviewsRouter.use(requireAuth, requireAdmin);

adminReviewsRouter.get('/', validate({ query: listReviewsSchema }), controller.listAll);
adminReviewsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: moderateReviewSchema }),
  controller.moderate,
);
