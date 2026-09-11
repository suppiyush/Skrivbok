/**
 * Subscriptions and payments.
 *
 * Three rules, each fixing something the legacy `/payment/verify` got wrong:
 *
 *  1. **The amount and plan come from the server.** The client sends only
 *     `"monthly"` or `"yearly"`; the price table lives in config.
 *  2. **The account upgraded is the session user's.** The old endpoint took an
 *     `email` from the request body, so a valid payment for one account could
 *     be redirected to another.
 *  3. **Nothing grants PRO without a verified signature**, and every grant is
 *     idempotent — Razorpay retries webhooks, and the browser callback can
 *     arrive at the same time as the webhook for the same payment.
 */
import { addMonths, addYears } from 'date-fns';
import type { BillingPlan, Payment, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { sendPaymentFailed, sendReceipt } from '../../emails/index.js';
import { notify, notifyAdmins } from '../notifications/notify.js';
import { createLogger } from '../../config/logger.js';
import type { Pagination } from '../../middleware/validate.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import { billingConfig, createOrder, fetchPayment, verifyCheckoutSignature } from './razorpay.js';

const log = createLogger('billing');

/** How long each plan extends a subscription. */
function extend(from: Date, plan: BillingPlan): Date {
  return plan === 'MONTHLY' ? addMonths(from, 1) : addYears(from, 1);
}

export function priceFor(plan: BillingPlan): number {
  const config = billingConfig();
  return plan === 'MONTHLY' ? config.prices.monthly : config.prices.yearly;
}

/** The public price list, so the client never invents an amount. */
export function plans(): {
  currency: string;
  plans: { id: BillingPlan; amountPaise: number; amountDisplay: string }[];
} {
  const config = billingConfig();
  const format = (paise: number): string => `${config.currency} ${(paise / 100).toFixed(2)}`;

  return {
    currency: config.currency,
    plans: [
      {
        id: 'MONTHLY',
        amountPaise: config.prices.monthly,
        amountDisplay: format(config.prices.monthly),
      },
      {
        id: 'YEARLY',
        amountPaise: config.prices.yearly,
        amountDisplay: format(config.prices.yearly),
      },
    ],
  };
}

// ── Orders ────────────────────────────────────────────────────────────────────

export interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  /** The publishable key id. Safe to send: it is not the secret. */
  keyId: string;
  plan: BillingPlan;
}

export async function startOrder(userId: string, plan: BillingPlan): Promise<OrderResponse> {
  // Staff already have everything; taking their money for it would be a bug
  // whichever way it happened. The button is hidden, and this is the check
  // behind the button.
  const buyer = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });
  if (buyer.role === 'ADMIN') {
    throw new BadRequestError('PRO is included with an admin account');
  }

  const config = billingConfig();
  const amountPaise = priceFor(plan);

  const order = await createOrder({
    amountPaise,
    currency: config.currency,
    receipt: `sk_${Date.now()}`,
    // `notes` come back on the webhook, which is how a webhook that arrives
    // before the local row is committed can still be matched to a user.
    notes: { userId, plan },
  });

  await prisma.payment.create({
    data: {
      userId,
      razorpayOrderId: order.id,
      plan,
      amount: amountPaise,
      currency: config.currency,
      status: 'CREATED',
    },
  });

  log.info({ userId, orderId: order.id, plan }, 'Payment order created');

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: config.keyId,
    plan,
  };
}

// ── Granting the subscription ─────────────────────────────────────────────────

/**
 * Mark a payment captured and extend the subscription. Idempotent.
 *
 * Re-entry is the normal case, not an edge case: the browser callback and the
 * webhook routinely describe the same payment. A payment already CAPTURED
 * returns without touching the subscription, so a retry cannot add a second
 * month.
 *
 * Extension is measured from the later of *now* and the current expiry, so
 * renewing early adds to the remaining time instead of discarding it.
 */
