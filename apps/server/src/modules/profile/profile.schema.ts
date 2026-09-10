import { z } from 'zod';
import { emailSchema } from '../auth/auth.schema.js';

/**
 * The profile.
 *
 * Deliberately small. It carries who someone is and how to reach them, and
 * nothing else — the long-form academic record (degrees, employment, grants,
 * awards, teaching) was removed along with the generated CV that was the only
 * thing reading it.
 */

/** Optional free text where an empty string means "cleared", not "unset". */
const text = (max: number) => z.string().trim().max(max).nullish();

/** A link the profile shows publicly. Bounded, and http(s) only. */
const link = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .nullish();

export const upsertProfileSchema = z
  .object({
    fullName: text(120),
    designation: text(120),
    department: text(160),
    institution: text(160),

    officialEmail: emailSchema.nullish(),
    phone: text(40),
    website: link,
    scholarLink: link,

    researchKeywords: text(300),
    researchDescription: text(2_000),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to save',
  });

/**
 * The avatar URL is set by the upload flow, not typed by hand, so it is
 * validated separately and never accepted through the general profile save.
 * Letting a client PUT an arbitrary `avatarUrl` would make the profile a place
 * to host links to anything.
 */
export const setAvatarSchema = z.object({
  /** Returned by the storage provider after a successful upload. */
  url: z.url({ protocol: /^https$/ }).max(2048),
});

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
export type SetAvatarInput = z.infer<typeof setAvatarSchema>;
