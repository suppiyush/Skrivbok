/**
 * Platform statistics and analytics.
 *
 * The legacy application had a 393-line Analytics page that was written but
 * never wired into the router, so none of this existed. It does now.
 *
 * Time series are grouped with `date_trunc` in Postgres rather than by loading
 * rows and bucketing them in JavaScript. The `$queryRaw` tag parameterises its
 * interpolations, so the day count and cutoff below are bound values, not
 * string concatenation.
 */
import { prisma } from '../../db/prisma.js';

export interface PlatformStats {
  users: {
    total: number;
    pro: number;
    free: number;
    admins: number;
    newThisWeek: number;
    activeThisWeek: number;
  };
  content: Record<string, number>;
  revenue: {
    capturedPaise: number;
    capturedCount: number;
    failedCount: number;
    refundedCount: number;
  };
  engagement: { withProjects: number; withProfile: number; neverLoggedIn: number };
}

/** The admin dashboard headline numbers. */
export async function platformStats(): Promise<PlatformStats> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [
    users,
    pro,
    admins,
    newThisWeek,
    activeThisWeek,
    projects,
    ideas,
    notes,
    journalEntries,
    deadlines,
    futureWork,
    literature,
    careerGoals,
    calendarEvents,
    meetingRequests,
    reports,
    revenue,
    failedCount,
    refundedCount,
    withProjects,
    withProfile,
    neverLoggedIn,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { plan: 'PRO' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: weekAgo } } }),
    prisma.project.count(),
    prisma.idea.count(),
    prisma.note.count(),
    prisma.journalEntry.count(),
    prisma.deadline.count(),
    prisma.futureWork.count(),
    prisma.literature.count(),
    prisma.careerGoal.count(),
    prisma.calendarEvent.count(),
    prisma.meetingRequest.count(),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.payment.aggregate({
      where: { status: 'CAPTURED' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.payment.count({ where: { status: 'REFUNDED' } }),
    prisma.user.count({ where: { ownedProjects: { some: {} } } }),
    prisma.user.count({ where: { profile: { isNot: null } } }),
    prisma.user.count({ where: { lastLoginAt: null } }),
  ]);

  return {
    users: { total: users, pro, free: users - pro, admins, newThisWeek, activeThisWeek },
    content: {
      projects,
      ideas,
      notes,
      journalEntries,
      deadlines,
      futureWork,
      literature,
      careerGoals,
      calendarEvents,
      meetingRequests,
      openReports: reports,
    },
    revenue: {
      capturedPaise: revenue._sum.amount ?? 0,
      capturedCount: revenue._count._all,
      failedCount,
      refundedCount,
    },
    engagement: { withProjects, withProfile, neverLoggedIn },
  };
}

export interface DailyPoint {
  date: string;
  count: number;
}

/** Rows come back as bigint from COUNT(*); normalised to number here. */
function toPoints(rows: { day: Date; count: bigint }[]): DailyPoint[] {
  return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) }));
}

/**
 * Daily counts over the last `days` days.
 *
 * `generate_series` fills gaps, so a day with no activity is a zero rather than
 * a missing point — otherwise a chart would draw a straight line across a quiet
 * week and misrepresent it.
 */
export async function signupSeries(days: number): Promise<DailyPoint[]> {
  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT d.day::date AS day, COUNT(u.id) AS count
    FROM generate_series(
      date_trunc('day', NOW() - (${days}::int - 1) * INTERVAL '1 day'),
      date_trunc('day', NOW()),
      INTERVAL '1 day'
    ) AS d(day)
    LEFT JOIN users u ON date_trunc('day', u."createdAt") = d.day
    GROUP BY d.day
    ORDER BY d.day ASC
  `;
  return toPoints(rows);
}

export async function revenueSeries(days: number): Promise<{ date: string; paise: number }[]> {
  const rows = await prisma.$queryRaw<{ day: Date; total: bigint | null }[]>`
    SELECT d.day::date AS day, COALESCE(SUM(p.amount), 0) AS total
    FROM generate_series(
      date_trunc('day', NOW() - (${days}::int - 1) * INTERVAL '1 day'),
      date_trunc('day', NOW()),
      INTERVAL '1 day'
    ) AS d(day)
    LEFT JOIN payments p
      ON date_trunc('day', p."createdAt") = d.day AND p.status = 'CAPTURED'
    GROUP BY d.day
    ORDER BY d.day ASC
  `;
  return rows.map((r) => ({
    date: r.day.toISOString().slice(0, 10),
    paise: Number(r.total ?? 0),
  }));
}

/**
 * Daily active users, measured by `lastLoginAt`.
 *
 * A rough proxy: it counts a session start, not real activity, and only the
 * most recent one per user. Good enough for a trend line, not for billing.
 */
export async function activeUserSeries(days: number): Promise<DailyPoint[]> {
  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT d.day::date AS day, COUNT(u.id) AS count
    FROM generate_series(
      date_trunc('day', NOW() - (${days}::int - 1) * INTERVAL '1 day'),
      date_trunc('day', NOW()),
      INTERVAL '1 day'
    ) AS d(day)
    LEFT JOIN users u ON date_trunc('day', u."lastLoginAt") = d.day
    GROUP BY d.day
    ORDER BY d.day ASC
  `;
  return toPoints(rows);
}

/** Which features are actually used, as a share of users who use each at all. */
export async function featureAdoption(): Promise<{ feature: string; users: number }[]> {
  const [projects, ideas, notes, journal, deadlines, literature, career, calendar] =
    await prisma.$transaction([
      prisma.user.count({ where: { ownedProjects: { some: {} } } }),
      prisma.user.count({ where: { ideas: { some: {} } } }),
      prisma.user.count({ where: { notes: { some: {} } } }),
      prisma.user.count({ where: { journalEntries: { some: {} } } }),
      prisma.user.count({ where: { deadlines: { some: {} } } }),
      prisma.user.count({ where: { literature: { some: {} } } }),
      prisma.user.count({ where: { careerGoals: { some: {} } } }),
      prisma.user.count({ where: { calendarEvents: { some: {} } } }),
    ]);

  return [
    { feature: 'projects', users: projects },
    { feature: 'ideas', users: ideas },
    { feature: 'notes', users: notes },
    { feature: 'journal', users: journal },
    { feature: 'deadlines', users: deadlines },
    { feature: 'literature', users: literature },
    { feature: 'careerGoals', users: career },
    { feature: 'calendar', users: calendar },
  ].sort((a, b) => b.users - a.users);
}

export async function analytics(days: number) {
  const [signups, revenue, active, adoption] = await Promise.all([
    signupSeries(days),
    revenueSeries(days),
    activeUserSeries(days),
    featureAdoption(),
  ]);

  return { days, signups, revenue, activeUsers: active, featureAdoption: adoption };
}

/**
 * The small public counters shown on the landing page.
 *
 * Deliberately coarse and non-identifying: totals only, no names, no growth
 * rates that could be differenced over time to infer individual signups.
 */
export async function publicStats(): Promise<Record<string, number>> {
  const [users, projects, ideas, careerGoals] = await prisma.$transaction([
    prisma.user.count(),
    prisma.project.count(),
    prisma.idea.count(),
    prisma.careerGoal.count(),
  ]);

  return { users, projects, ideas, careerGoals };
}
