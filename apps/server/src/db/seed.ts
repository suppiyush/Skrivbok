/**
 * Database seed.
 *
 *   npm run db:seed          (npm)
 *   npm run docker:seed      (Docker)
 *
 * Seeds one thing: the admin account, from ADMIN_EMAIL. No password is set,
 * because sign-in is Google-only — this grants the ADMIN role to whoever signs
 * in with that Google address, so it must be an address you control. If the
 * account already exists, it is made an admin; nothing else about it changes.
 * If ADMIN_EMAIL is unset, nothing is created and the script says so.
 *
 * No sample data is created, in any environment: a fresh database stays empty
 * apart from the admin.
 *
 * Idempotent: the write is an upsert, so running it repeatedly is safe.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient({ datasourceUrl: env.db.url });
const log = logger.child({ module: 'seed' });

async function seedAdmin(): Promise<void> {
  if (!env.adminSeed) {
    log.warn(
      'ADMIN_EMAIL not set — no admin account created. ' +
        'Set it in .env and re-run to bootstrap one.',
    );
    return;
  }

  const email = env.adminSeed.email.toLowerCase().trim();

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: {
      email,
      name: 'Administrator',
      role: 'ADMIN',
      // Left unverified: the Google flow marks it verified when this address
      // signs in for the first time and claims the row.
      emailPreference: { create: {} },
    },
  });

  log.info(
    { email: admin.email },
    'Admin account ready — sign in with this Google address to claim it',
  );
}

async function main(): Promise<void> {
  log.info({ env: env.nodeEnv }, 'Seeding database…');
  await seedAdmin();
  log.info('Seed complete');
}

try {
  await main();
} catch (error) {
  log.error({ err: error }, 'Seed failed');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
