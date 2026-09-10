import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';
import { emailSchema } from '../auth/auth.schema.js';

/**
 * How much of a calendar a grant exposes.
 *
 * FREE_BUSY is the default and the safer of the two: the viewer learns *when*
 * the owner is occupied, never *what* they are doing.
 */
export const accessLevelSchema = z.enum(['FREE_BUSY', 'VIEW']);

export const accessRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REVOKED']);

const instant = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Not a valid date-time');

/** Requests are addressed by email — a user knows an address, not a cuid. */
export const createAccessRequestSchema = z.object({
  targetEmail: emailSchema,
  message: z.string().trim().max(500).nullish(),
});

/** The owner chooses the level when approving, not the requester. */
export const approveAccessSchema = z.object({
  level: accessLevelSchema.default('FREE_BUSY'),
});

export const updateAccessSchema = z.object({ level: accessLevelSchema });

export const listAccessRequestsSchema = paginationSchema.extend({
  /** `incoming` = people asking to see my calendar. */
  box: z.enum(['incoming', 'outgoing', 'all']).default('all'),
  status: accessRequestStatusSchema.optional(),
});

/** Shared window queries reuse the same bounds and cap as the personal grid. */
const rangeBounds = {
  from: instant,
  to: instant,
};

export const sharedRangeSchema = z
  .object(rangeBounds)
  .refine((v) => v.to > v.from, { message: '`to` must be after `from`' })
  .refine((v) => v.to.getTime() - v.from.getTime() <= 400 * 24 * 60 * 60 * 1000, {
    message: 'The range cannot exceed 400 days',
    path: ['to'],
  });

/**
 * Free/busy across several people at once, for finding a slot.
 *
 * `emails` is repeatable: `?email=a@x.com&email=b@x.com`. Capped, because each
 * address costs a calendar expansion.
 */
export const availabilitySchema = z
  .object({
    ...rangeBounds,
    email: z
      .union([emailSchema, z.array(emailSchema)])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .refine((v) => v.length <= 25, 'At most 25 people can be checked at once'),
  })
  .refine((v) => v.to > v.from, { message: '`to` must be after `from`' })
  .refine((v) => v.to.getTime() - v.from.getTime() <= 62 * 24 * 60 * 60 * 1000, {
    message: 'Availability can be checked across at most 62 days',
    path: ['to'],
  });

export const emailParamSchema = z.object({ email: emailSchema });

export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>;
export type ApproveAccessInput = z.infer<typeof approveAccessSchema>;
export type UpdateAccessInput = z.infer<typeof updateAccessSchema>;
export type ListAccessRequestsQuery = z.infer<typeof listAccessRequestsSchema>;
export type SharedRangeQuery = z.infer<typeof sharedRangeSchema>;
export type AvailabilityQuery = z.infer<typeof availabilitySchema>;