async function capturePayment(
  orderId: string,
  paymentId: string,
  signature: string | null,
): Promise<{ applied: boolean; payment: Payment }> {
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });

  if (!payment) throw new NotFoundError('Payment');

  if (payment.status === 'CAPTURED') {
    log.info({ orderId }, 'Payment already captured — ignoring duplicate');
    return { applied: false, payment };
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: payment.userId },
    select: { subscriptionEndsAt: true, email: true, name: true, timezone: true },
  });

  const now = new Date();
  const base =
    user.subscriptionEndsAt && user.subscriptionEndsAt > now ? user.subscriptionEndsAt : now;
  const periodEnd = extend(base, payment.plan);

  const [updated] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CAPTURED',
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        periodStart: now,
        periodEnd,
      },
    }),
    prisma.user.update({
      where: { id: payment.userId },
      data: { plan: 'PRO', subscriptionEndsAt: periodEnd },
    }),
  ]);

  await notify(payment.userId, {
    type: 'SUBSCRIPTION',
    title: 'Welcome to Skrivbok PRO',
    message: `Your subscription runs until ${periodEnd.toISOString().slice(0, 10)}.`,
    link: '/upgrade',
  });
  // A paid product without a receipt is a support ticket waiting to happen.
  sendReceipt(user.email, {
    name: user.name ?? user.email,
    plan: payment.plan,
    amountPaise: payment.amount,
    currency: payment.currency,
    periodStart: now,
    periodEnd,
    orderId,
    paymentId,
    timezone: user.timezone,
  });

  log.info({ orderId, userId: payment.userId, periodEnd }, 'Subscription activated');
  return { applied: true, payment: updated };
}

/**
 * The browser callback after Razorpay Checkout succeeds.
 *
 * The signature proves the payment is genuine, but the *order* is still checked
 * against the session user — a valid signature from someone else's payment must
 * not upgrade this account.
 */
export async function verifyCheckout(
  userId: string,
  input: { orderId: string; paymentId: string; signature: string },
): Promise<{ plan: string; subscriptionEndsAt: Date | null }> {
  if (!verifyCheckoutSignature(input.orderId, input.paymentId, input.signature)) {
    log.warn({ userId, orderId: input.orderId }, 'Invalid checkout signature');
    throw new BadRequestError('Payment could not be verified');
  }

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: input.orderId },
    select: { userId: true },
  });

  if (!payment) throw new NotFoundError('Payment');
  if (payment.userId !== userId) {
    log.warn({ userId, orderId: input.orderId }, 'Checkout verified for a different account');
    throw new ForbiddenError('That payment belongs to a different account');
  }

  // Confirm with Razorpay rather than trusting that a signed order id means the
  // money actually moved.
  const remote = await fetchPayment(input.paymentId);
  if (!remote || (remote.status !== 'captured' && remote.status !== 'authorized')) {
    throw new BadRequestError('That payment has not completed');
  }

  await capturePayment(input.orderId, input.paymentId, input.signature);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: true, subscriptionEndsAt: true },
  });

  return user;
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

interface WebhookPayload {
  event?: unknown;
  payload?: {
    payment?: { entity?: { id?: unknown; order_id?: unknown; error_description?: unknown } };
    refund?: { entity?: { payment_id?: unknown } };
  };
}

/**
 * Apply a verified webhook.
 *
 * The signature has already been checked by the controller. Here the event id
 * is recorded first: `WebhookEvent` has a unique constraint on
 * `(provider, eventId)`, so a redelivery hits it and the handler returns
 * without re-applying. That is the difference between "we usually only process
 * it once" and "we cannot process it twice".
 */
