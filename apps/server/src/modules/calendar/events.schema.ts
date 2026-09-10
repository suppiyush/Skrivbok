import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';
import { prioritySchema } from '../deadlines/deadlines.schema.js';
import { emailSchema, timezoneSchema } from '../auth/auth.schema.js';

export const recurrenceSchema = z.enum([
  'NONE',
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'YEARLY',
]);

export const showAsSchema = z.enum(['FREE', 'BUSY', 'TENTATIVE', 'OUT_OF_OFFICE']);

/**
 * Who can see this event on a calendar someone has been granted access to.
 *
 * PRIVATE is the default. The legacy schema defaulted to exposing full details,
 * which is the wrong way round for a calendar.
 */
export const visibilitySchema = z.enum(['PRIVATE', 'BUSY', 'PUBLIC']);

const instant = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Not a valid date-time');

const eventFields = z.object({
  title: z.string().trim().min(1, 'A title is required').max(300),
  description: z.string().max(20_000).nullish(),
  location: z.string().trim().max(300).nullish(),

  startAt: instant,
  endAt: instant,
  /** The zone the user authored the times in. Drives recurrence across DST. */
  timezone: timezoneSchema,
  isAllDay: z.boolean(),

  category: z.string().trim().min(1).max(60),
  priority: prioritySchema,
  showAs: showAsSchema,
  visibility: visibilitySchema,

  isOnline: z.boolean(),
  meetingLink: z
    .url({ protocol: /^https?$/ })
    .max(2048)
    .nullish(),
  /** Plain email addresses: attendees frequently have no Skrivbok account. */
  attendees: z.array(emailSchema).max(100),

  /** Minutes before the start. Null disables the reminder. */
  reminderMinutes: z.number().int().min(0).max(40_320).nullish(),

  recurrence: recurrenceSchema,
  recurrenceEndAt: instant.nullish(),
});

const createBase = eventFields.extend({
  timezone: timezoneSchema.optional(),
  isAllDay: z.boolean().default(false),
  category: z.string().trim().min(1).max(60).default('Work'),
  priority: prioritySchema.default('MEDIUM'),
  showAs: showAsSchema.default('BUSY'),
  visibility: visibilitySchema.default('PRIVATE'),
  isOnline: z.boolean().default(false),
  attendees: z.array(emailSchema).max(100).default([]),
  reminderMinutes: z.number().int().min(0).max(40_320).nullish().default(15),
  recurrence: recurrenceSchema.default('NONE'),
});

/**
 * Cross-field rules. Declared on each schema rather than through a shared
 * helper: Zod loses the inferred output type through a generic wrapper, and the
 * two schemas do not check quite the same things anyway — on update the fields
 * may be absent, so each rule has to tolerate that.
 */
export const createEventSchema = createBase
  .refine((v) => v.endAt >= v.startAt, {
    message: 'The event cannot end before it starts',
    path: ['endAt'],
  })
  .refine((v) => !v.recurrenceEndAt || v.recurrenceEndAt >= v.startAt, {
    message: 'The repeat cannot end before the first occurrence',
    path: ['recurrenceEndAt'],
  })
  .refine(
    (v) => v.recurrence !== 'NONE' || v.recurrenceEndAt === null || v.recurrenceEndAt === undefined,
    {
      message: 'A repeat end date only applies to a repeating event',
      path: ['recurrenceEndAt'],
    },
  );

/**
 * Built from a defaults-free base — see the note in `ideas.schema.ts`.
 *
 * These refinements can only compare fields present in the same request. The
 * service re-checks them against the merged result, since a PATCH that moves
 * only `endAt` must still be compared with the stored `startAt`.
 */
export const updateEventSchema = eventFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine((v) => !v.startAt || !v.endAt || v.endAt >= v.startAt, {
    message: 'The event cannot end before it starts',
    path: ['endAt'],
  })
  .refine((v) => !v.recurrenceEndAt || !v.startAt || v.recurrenceEndAt >= v.startAt, {
    message: 'The repeat cannot end before the first occurrence',
    path: ['recurrenceEndAt'],
  })
  .refine(
    (v) => v.recurrence !== 'NONE' || v.recurrenceEndAt === null || v.recurrenceEndAt === undefined,
    {
      message: 'A repeat end date only applies to a repeating event',
      path: ['recurrenceEndAt'],
    },
  );

/**
 * The calendar grid query.
 *
 * Both bounds are required and the span is capped: an open-ended range would
 * force every repeating series to expand without limit.
 */
export const rangeQuerySchema = z
  .object({
    from: instant,
    to: instant,
    category: z.string().trim().min(1).max(60).optional(),
  })
  .refine((v) => v.to > v.from, { message: '`to` must be after `from`' })
  .refine((v) => v.to.getTime() - v.from.getTime() <= 400 * 24 * 60 * 60 * 1000, {
    message: 'The range cannot exceed 400 days',
    path: ['to'],
  });

/** Flat list of stored events (series masters), not expanded occurrences. */
export const listEventsSchema = paginationSchema.extend({
  category: z.string().trim().min(1).max(60).optional(),
  recurring: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['soonest', 'latest', 'newest']).default('soonest'),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type ListEventsQuery = z.infer<typeof listEventsSchema>;
