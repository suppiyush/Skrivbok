/**
 * Environment configuration — the single source of truth for all runtime config.
 *
 * Every variable is parsed and validated here at import time. If anything is
 * missing or malformed the process exits immediately with a readable report,
 * so a misconfigured deploy fails at boot instead of at 3am inside a request.
 *
 * Rules:
 *   - Nothing outside this file may read `process.env` directly.
 *   - Import the named `env` export: `import { env } from '../config/env.js'`.
 *   - Optional integrations (Google, SMTP, Razorpay) degrade to `enabled: false`
 *     rather than throwing, so local dev works without every third-party key.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// ── Locate and load the repo-root .env ────────────────────────────────────────
// This file sits at <root>/apps/server/src/config, so the workspace root is four
// directories up.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const envPath = resolve(repoRoot, '.env');

if (existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}
// In production config normally comes from the orchestrator's real environment,
// so a missing .env file is not itself an error — the schema below decides.

// ── Reusable primitives ───────────────────────────────────────────────────────
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const port = z.coerce.number().int().min(1).max(65_535);
const positiveInt = z.coerce.number().int().positive();

/** A free-tier cap: a positive count, or -1 meaning unlimited. */
const limit = z.coerce
  .number()
  .int()
  .refine((n) => n === -1 || n > 0, { message: 'must be a positive integer, or -1 for unlimited' });

const httpUrl = z
  .string()
  .trim()
  .refine((v) => /^https?:\/\/[^\s]+$/.test(v), { message: 'must be an http(s) URL' });

const email = z
  .string()
  .trim()
  .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
    message: 'must be a valid email address',
  });

/** Optional string where an empty value is treated the same as unset. */
const optionalStr = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : v));

/** Comma-separated list of http(s) origins. */
const originList = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(httpUrl).min(1));

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: port.default(4000),
  API_URL: httpUrl,
  WEB_URL: httpUrl,
  CORS_ORIGINS: originList,
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Database
  DATABASE_URL: z.string().min(1).startsWith('postgres'),
  DIRECT_URL: z.string().min(1).startsWith('postgres').optional(),

  // Sessions
  SESSION_SECRET: z.string().min(32, 'must be at least 32 chars — run: openssl rand -base64 48'),
  SESSION_TTL_DAYS: positiveInt.default(30),
  SESSION_COOKIE_NAME: z.string().min(1).default('skrivbok_sid'),
  COOKIE_DOMAIN: optionalStr,

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: optionalStr,
  GOOGLE_CLIENT_SECRET: optionalStr,
  GOOGLE_CALLBACK_URL: optionalStr,

  // Mail (optional). Either an HTTPS provider key or an SMTP host enables it;
  // the key wins when both are set, because some hosts block outbound SMTP.
  BREVO_API_KEY: optionalStr,
  SMTP_HOST: optionalStr,
  SMTP_PORT: port.default(587),
  SMTP_SECURE: bool.default(false),
  SMTP_USER: optionalStr,
  SMTP_PASS: optionalStr,
  MAIL_FROM_NAME: z.string().min(1).default('Skrivbok'),
  MAIL_FROM_ADDRESS: email.default('no-reply@skrivbok.app'),
  SUPPORT_EMAIL: email.default('support@skrivbok.app'),

  // Reminder worker
  ENABLE_REMINDER_WORKER: bool.default(true),
  REMINDER_CRON: z.string().min(1).default('*/5 * * * *'),
  REMINDER_CRON_TZ: z.string().min(1).default('UTC'),
  // Lets an external scheduler run the reminder pass over HTTP, for hosts with
  // no long-lived process to run the worker in. Unset means the route is off.
  CRON_SECRET: optionalStr.pipe(z.string().min(24).optional()),

  // Image uploads (optional) — Cloudinary
  CLOUDINARY_CLOUD_NAME: optionalStr,
  CLOUDINARY_API_KEY: optionalStr,
  CLOUDINARY_API_SECRET: optionalStr,

  // Billing (optional)
  RAZORPAY_KEY_ID: optionalStr,
  RAZORPAY_KEY_SECRET: optionalStr,
  RAZORPAY_WEBHOOK_SECRET: optionalStr,
  PRICE_MONTHLY_PAISE: positiveInt.default(49_900),
  PRICE_YEARLY_PAISE: positiveInt.default(499_900),
  BILLING_CURRENCY: z.string().length(3).default('INR'),

  // Free-tier limits
  FREE_LIMIT_PROJECTS: limit.default(5),
  FREE_LIMIT_CAREER_GOALS: limit.default(5),
  FREE_LIMIT_LITERATURE: limit.default(5),

  // Admin bootstrap (consumed by the seed script only). No password: sign-in is
  // Google-only, so this names the Google address that gets the ADMIN role.
  ADMIN_EMAIL: optionalStr,

  // Rate limiting
  RATE_LIMIT_WINDOW_MIN: positiveInt.default(15),
  RATE_LIMIT_MAX: positiveInt.default(300),
  AUTH_RATE_LIMIT_MAX: positiveInt.default(10),
});