export async function handleWebhook(
  eventId: string,
  body: WebhookPayload,
): Promise<{ processed: boolean; reason?: string }> {
  const eventType = typeof body.event === 'string' ? body.event : 'unknown';

  const alreadySeen = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: 'razorpay', eventId } },
    select: { id: true },
  });

  if (alreadySeen) {
    log.info({ eventId, eventType }, 'Webhook already processed — ignoring redelivery');
    return { processed: false, reason: 'duplicate' };
  }

  await prisma.webhookEvent.create({
    data: {
      provider: 'razorpay',
      eventId,
      eventType,
      payload: body as Prisma.InputJsonValue,
    },
  });

  const entity = body.payload?.payment?.entity;
  const orderId = typeof entity?.order_id === 'string' ? entity.order_id : null;
  const paymentId = typeof entity?.id === 'string' ? entity.id : null;

  switch (eventType) {
    case 'payment.captured':
    case 'order.paid': {
      if (!orderId || !paymentId) return { processed: false, reason: 'missing ids' };
      await capturePayment(orderId, paymentId, null);
      return { processed: true };
    }

    case 'payment.failed': {
      if (!orderId) return { processed: false, reason: 'missing order id' };
      const reason =
        typeof entity?.error_description === 'string' ? entity.error_description : null;
      const failed = await prisma.payment.findUnique({
        where: { razorpayOrderId: orderId },
        select: { status: true, user: { select: { id: true, email: true, name: true } } },
      });
      await prisma.payment.updateMany({
        where: { razorpayOrderId: orderId, status: { in: ['CREATED', 'AUTHORIZED'] } },
        data: { status: 'FAILED', failureReason: reason },
      });
      if (failed && (failed.status === 'CREATED' || failed.status === 'AUTHORIZED')) {
        await notify(failed.user.id, {
          type: 'SUBSCRIPTION',
          title: 'Your payment did not go through',
          message: reason ?? 'Nothing was charged. You can try again.',
          link: '/upgrade',
        });
        sendPaymentFailed(failed.user.email, {
          name: failed.user.name ?? failed.user.email,
          reason,
        });
        await notifyAdmins({
          title: `Payment failed for ${failed.user.email}`,
          message: reason,
          link: '/admin?tab=subscriptions',
        });
      }
      return { processed: true };
    }

    case 'refund.processed': {
      const refundedPaymentId = body.payload?.refund?.entity?.payment_id;
      if (typeof refundedPaymentId !== 'string') return { processed: false, reason: 'missing id' };

      const payment = await prisma.payment.findUnique({
        where: { razorpayPaymentId: refundedPaymentId },
        select: { id: true, userId: true },
      });

      if (!payment) return { processed: false, reason: 'unknown payment' };

      // A refund ends the subscription now rather than at the period end: the
      // money has gone back, so the access should too.
      await prisma.$transaction([
        prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } }),
        prisma.user.update({
          where: { id: payment.userId },
          data: { plan: 'FREE', subscriptionEndsAt: null },
        }),
      ]);
      await notify(payment.userId, {
        type: 'SUBSCRIPTION',
        title: 'Your payment was refunded',
        message: 'PRO has ended and the free limits apply again.',
        link: '/upgrade',
      });

      log.info({ paymentId: refundedPaymentId }, 'Refund processed; subscription ended');
      return { processed: true };
    }

    default:
      // Recorded but not acted on, so an unexpected event type is visible in the
      // ledger rather than silently dropped.
      return { processed: false, reason: `unhandled event ${eventType}` };
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function subscription(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true, plan: true, subscriptionEndsAt: true },
  });

  const now = new Date();
  const paid =
    user.plan === 'PRO' && (user.subscriptionEndsAt === null || user.subscriptionEndsAt > now);
  // Staff have PRO without a subscription — see `entitled` in limits.service.
  const included = user.role === 'ADMIN';

  return {
    plan: user.plan,
    isPro: paid || included,
    /** True when PRO comes with the account rather than a subscription. */
    included,
    subscriptionEndsAt: included ? null : user.subscriptionEndsAt,
    // Reported separately from `isPro` so the UI can say "expired" rather than
    // just "not subscribed".
    isExpired: !included && user.plan === 'PRO' && !paid,
    billingEnabled: !included,
  };
}

export async function payments(
  userId: string,
  pagination: Pagination,
): Promise<Paginated<Payment>> {
  const where = { userId };

  const [data, total] = await prisma.$transaction([
    prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) }),
    prisma.payment.count({ where }),
  ]);

  return paginate(data, total, pagination);
}
