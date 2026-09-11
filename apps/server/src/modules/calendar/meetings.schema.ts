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

/**
 * A meet with several teammates at once.
 *
 * Wall-clock date and times plus a zone, rather than instants: the requester
 * chooses "10:00 in Stockholm", and turning that into an instant is the
 * server's job — the client has no zone library, and getting it wrong would
 * put the meeting an hour off for everyone. Attendees are user ids, which is
 * safe here because the service only accepts ids of people who share a
 * project with the requester.
 */
export const createGroupMeetSchema = z.object({
  attendeeIds: z.array(z.string().min(20).max(40)).min(1).max(50),
  title: z.string().trim().min(1, 'A title is required').max(300),
  description: z.string().max(20_000).nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use the format HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use the format HH:mm'),
  timezone: timezoneSchema,
});

export const groupParamSchema = z.object({ groupId: z.string().min(20).max(40) });

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
export type CreateGroupMeetInput = z.infer<typeof createGroupMeetSchema>;
