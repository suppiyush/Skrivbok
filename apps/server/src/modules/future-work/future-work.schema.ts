import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';
import { prioritySchema } from '../deadlines/deadlines.schema.js';

/** Field shapes with no defaults — the shared source for create and update. */
const futureWorkFields = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200),
  description: z.string().max(20_000).nullish(),
  priority: prioritySchema,
  /** Deliberately free text: "next semester", "2027 H1", "after the thesis". */
  timeline: z.string().trim().max(120).nullish(),
});

export const createFutureWorkSchema = futureWorkFields.extend({
  priority: prioritySchema.default('MEDIUM'),
});

/**
 * NOTE ON UPDATE SCHEMAS
 *
 * The update schema is built from a defaults-free base, never as
 * `createSchema.partial()`. Zod's `.partial()` makes fields optional but
 * leaves their `.default()` in place, so parsing an empty PATCH body would
 * materialise every default and silently overwrite the stored values — turning
 * `PATCH {}` into a destructive reset. Confirmed against a live request
 * before this split was introduced.
 */
export const updateFutureWorkSchema = futureWorkFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listFutureWorkSchema = paginationSchema.extend({
  priority: prioritySchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'priority', 'title']).default('newest'),
});

export type CreateFutureWorkInput = z.infer<typeof createFutureWorkSchema>;
export type UpdateFutureWorkInput = z.infer<typeof updateFutureWorkSchema>;
export type ListFutureWorkQuery = z.infer<typeof listFutureWorkSchema>;
