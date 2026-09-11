/** Billing: HTTP in, HTTP out. */
import type { RequestHandler } from 'express';
import { notifyAdmins } from '../notifications/notify.js';
import { createLogger } from '../../config/logger.js';
import { currentUser } from '../../middleware/auth.js';
import { BadRequestError, ErrorCode, ForbiddenError } from '../../utils/errors.js';
import type { Pagination } from '../../middleware/validate.js';
import type { StartOrderInput, VerifyCheckoutInput } from './billing.schema.js';
import * as service from './billing.service.js';
import { getLimitStatus } from './limits.service.js';
import { isBillingEnabled, verifyWebhookSignature } from './razorpay.js';

const log = createLogger('billing');

export const plans: RequestHandler = (_req, res) => {
  res.json(service.plans());
};

export const subscription: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ ...(await service.subscription(user.id)), billingEnabled: isBillingEnabled() });
};

/** Everything the upgrade screen needs to show "3 of 5 used" per resource. */
export const usage: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const [projects, careerGoals, literature] = await Promise.all([
    getLimitStatus(user.id, 'projects'),
    getLimitStatus(user.id, 'careerGoals'),
    getLimitStatus(user.id, 'literature'),
  ]);
  res.json({ projects, careerGoals, literature });
};

export const startOrder: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { plan } = req.body as StartOrderInput;
  res.status(201).json(await service.startOrder(user.id, plan));
};

export const verifyCheckout: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.verifyCheckout(user.id, req.body as VerifyCheckoutInput));
};

export const payments: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.payments(user.id, req.query as unknown as Pagination));
};

/**
 * The Razorpay webhook.
 *
 * Unauthenticated by design — the signature *is* the authentication. Three
 * things happen before any state changes:
 *
 *   1. The raw body must be present (captured by the JSON parser in app.ts).
 *      Verifying against re-serialised JSON would never match.
 *   2. The signature must verify against the webhook secret.
 *   3. The event id must not have been seen before.
 *
 * A 200 is returned for anything that was received and understood, including
 * duplicates — Razorpay retries on non-2xx, and retrying a duplicate is waste.
 */
export const webhook: RequestHandler = async (req, res) => {
  const signature = req.get('x-razorpay-signature');

  if (!req.rawBody) {
    log.error('Webhook received without a raw body — check the body parser configuration');
    throw new BadRequestError('Malformed webhook request');
  }

  if (!signature || !verifyWebhookSignature(req.rawBody, signature)) {
    log.warn({ ip: req.ip }, 'Webhook signature verification failed');
    // Either someone is probing the endpoint or the secret is wrong; both
    // deserve a person looking, and neither shows up anywhere else.
    void notifyAdmins({
      title: 'A payment webhook was rejected',
      message: 'Its signature did not verify. Check the webhook secret, or who is calling it.',
      link: '/admin',
    });
    throw new ForbiddenError('Invalid webhook signature', ErrorCode.FORBIDDEN);
  }

  // Razorpay's own delivery id, used as the idempotency key.
  const eventId = req.get('x-razorpay-event-id') ?? `${Date.now()}-${signature.slice(0, 16)}`;

  const result = await service.handleWebhook(eventId, req.body as Record<string, unknown>);
  res.json({ received: true, ...result });
};
