/**
 * Bug reports, feature requests and feedback.
 *
 * The submitting side lives here; triage is Part 11's admin module.
 *
 * `userId` is nullable on the model with `onDelete: SetNull`, so a report
 * survives its author deleting their account — the maintainers keep the useful
 * content, and the personal link is severed.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { createLogger } from '../../config/logger.js';
import { notifyAdmins } from '../notifications/notify.js';
import type { Pagination } from '../../middleware/validate.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import type { CreateReportInput, ListOwnReportsQuery } from './reports.schema.js';

const log = createLogger('reports');

type Report = Prisma.ReportGetPayload<Record<string, never>>;

export async function create(userId: string, input: CreateReportInput): Promise<Report> {
  const report = await prisma.report.create({
    data: {
      userId,
      type: input.type,
      featurePage: input.featurePage ?? null,
      title: input.title ?? null,
      description: input.description,
    },
  });

  // The people who can act on it are told; the submitter can already see it
  // on the Help page, so they are not.
  const author = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  await notifyAdmins({
    title: `New ${input.type.toLowerCase().replace('feature', 'feature request')} from ${author?.name ?? author?.email ?? 'a user'}`,
    message: input.title ?? input.description.slice(0, 140),
    link: `/admin?tab=reports&report=${report.id}`,
  });

  log.info({ reportId: report.id, type: input.type }, 'Report submitted');
  return report;
}

/** The caller's own reports, so they can follow what happened to them. */
export async function listOwn(
  userId: string,
  query: ListOwnReportsQuery,
): Promise<Paginated<Report>> {
  const where: Prisma.ReportWhereInput = {
    userId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [data, total] = await prisma.$transaction([
    prisma.report.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(pagination) }),
    prisma.report.count({ where }),
  ]);

  return paginate(data, total, pagination);
}
