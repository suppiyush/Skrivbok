/**
 * Process entry point: network binding and lifecycle only.
 *
 * All application wiring lives in `app.ts`. Keeping them separate means tests
 * can build an app without opening a port, and the shutdown logic below has one
 * obvious home.
 */
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { checkDatabaseConnection, disconnectDatabase } from './db/prisma.js';

const app = createApp();

// Fail fast and loudly if the database is unreachable at boot. The process still
// starts — the readiness probe reports the failure — so a transient outage does
// not turn into a crash loop.
void checkDatabaseConnection().then(
  () => logger.info('Database connection established'),
  (err: unknown) => logger.error({ err }, 'Database unreachable at startup'),
);

const server = app.listen(env.port, () => {
  logger.info(
    {
      port: env.port,
      env: env.nodeEnv,
      apiUrl: env.apiUrl,
      webUrl: env.webUrl,
      integrations: {
        google: env.google.enabled,
        mail: env.mail.enabled,
        billing: env.billing.enabled,
        reminders: env.reminders.enabled,
      },
    },
    `Skrivbok API listening on ${env.apiUrl}`,
  );
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Stop accepting connections, let in-flight requests finish, then exit. Without
// this, a deploy can drop live requests mid-write.
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'Shutting down…');

  const force = setTimeout(() => {
    logger.error('Shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error while closing the HTTP server');
      process.exit(1);
    }
    void disconnectDatabase()
      .catch((e: unknown) => logger.error({ err: e }, 'Error disconnecting from the database'))
      .finally(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A crash with an unknown state is not recoverable — log it properly, then let
// the supervisor restart us. Silent swallowing is what hid bugs in the old server.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});
