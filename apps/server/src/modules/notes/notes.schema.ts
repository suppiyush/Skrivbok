import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';
import { categorySchema, noteColorSchema } from '../ideas/ideas.schema.js';

/** Field shapes with no defaults — see the note above updateNoteSchema. */
const noteFields = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200),
  content: z.string().max(50_000).nullish(),
  category: categorySchema,
  color: noteColorSchema,
  pinned: z.boolean(),
});

export const createNoteSchema = noteFields.extend({
  category: categorySchema.default('general'),
  color: noteColorSchema.default('YELLOW'),
  pinned: z.boolean().default(false),
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
export const updateNoteSchema = noteFields.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Provide at least one field to update',
});

export const listNotesSchema = paginationSchema.extend({
  category: categorySchema.optional(),
  color: noteColorSchema.optional(),
  pinned: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'title']).default('newest'),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesQuery = z.infer<typeof listNotesSchema>;
