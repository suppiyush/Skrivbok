/**
 * The background worker process.
 *
 * Run separately from the API:
 *
 *   npm run worker --workspace @skrivbok/server
 *
 * It is a **separate process on purpose**. The legacy server called
 * `initializeReminderScheduler()` from inside `server.js`, which meant every
 * API instance ran its own copy of the cron — so scaling to two instances would
 * have doubled every reminder. Here the API sets `ENABLE_REMINDER_WORKER=false`
 * and exactly one worker runs.
 *
 * Ticks do not overlap: if a pass is still running when the next fires, the new
 * one is skipped rather than queued behind it.
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { checkDatabaseConnection, disconnectDatabase } from '../db/prisma.js';
import { closeTransport, verifyTransport } from '../emails/transport.js';
import { runCleanup, runReminderTick } from './reminders.service.js';

const log = logger.child({ module: 'worker' });

let running = false;

async function tick(): Promise<void> {
  if (running) {
    log.warn('Previous reminder pass still running — skipping this tick');
    return;
  }

  running = true;
  const startedAt = Date.now();

  try {
    const result = await runReminderTick();

    // Only worth a line when something happened; otherwise this logs every few
    // minutes for ever and buries anything useful.
    const sent =
      result.deadlineEmails +
      result.agendaEmails +
      result.overdueNotices +
      result.eventReminders +
      result.meetingReminders +
      result.subscriptionNotices;
    if (sent > 0 || result.skipped > 0) {
      log.info({ ...result, durationMs: Date.now() - startedAt }, 'Reminder pass complete');
    } else {
      log.debug({ ...result, durationMs: Date.now() - startedAt }, 'Reminder pass — nothing due');
    }
  } catch (error) {
    // A failed pass must not kill the worker; the next tick tries again.
    log.error({ err: error }, 'Reminder pass failed');
  } finally {
    running = false;
  }
}

async function cleanup(): Promise<void> {
  try {
    await runCleanup();
  } catch (error) {
    log.error({ err: error }, 'Cleanup failed');
  }
}

async function main(): Promise<void> {
  if (!env.reminders.enabled) {
    log.warn('ENABLE_REMINDER_WORKER is false — worker exiting');
    return;
  }

  if (!cron.validate(env.reminders.cron)) {
    log.fatal({ cron: env.reminders.cron }, 'REMINDER_CRON is not a valid cron expression');
    process.exit(1);
  }

  await checkDatabaseConnection();
  const mailReady = await verifyTransport();

  if (!mailReady) {
    // Not fatal: the worker still runs and logs what it would have sent, which
    // is useful in development and makes a misconfiguration obvious.
    log.warn('Mail is not configured — reminders will be logged, not delivered');
  }

  const reminderTask = cron.schedule(env.reminders.cron, () => void tick(), {
    timezone: env.reminders.cronTz,
  });

  // Housekeeping once a day, offset from the hour so it does not compete with a
  // reminder pass.
  const cleanupTask = cron.schedule('17 3 * * *', () => void cleanup(), {
    timezone: env.reminders.cronTz,
  });

  log.info(
    { cron: env.reminders.cron, timezone: env.reminders.cronTz, mailReady },
    'Reminder worker started',
  );

  // Run once immediately, so a restart does not leave a gap until the next tick.
  await tick();

  const shutdown = (signal: string): void => {
    log.info({ signal }, 'Worker shutting down…');
    // `stop()` is async in node-cron v4. Not awaited: it only stops future
    // firings, and the in-flight tick is allowed to finish on its own.
    void reminderTask.stop();
    void cleanupTask.stop();
    closeTransport();

    void disconnectDatabase()
      .catch((e: unknown) => log.error({ err: e }, 'Error disconnecting from the database'))
      .finally(() => process.exit(0));
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  log.fatal({ err: error }, 'Worker failed to start');
  process.exit(1);
});
