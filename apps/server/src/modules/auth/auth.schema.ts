/**
 * Auth request schemas.
 *
 * These are the contract for the frontend, and will be re-exported from
 * `packages/shared` so the React forms validate against the same rules the
 * server enforces.
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

/**
 * Minimum 8 characters and nothing else. Composition rules (a digit, a symbol,
 * a capital) push people toward `Password1!` and measurably weaken passwords;
 * length is what matters. The 72-byte ceiling is bcrypt's — input beyond it is
 * silently ignored by the algorithm, so it is rejected rather than truncated.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

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

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  timezone: timezoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

/** Setting a first password on an account created through Google. */
export const setPasswordSchema = z.object({
  newPassword: passwordSchema,
});

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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type GoogleCallbackQuery = z.infer<typeof googleCallbackSchema>;
