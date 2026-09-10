import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';
import { emailSchema, timezoneSchema } from '../auth/auth.schema.js';

const instant = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Not a valid date-time');

export const meetingStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED']);

/**
 * The recipient is addressed by email, not by user id.
 *
 * Ids are internal; a user knows their colleague's address, not their cuid.
 * Accepting an id here would also let a caller probe which ids exist.
 */
export const createMeetingRequestSchema = z
  .object({
    receiverEmail: emailSchema,
    title: z.string().trim().min(1, 'A title is required').max(300),
    description: z.string().max(20_000).nullish(),
    startAt: instant,
    endAt: instant,
    timezone: timezoneSchema.optional(),
    location: z.string().trim().max(300).nullish(),
    isOnline: z.boolean().default(false),
    meetingLink: z
      .url({ protocol: /^https?$/ })
      .max(2048)
      .nullish(),
  })
  .refine((v) => v.endAt > v.startAt, {
    message: 'The meeting cannot end before it starts',
    path: ['endAt'],
  });

/** Only a pending request can be rescheduled, and only by its sender. */
export const rescheduleSchema = z
  .object({
    startAt: instant,
    endAt: instant,
    timezone: timezoneSchema.optional(),
  })
  .refine((v) => v.endAt > v.startAt, {
    message: 'The meeting cannot end before it starts',
    path: ['endAt'],
  });

/** An optional note the other party sees with the decision. */
export const respondSchema = z.object({
  message: z.string().trim().max(1_000).nullish(),
});

export const listMeetingRequestsSchema = paginationSchema.extend({
  /** `incoming` = addressed to me, `outgoing` = sent by me. */
  box: z.enum(['incoming', 'outgoing', 'all']).default('all'),
  status: meetingStatusSchema.optional(),
  /** Hide meetings that have already finished. */
  upcoming: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(['soonest', 'latest', 'newest']).default('soonest'),
});

export type CreateMeetingRequestInput = z.infer<typeof createMeetingRequestSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
export type RespondInput = z.infer<typeof respondSchema>;
export type ListMeetingRequestsQuery = z.infer<typeof listMeetingRequestsSchema>;
