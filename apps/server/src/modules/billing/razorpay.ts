/**
 * Razorpay client and signature verification.
 *
 * Called over plain HTTPS rather than through the `razorpay` npm package: the
 * two endpoints needed here are a POST and a GET, and owning them keeps the
 * signature checks below visible in this file instead of behind a wrapper.
 *
 * ## The two signatures
 *
 * Razorpay signs two different things with two different secrets, and confusing
 * them is the classic way to build a bypassable payment flow:
 *
 *  • **Checkout signature** — HMAC-SHA256 of `order_id|payment_id`, keyed with
 *    the *API key secret*. Returned to the browser after a successful payment.
 *  • **Webhook signature** — HMAC-SHA256 of the *raw request body*, keyed with
 *    the *webhook secret*. Sent server-to-server.
 *
 * Both are verified with a constant-time comparison. A plain `===` on a hex
 * digest leaks, byte by byte, how much of a guess was correct.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { FeatureDisabledError, ServiceUnavailableError } from '../../utils/errors.js';

const API_BASE = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 15_000;

interface BillingConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | undefined;
  currency: string;
  prices: { monthly: number; yearly: number };
}

/** Narrow `env.billing` to its enabled shape, or fail with a clear 503. */
export function billingConfig(): BillingConfig {
  if (!env.billing.enabled) throw new FeatureDisabledError('Billing');
  return env.billing;
}

export function isBillingEnabled(): boolean {
  return env.billing.enabled;
}

/**
 * Compare two hex digests without leaking where they first differ.
 *
 * Length is checked first because `timingSafeEqual` throws on a mismatch; that
 * check is not itself a leak, since the digest length is fixed and public.
 */
export function safeCompareHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Verify the signature Razorpay Checkout hands back to the browser. */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const expected = createHmac('sha256', billingConfig().keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return safeCompareHex(expected, signature);
}

/**
 * Verify a webhook against the raw request body.
 *
 * The raw bytes matter: re-serialising the parsed JSON produces a different
 * string (key order, whitespace, number formatting) and the HMAC will not
 * match. `app.ts` keeps the original buffer on `req.rawBody` for this.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const secret = billingConfig().webhookSecret;
  if (!secret) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeCompareHex(expected, signature);
}

function authHeader(): string {
  const config = billingConfig();
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Create an order.
 *
 * `amount` is supplied by the caller from the server-side price table — never
 * from the request. The legacy endpoint read the plan from the body and looked
 * the price up locally, which was fine, but then `/payment/verify` trusted the
 * body for the plan *and* the email, so a user could buy a month and claim a
 * year on someone else's account.
 */
export async function createOrder(params: {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const response = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
      payment_capture: 1,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    // Razorpay's error body can echo request details, so it is logged upstream
    // rather than returned to the client.
    throw new ServiceUnavailableError('Could not start the payment. Please try again.');
  }

  const order = (await response.json()) as Partial<RazorpayOrder>;

  if (typeof order.id !== 'string') {
    throw new ServiceUnavailableError('Payment provider returned an unexpected response');
  }

  return {
    id: order.id,
    amount: order.amount ?? params.amountPaise,
    currency: order.currency ?? params.currency,
    status: order.status ?? 'created',
  };
}

/** Fetch a payment, to confirm its real state rather than trusting the client. */
export async function fetchPayment(
  paymentId: string,
): Promise<{ id: string; status: string; order_id: string; amount: number } | null> {
  const response = await fetch(`${API_BASE}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) return null;

  return (await response.json()) as {
    id: string;
    status: string;
    order_id: string;
    amount: number;
  };
}
