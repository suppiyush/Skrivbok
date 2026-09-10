/**
 * Database seed.
 *
 *   npm run db:seed --workspace @skrivbok/server
 *
 * Idempotent: every write is an upsert, so running it repeatedly is safe.
 *
 * Two things are seeded:
 *   1. The admin account, from ADMIN_EMAIL / ADMIN_PASSWORD. Unlike the legacy
 *      server there is no hardcoded fallback credential — if those variables
 *      are unset, no admin is created and the script says so.
 *   2. In development only, a demo user with sample records across every
 *      feature, so the API can be exercised without clicking through a UI.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient({ datasourceUrl: env.db.url });
const log = logger.child({ module: 'seed' });

const BCRYPT_ROUNDS = 12;

/** Midnight-anchored date `days` from now, for readable sample data. */
function daysFromNow(days: number, hour = 9): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

async function seedAdmin(): Promise<void> {
  if (!env.adminSeed) {
    log.warn(
      'ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin account created. ' +
        'Set both in .env and re-run to bootstrap one.',
    );
    return;
  }

  const email = env.adminSeed.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(env.adminSeed.password, BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email },
    // Re-running must not silently reset a rotated admin password, so `update`
    // only ensures the role. Change the password through the app, not the seed.
    update: { role: 'ADMIN' },
    create: {
      email,
      name: 'Administrator',
      passwordHash,
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      emailPreference: { create: {} },
    },
  });

  log.info({ email: admin.email }, 'Admin account ready');
}

async function seedDemoData(): Promise<void> {
  if (env.isProd) {
    log.info('Production environment — skipping demo data');
    return;
  }

  const email = 'demo@skrivbok.local';
  const passwordHash = await bcrypt.hash('demo1234', BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Demo Researcher',
      passwordHash,
      timezone: 'Europe/Stockholm',
      emailVerifiedAt: new Date(),
      emailPreference: { create: {} },
      profile: {
        create: {
          fullName: 'Demo Researcher',
          designation: 'Postdoctoral Fellow',
          department: 'Department of Computer Science',
          institution: 'Example University',
          researchKeywords: 'distributed systems, formal methods',
          researchDescription:
            'Consensus protocols and the gap between what they promise on paper and what they do under partition.',
        },
      },
    },
  });

  // A second account, so collaboration features (project members, meeting
  // requests, calendar access) have someone to interact with.
  const colleague = await prisma.user.upsert({
    where: { email: 'colleague@skrivbok.local' },
    update: {},
    create: {
      email: 'colleague@skrivbok.local',
      name: 'Sam Colleague',
      passwordHash,
      timezone: 'Europe/Stockholm',
      emailVerifiedAt: new Date(),
      emailPreference: { create: {} },
    },
  });

  // Seeded content is keyed on deterministic ids so re-running updates rather
  // than duplicating.
  await prisma.project.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: {
      id: 'seed-project-1',
      ownerId: user.id,
      name: 'Thesis: Verified Consensus',
      description: 'Formal verification of a Raft-style consensus protocol.',
      progress: 35,
      members: {
        create: [
          {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: 'OWNER',
            acceptedAt: new Date(),
          },
          { userId: colleague.id, email: colleague.email, name: colleague.name, role: 'EDITOR' },
        ],
      },
      brief: {
        create: {
          projectTitle: 'Verified Consensus',
          objectives: 'Produce a machine-checked proof of safety and liveness.',
          timeline: '18 months',
          primaryAudience: 'Distributed systems researchers',
        },
      },
    },
  });

  await prisma.idea.upsert({
    where: { id: 'seed-idea-1' },
    update: {},
    create: {
      id: 'seed-idea-1',
      userId: user.id,
      title: 'Model checking as a teaching tool',
      content: 'Undergraduates could learn invariants faster with a visual checker.',
      category: 'teaching',
      color: 'BLUE',
    },
  });

  await prisma.note.upsert({
    where: { id: 'seed-note-1' },
    update: {},
    create: {
      id: 'seed-note-1',
      userId: user.id,
      title: 'Supervisor meeting',
      content: 'Discussed chapter 3 structure. Revisit the failure model.',
      category: 'meetings',
    },
  });

  await prisma.journalEntry.upsert({
    where: { id: 'seed-journal-1' },
    update: {},
    create: {
      id: 'seed-journal-1',
      userId: user.id,
      title: 'Slow week',
      content: 'Proof obligations are harder than expected, but the shape is right.',
      entryDate: new Date(),
      mood: 'reflective',
    },
  });

  await prisma.deadline.upsert({
    where: { id: 'seed-deadline-1' },
    update: {},
    create: {
      id: 'seed-deadline-1',
      userId: user.id,
      title: 'POPL abstract submission',
      description: 'Abstract deadline is one week before the full paper.',
      dueAt: daysFromNow(7, 23),
      timezone: 'Europe/Stockholm',
      priority: 'HIGH',
    },
  });

  await prisma.futureWork.upsert({
    where: { id: 'seed-future-1' },
    update: {},
    create: {
      id: 'seed-future-1',
      userId: user.id,
      title: 'Extend to Byzantine faults',
      description: 'Natural follow-up once the crash-fault proof lands.',
      priority: 'MEDIUM',
      timeline: 'Next year',
    },
  });

  await prisma.literature.upsert({
    where: { id: 'seed-lit-1' },
    update: {},
    create: {
      id: 'seed-lit-1',
      userId: user.id,
      title: 'In Search of an Understandable Consensus Algorithm',
      authors: 'Ongaro, Ousterhout',
      year: 2014,
      links: ['https://raft.github.io/raft.pdf'],
      tags: ['consensus', 'raft', 'foundational'],
      summary: 'The Raft paper. Baseline for the protocol being verified.',
    },
  });

  await prisma.careerGoal.upsert({
    where: { id: 'seed-goal-1' },
    update: {},
    create: {
      id: 'seed-goal-1',
      userId: user.id,
      title: 'Secure a tenure-track position',
      description: 'Build the publication and teaching record for an application.',
      goalType: 'career',
      totalStages: 5,
      currentStage: 2,
      stageDescription: 'Two first-author papers accepted.',
      startAt: daysFromNow(-365),
      targetAt: daysFromNow(730),
      history: {
        create: [
          { stage: 1, description: 'First paper submitted', recordedAt: daysFromNow(-200) },
          { stage: 2, description: 'First paper accepted', recordedAt: daysFromNow(-60) },
        ],
      },
    },
  });

  await prisma.calendarEvent.upsert({
    where: { id: 'seed-event-1' },
    update: {},
    create: {
      id: 'seed-event-1',
      userId: user.id,
      title: 'Weekly supervision',
      startAt: daysFromNow(2, 10),
      endAt: daysFromNow(2, 11),
      timezone: 'Europe/Stockholm',
      category: 'Work',
      recurrence: 'WEEKLY',
      visibility: 'BUSY',
    },
  });

  log.info(
    { demo: user.email, colleague: colleague.email },
    'Demo data ready — both demo accounts use the password: demo1234',
  );
}

async function main(): Promise<void> {
  log.info({ env: env.nodeEnv }, 'Seeding database…');
  await seedAdmin();
  await seedDemoData();
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
