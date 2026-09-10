import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';

/** Matches the `NoteColor` enum in schema.prisma. */
export const noteColorSchema = z.enum([
  'YELLOW',
  'PINK',
  'BLUE',
  'GREEN',
  'PURPLE',
  'ORANGE',
  'GRAY',
]);

/** Free-form so users can invent their own groupings, but bounded. */
export const categorySchema = z.string().trim().min(1).max(60);

/** Field shapes with no defaults — the shared source for create and update. */
const ideaFields = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200),
  content: z.string().max(20_000).nullish(),
  category: categorySchema,
  color: noteColorSchema,
});

export const createIdeaSchema = ideaFields.extend({
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
export const updateIdeaSchema = ideaFields.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Provide at least one field to update',
});

export const listIdeasSchema = paginationSchema.extend({
  category: categorySchema.optional(),
  color: noteColorSchema.optional(),
  /** Case-insensitive substring match across title and content. */
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'title']).default('newest'),
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;
export type ListIdeasQuery = z.infer<typeof listIdeasSchema>;
