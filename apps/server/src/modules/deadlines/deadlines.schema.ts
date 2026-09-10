import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';
import { timezoneSchema } from '../auth/auth.schema.js';

export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const deadlineStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

/**
 * An absolute instant, sent as ISO 8601.
 *
 * The legacy schema stored `due_date` and `due_time` as separate TEXT columns
 * and compared them as strings, which broke across midnight, across months and
 * across daylight-saving changes. A deadline is a moment; it is stored as one.
 */
export const instantSchema = z.coerce
  .date()
  .refine((d) => !Number.isNaN(d.getTime()), 'Not a valid date-time');

export const createDeadlineSchema = z
  .object({
    title: z.string().trim().min(1, 'A title is required').max(200),
    description: z.string().max(20_000).nullish(),
    dueAt: instantSchema,
    /**
     * The zone the user typed `dueAt` in. Kept so the wall-clock time they
     * intended can be shown back to them, and so reminders fire at the right
     * local hour after a DST shift.
     */
    timezone: timezoneSchema.optional(),
    priority: prioritySchema.default('MEDIUM'),
    status: deadlineStatusSchema.default('PENDING'),
    reminderEnabled: z.boolean().default(true),
    /** Null means "derive it from dueAt and the user's email preferences". */
    remindAt: instantSchema.nullish(),
  })
  .refine((v) => !v.remindAt || v.remindAt <= v.dueAt, {
    message: 'A reminder cannot be scheduled after the deadline it is reminding about',
    path: ['remindAt'],
  });

/**
 * Declared separately rather than as `createDeadlineSchema.partial()`, because
 * `.partial()` cannot be called on a schema that already carries a `.refine`.
 * The cross-field rule is re-stated below for the fields that are present.
 */
export const updateDeadlineSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(20_000).nullish(),
    dueAt: instantSchema.optional(),
    timezone: timezoneSchema.optional(),
    priority: prioritySchema.optional(),
    status: deadlineStatusSchema.optional(),
    reminderEnabled: z.boolean().optional(),
    remindAt: instantSchema.nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine((v) => !v.remindAt || !v.dueAt || v.remindAt <= v.dueAt, {
    message: 'A reminder cannot be scheduled after the deadline it is reminding about',
    path: ['remindAt'],
  });

export const listDeadlinesSchema = paginationSchema.extend({
  status: deadlineStatusSchema.optional(),
  priority: prioritySchema.optional(),
  /** Inclusive window on `dueAt`. */
  from: instantSchema.optional(),
  to: instantSchema.optional(),
  /** Convenience filter for the dashboard: everything past due and not finished. */
  overdue: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['dueSoonest', 'dueLatest', 'priority', 'newest']).default('dueSoonest'),
});

export type CreateDeadlineInput = z.infer<typeof createDeadlineSchema>;
export type UpdateDeadlineInput = z.infer<typeof updateDeadlineSchema>;
export type ListDeadlinesQuery = z.infer<typeof listDeadlinesSchema>;
