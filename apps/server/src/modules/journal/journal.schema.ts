import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';

/**
 * A plain calendar day, `YYYY-MM-DD`, with no time and no timezone.
 *
 * A journal entry belongs to a date the way a diary page does — "the 4th" is
 * the 4th wherever the writer happens to be. Storing an instant would make the
 * entry jump to the previous day for anyone west of UTC.
 */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Not a real date')
  .transform((v) => new Date(`${v}T00:00:00Z`));

/** Tags are normalised to lowercase so "Fieldwork" and "fieldwork" are one tag. */
const tagSchema = z.string().trim().toLowerCase().min(1).max(40);

/** Field shapes with no defaults — the shared source for create and update. */
const journalFields = z.object({
  title: z.string().trim().max(200).nullish(),
  content: z.string().min(1, 'An entry cannot be empty').max(100_000),
  /** Defaults to today (UTC) when the client does not say. */
  entryDate: dateOnlySchema.optional(),
  mood: z.string().trim().max(40).nullish(),
  tags: z.array(tagSchema).max(30),
});

export const createJournalEntrySchema = journalFields.extend({
  tags: z.array(tagSchema).max(30).default([]),
});

/**
 * NOTE ON UPDATE SCHEMAS
 *
 * Built from the defaults-free base, never as `createSchema.partial()`, which
 * would leave `tags`' `.default([])` in place and empty the array on any PATCH
 * that did not mention it. The same reasoning is written out at length in
 * `literature.schema.ts`.
 */
export const updateJournalEntrySchema = journalFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listJournalSchema = paginationSchema.extend({
  /** Inclusive date window, for the calendar view. */
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  mood: z.string().trim().min(1).max(40).optional(),
  /** Repeatable: `?tag=fieldwork&tag=reading`. One value arrives as a string. */
  tag: z
    .union([tagSchema, z.array(tagSchema)])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
export type ListJournalQuery = z.infer<typeof listJournalSchema>;
