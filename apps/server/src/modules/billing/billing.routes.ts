/**
 * Billing routes.
 *
 * The webhook is declared on a separate, unauthenticated router: it is called
 * by Razorpay, not by a browser, and its signature is what authenticates it.
 * Keeping it off the authenticated router means it cannot accidentally start
 * depending on a session.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { expensiveLimiter } from '../../middleware/rateLimit.js';
import { paginationSchema, validate } from '../../middleware/validate.js';
import * as controller from './billing.controller.js';
import { startOrderSchema, verifyCheckoutSchema } from './billing.schema.js';

export const billingRouter: Router = Router();

billingRouter.use(requireAuth);

billingRouter.get('/plans', controller.plans);
billingRouter.get('/subscription', controller.subscription);
billingRouter.get('/usage', controller.usage);
billingRouter.get('/payments', validate({ query: paginationSchema }), controller.payments);

// Order creation calls a third party, so it gets the stricter bucket.
billingRouter.post(
  '/orders',
  expensiveLimiter,
  validate({ body: startOrderSchema }),
  controller.startOrder,
);
billingRouter.post(
  '/verify',
  expensiveLimiter,
  validate({ body: verifyCheckoutSchema }),
  controller.verifyCheckout,
);

export const billingWebhookRouter: Router = Router();

billingWebhookRouter.post('/razorpay', controller.webhook);