// ── Parse ─────────────────────────────────────────────────────────────────────
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .sort()
    .join('\n');

  process.stderr.write(
    `\n${RED}✖ Invalid environment configuration${RESET}\n\n${issues}\n\n` +
      `Checked: ${existsSync(envPath) ? envPath : `${envPath} (not found)`}\n` +
      `See .env.example for the full template.\n\n`,
  );
  process.exit(1);
}

const raw = parsed.data;

// ── Cross-field rules ─────────────────────────────────────────────────────────
const fatal: string[] = [];

if (raw.NODE_ENV === 'production') {
  if (raw.SESSION_SECRET.includes('replace_me')) {
    fatal.push('SESSION_SECRET is still the placeholder from .env.example.');
  }
  if (!raw.API_URL.startsWith('https://') || !raw.WEB_URL.startsWith('https://')) {
    fatal.push('API_URL and WEB_URL must use https:// in production.');
  }
  if (!raw.CORS_ORIGINS.includes(raw.WEB_URL)) {
    fatal.push('CORS_ORIGINS must include WEB_URL.');
  }
}

if (fatal.length > 0) {
  process.stderr.write(
    `\n${RED}✖ Unsafe production configuration${RESET}\n\n` +
      fatal.map((m) => `  • ${m}`).join('\n') +
      '\n\n',
  );
  process.exit(1);
}

// ── Derived, grouped config ───────────────────────────────────────────────────
// Optional integrations are discriminated on `enabled`, so once a consumer has
// checked the flag TypeScript knows the credentials are present.
const googleOn = Boolean(
  raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET && raw.GOOGLE_CALLBACK_URL,
);
const billingOn = Boolean(raw.RAZORPAY_KEY_ID && raw.RAZORPAY_KEY_SECRET);
const uploadsOn = Boolean(
  raw.CLOUDINARY_CLOUD_NAME && raw.CLOUDINARY_API_KEY && raw.CLOUDINARY_API_SECRET,
);

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProd: raw.NODE_ENV === 'production',
  isDev: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',

  port: raw.PORT,
  apiUrl: raw.API_URL,
  webUrl: raw.WEB_URL,
  corsOrigins: raw.CORS_ORIGINS,
  logLevel: raw.LOG_LEVEL,

  db: {
    url: raw.DATABASE_URL,
    directUrl: raw.DIRECT_URL ?? raw.DATABASE_URL,
  },

  session: {
    secret: raw.SESSION_SECRET,
    ttlDays: raw.SESSION_TTL_DAYS,
    ttlMs: raw.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    cookieName: raw.SESSION_COOKIE_NAME,
    cookieDomain: raw.COOKIE_DOMAIN,
  },

  google: googleOn
    ? ({
        enabled: true,
        clientId: raw.GOOGLE_CLIENT_ID as string,
        clientSecret: raw.GOOGLE_CLIENT_SECRET as string,
        callbackUrl: raw.GOOGLE_CALLBACK_URL as string,
      } as const)
    : ({ enabled: false } as const),

  mail: {
    enabled: Boolean(raw.BREVO_API_KEY || raw.SMTP_HOST),
    brevoApiKey: raw.BREVO_API_KEY,
    host: raw.SMTP_HOST,
    port: raw.SMTP_PORT,
    secure: raw.SMTP_SECURE,
    user: raw.SMTP_USER,
    pass: raw.SMTP_PASS,
    fromName: raw.MAIL_FROM_NAME,
    fromAddress: raw.MAIL_FROM_ADDRESS,
    supportEmail: raw.SUPPORT_EMAIL,
  },

  reminders: {
    enabled: raw.ENABLE_REMINDER_WORKER,
    cron: raw.REMINDER_CRON,
    cronTz: raw.REMINDER_CRON_TZ,
    cronSecret: raw.CRON_SECRET,
  },

  uploads: uploadsOn
    ? ({
        enabled: true as const,
        cloudName: raw.CLOUDINARY_CLOUD_NAME as string,
        apiKey: raw.CLOUDINARY_API_KEY as string,
        apiSecret: raw.CLOUDINARY_API_SECRET as string,
      } as const)
    : ({ enabled: false as const } as const),

  billing: billingOn
    ? ({
        enabled: true,
        keyId: raw.RAZORPAY_KEY_ID as string,
        keySecret: raw.RAZORPAY_KEY_SECRET as string,
        webhookSecret: raw.RAZORPAY_WEBHOOK_SECRET,
        currency: raw.BILLING_CURRENCY,
        prices: { monthly: raw.PRICE_MONTHLY_PAISE, yearly: raw.PRICE_YEARLY_PAISE },
      } as const)
    : ({ enabled: false } as const),

  freeLimits: {
    projects: raw.FREE_LIMIT_PROJECTS,
    careerGoals: raw.FREE_LIMIT_CAREER_GOALS,
    literature: raw.FREE_LIMIT_LITERATURE,
  },

  adminSeed: raw.ADMIN_EMAIL ? ({ email: raw.ADMIN_EMAIL } as const) : undefined,

  rateLimit: {
    windowMs: raw.RATE_LIMIT_WINDOW_MIN * 60 * 1000,
    max: raw.RATE_LIMIT_MAX,
    authMax: raw.AUTH_RATE_LIMIT_MAX,
  },
} as const;

export type Env = typeof env;
