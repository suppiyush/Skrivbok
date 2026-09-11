/**
 * Database seed.
 *
 *   npm run db:seed --workspace @skrivbok/server
 *
 * Idempotent: every write is an upsert, so running it repeatedly is safe.
 *
 * Two things are seeded:
 *   1. The admin account, from ADMIN_EMAIL. No password is set, because sign-in
 *      is Google-only: seeding the row grants the ADMIN role to whoever later
 *      signs in with that Google address, so it must be an address you control.
 *      If ADMIN_EMAIL is unset, no admin is created and the script says so.
 *   2. In development only, a demo user with sample records across every
 *      feature, so the API can be exercised without clicking through a UI.
 *      These accounts hold data; they are not sign-in credentials.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient({ datasourceUrl: env.db.url });
const log = logger.child({ module: 'seed' });

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

async function seedDemoData(): Promise<void> {
  if (env.isProd) {
    log.info('Production environment — skipping demo data');
    return;
  }

  const email = 'demo@skrivbok.local';

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Demo Researcher',
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
      // The brief is now whatever headings the team writes. These are the ones
      // the old fixed fields happened to cover, so the demo reads the same.
      brief: {
        create: {
          sections: {
            create: [
              {
                position: 0,
                heading: 'Project overview',
                body: 'A machine-checked treatment of a consensus protocol, aimed at distributed systems researchers.',
              },
              {
                position: 1,
                heading: 'Objectives',
                body: 'Produce a machine-checked proof of safety and liveness.',
              },
              { position: 2, heading: 'Timeline', body: '18 months.' },
            ],
          },
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
    'Demo data ready — these are data fixtures, not sign-in accounts (sign-in is Google-only)',
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
