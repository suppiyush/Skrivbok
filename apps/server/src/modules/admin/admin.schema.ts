import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';
import { reportStatusSchema, reportTypeSchema } from '../reports/reports.schema.js';

export const roleSchema = z.enum(['USER', 'ADMIN']);
export const planSchema = z.enum(['FREE', 'PRO']);

export const listUsersSchema = paginationSchema.extend({
  /** Matches on email or name, case-insensitive. */
  search: z.string().trim().min(1).max(200).optional(),
  role: roleSchema.optional(),
  plan: planSchema.optional(),
  sort: z.enum(['newest', 'oldest', 'lastLogin', 'email']).default('newest'),
});

/**
 * What an admin may change about a user.
 *
 * Notably absent: `email` and `password`. Letting an admin rewrite either would
 * be a complete account takeover with no trace, and neither is needed for
 * support. A user changes their own email and password through auth.
 */
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).nullish(),
    role: roleSchema.optional(),
    plan: planSchema.optional(),
    /** Manual override, e.g. comping an account or correcting a failed webhook. */
    subscriptionEndsAt: z.coerce.date().nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

/**
 * Deleting a user erases everything they own. The typed confirmation is a
 * deliberate speed bump — the legacy endpoint deleted on a bare DELETE with no
 * authentication at all.
 */
export const deleteUserSchema = z.object({
  confirm: z.literal('DELETE', { message: 'Type DELETE to confirm' }),
});

export const listReportsSchema = paginationSchema.extend({
  status: reportStatusSchema.optional(),
  type: reportTypeSchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const updateReportSchema = z
  .object({
    status: reportStatusSchema.optional(),
    resolution: z.string().trim().max(5_000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listPaymentsSchema = paginationSchema.extend({
  status: z.enum(['CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED']).optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

/** Time-series window for the analytics charts. */
export const analyticsSchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export type ListUsersQuery = z.infer<typeof listUsersSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListReportsQuery = z.infer<typeof listReportsSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListAdminPaymentsQuery = z.infer<typeof listPaymentsSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsSchema>;
