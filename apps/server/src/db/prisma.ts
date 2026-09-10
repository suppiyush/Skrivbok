/**
 * The Prisma client — one instance for the whole process.
 *
 * The legacy server opened two independent connection pools (one in the API,
 * one in the reminder scheduler) against the same database. Everything goes
 * through this single client instead.
 *
 * In development `tsx watch` reloads modules on every save; without the global
 * cache below each reload would leak another pool until Postgres refused new
 * connections.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('prisma');

function createClient(): PrismaClient {
  const client = new PrismaClient({
    datasourceUrl: env.db.url,
    // Route Prisma's own diagnostics through pino rather than stdout.
    log: [
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
      ...(env.isDev ? ([{ emit: 'event', level: 'query' }] as const) : []),
    ],
  });

  client.$on('warn', (e) => log.warn({ target: e.target }, e.message));
  client.$on('error', (e) => log.error({ target: e.target }, e.message));

  if (env.isDev) {
    client.$on('query', (e) => {
      // Params are omitted deliberately — they routinely contain personal data.
      log.debug({ durationMs: e.duration }, e.query);
    });
  }

  return client;
}

// `globalThis` cache survives hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!env.isProd) {
  globalForPrisma.prisma = prisma;
}

/** Verify the database is reachable. Called at boot and by the readiness probe. */
export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

/** Close the pool during graceful shutdown. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Prisma's well-known error codes, named so call sites read clearly.
 * @see https://www.prisma.io/docs/orm/reference/error-reference
 */
export const PrismaErrorCode = {
  UNIQUE_CONSTRAINT: 'P2002',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
  RECORD_NOT_FOUND: 'P2025',
} as const;

/** Narrowing helper: was this a known Prisma request error with the given code? */
export function isPrismaError(
  error: unknown,
  code: (typeof PrismaErrorCode)[keyof typeof PrismaErrorCode],
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export { Prisma };
