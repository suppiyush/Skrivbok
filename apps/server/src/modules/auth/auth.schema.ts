/**
 * Auth request schemas.
 *
 * These are the contract for the frontend, and will be re-exported from
 * `packages/shared` so the React forms validate against the same rules the
 * server enforces.
 *
 * Google is the only sign-in method, so nothing here accepts a password. The
 * field primitives below (`emailSchema`, `nameSchema`, `timezoneSchema`) are
 * shared by the other modules and stay regardless.
 */
import { z } from 'zod';

/** Emails are normalised here so uniqueness is genuinely case-insensitive. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email address');

/** Reject anything Intl does not recognise, so reminders cannot be scheduled into a void. */
export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Not a recognised IANA timezone');

export const nameSchema = z.string().trim().min(1).max(120);

export const updateMeSchema = z
  .object({
    name: nameSchema.optional(),
    timezone: timezoneSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.timezone !== undefined, {
    message: 'Provide at least one field to update',
  });

/**
 * The Google callback. Google returns `error` instead of `code` when the user
 * declines consent, so both are optional and the controller decides.
 */
export const googleCallbackSchema = z.object({
  code: z.string().min(1).max(2048).optional(),
  state: z.string().min(1).max(256).optional(),
  error: z.string().max(256).optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type GoogleCallbackQuery = z.infer<typeof googleCallbackSchema>;
