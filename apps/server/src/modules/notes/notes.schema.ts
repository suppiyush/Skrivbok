import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';
import { categorySchema, noteColorSchema } from '../ideas/ideas.schema.js';

/**
 * Where a recording may come from.
 *
 * Shape only — that it is a URL at all, and not absurdly long. Whether it is
 * *our* storage is a question about configuration rather than about the
 * request, so the service asks `isOwnStorageUrl` once the body has parsed.
 * Without that second check this field would be a way to point the product's
 * own pages at an arbitrary third-party file.
 */
const audioUrlSchema = z.string().trim().url('That is not a valid recording URL').max(2048);

/** Field shapes with no defaults — see the note above updateNoteSchema. */
const noteFields = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200),
  content: z.string().max(50_000).nullish(),
  category: categorySchema,
  color: noteColorSchema,
  audioUrl: audioUrlSchema.nullish(),
  // Four hours. Long enough for any plausible recording, short enough that a
  // nonsense value cannot be stored and displayed.
  audioSeconds: z.number().int().min(0).max(14_400).nullish(),
});

export const createNoteSchema = noteFields.extend({
  category: categorySchema.default('general'),
  color: noteColorSchema.default('YELLOW'),
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
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'title']).default('newest'),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesQuery = z.infer<typeof listNotesSchema>;
