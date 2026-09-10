import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';

/** The client picks a plan, never an amount. Pricing lives in config. */
export const billingPlanSchema = z.enum(['MONTHLY', 'YEARLY']);

export const startOrderSchema = z.object({ plan: billingPlanSchema });

/**
 * The fields Razorpay Checkout hands back to the browser.
 *
 * Note what is absent: no email, no plan, no amount. The account and the price
 * are resolved server-side from the order id, so nothing here can redirect a
 * payment to another account or claim a longer plan than was paid for.
 */
export const verifyCheckoutSchema = z.object({
  orderId: z.string().trim().min(1).max(120),
  paymentId: z.string().trim().min(1).max(120),
  signature: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/, 'Not a valid signature'),
});

export const listPaymentsSchema = paginationSchema;

export type StartOrderInput = z.infer<typeof startOrderSchema>;
export type VerifyCheckoutInput = z.infer<typeof verifyCheckoutSchema>;
