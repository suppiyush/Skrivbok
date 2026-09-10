import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';

export const reviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const upsertReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  /** Shown beside the quote. Free text: job titles vary enormously. */
  role: z.string().trim().max(120).nullish(),
  body: z
    .string()
    .trim()
    .min(40, 'Please write a little more — at least 40 characters')
    .max(1_000),
});

/** Admin moderation. A rejection may carry a note back to the author. */
export const moderateReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  adminNote: z.string().trim().max(500).nullish(),
});

export const listReviewsSchema = paginationSchema.extend({
  status: reviewStatusSchema.optional(),
});

export type UpsertReviewInput = z.infer<typeof upsertReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsSchema>;
