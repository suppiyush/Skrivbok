import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';

export const notificationTypeSchema = z.enum([
  'DEADLINE_DUE',
  'MEETING_REQUEST',
  'MEETING_ACCEPTED',
  'MEETING_REJECTED',
  'CALENDAR_ACCESS_REQUEST',
  'CALENDAR_ACCESS_GRANTED',
  'PROJECT_INVITE',
  'SUBSCRIPTION',
  'SYSTEM',
  'TEAM',
  'PROJECT_MEETING',
  'EVENT_REMINDER',
  'REPORT',
  'ADMIN',
]);

export const listNotificationsSchema = paginationSchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  type: notificationTypeSchema.optional(),
});

/** Marking several read at once, so opening a panel is one request. */
export const markReadSchema = z.object({
  ids: z.array(z.string().min(20).max(40)).min(1).max(200),
});

/**
 * What a user may change about how they are told things.
 *
 * `reminderDaysBefore` allows 0 — "on the day" — which the worker treats as
 * a reminder like any other. Values are deduplicated and sorted so two lists
 * that mean the same thing are stored the same way.
 */
export const updatePreferencesSchema = z
  .object({
    deadlineRemindersEnabled: z.boolean().optional(),
    dailyAgendaEnabled: z.boolean().optional(),
    meetingRequestsEnabled: z.boolean().optional(),
    reminderDaysBefore: z
      .array(z.number().int().min(0).max(60))
      .max(10)
      .transform((days) => [...new Set(days)].sort((a, b) => a - b))
      .optional(),
    notificationTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:00')
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
