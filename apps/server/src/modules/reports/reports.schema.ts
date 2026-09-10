import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';

export const reportTypeSchema = z.enum(['BUG', 'FEATURE', 'FEEDBACK']);
export const reportStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']);

export const createReportSchema = z.object({
  type: reportTypeSchema,
  /** Which screen the user was on. Free text, since the UI supplies it. */
  featurePage: z.string().trim().max(120).nullish(),
  title: z.string().trim().max(200).nullish(),
  description: z
    .string()
    .trim()
    .min(10, 'Please describe the issue in a little more detail')
    .max(10_000),
});

export const listOwnReportsSchema = paginationSchema.extend({
  type: reportTypeSchema.optional(),
  status: reportStatusSchema.optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ListOwnReportsQuery = z.infer<typeof listOwnReportsSchema>;
