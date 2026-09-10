/**
 * Structured logging.
 *
 * `console.log` is banned by ESLint — use this logger everywhere. In development
 * it pretty-prints; in production it emits newline-delimited JSON that log
 * aggregators can parse.
 *
 * Use a child logger to attach persistent context:
 *   const log = logger.child({ module: 'auth' });
 */
import pino, { type LoggerOptions } from 'pino';
import { env } from './env.js';

/**
 * Keys whose values are stripped from logs. The legacy server logged raw request
 * bodies, which meant passwords and payment signatures ended up on disk.
 */
const REDACT_PATHS = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'token',
  'sessionToken',
  'refreshToken',
  'secret',
  'authorization',
  'cookie',
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.secret',
  'razorpay_signature',
  'razorpaySignature',
];

const options: LoggerOptions = {
  level: env.logLevel,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  // `null` (not undefined) tells pino to omit pid/hostname entirely.
  base: env.isProd ? { service: 'skrivbok-server', env: env.nodeEnv } : null,
  formatters: {
    // Emit `"level":"info"` rather than `"level":30` — friendlier for most sinks.
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(env.isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      }
    : {}),
};

export const logger = pino(options);

/** Namespaced child logger. Prefer this over the bare `logger` inside modules. */
export const createLogger = (module: string) => logger.child({ module });

export type Logger = typeof logger;
