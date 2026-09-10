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

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
