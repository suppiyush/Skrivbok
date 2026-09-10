import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';

/** Tags are normalised to lowercase so "Raft" and "raft" are one tag. */
const tagSchema = z.string().trim().toLowerCase().min(1).max(40);

const currentYear = new Date().getUTCFullYear();

/** Field shapes with no defaults — the shared source for create and update. */
const literatureFields = z.object({
  title: z.string().trim().min(1, 'A title is required').max(400),
  authors: z.string().trim().max(500).nullish(),
  /** Wide enough for historical works, capped just beyond "in press". */
  year: z
    .number()
    .int()
    .min(1000)
    .max(currentYear + 5)
    .nullish(),
  links: z.array(z.url({ protocol: /^https?$/ })).max(20),
  tags: z.array(tagSchema).max(30),
  summary: z.string().max(50_000).nullish(),
});

export const createLiteratureSchema = literatureFields.extend({
  links: z
    .array(z.url({ protocol: /^https?$/ }))
    .max(20)
    .default([]),
  tags: z.array(tagSchema).max(30).default([]),
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
export const updateLiteratureSchema = literatureFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listLiteratureSchema = paginationSchema.extend({
  /**
   * Repeatable query parameter: `?tag=raft&tag=consensus`. A single value
   * arrives as a string, several as an array, so both are coerced to an array.
   */
  tag: z
    .union([tagSchema, z.array(tagSchema)])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  /** `all` requires every listed tag; `any` requires at least one. */
  tagMatch: z.enum(['any', 'all']).default('any'),
  year: z.coerce
    .number()
    .int()
    .min(1000)
    .max(currentYear + 5)
    .optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'title', 'year']).default('newest'),
});

export type CreateLiteratureInput = z.infer<typeof createLiteratureSchema>;
export type UpdateLiteratureInput = z.infer<typeof updateLiteratureSchema>;
export type ListLiteratureQuery = z.infer<typeof listLiteratureSchema>;
