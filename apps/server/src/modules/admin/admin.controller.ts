/** Admin: HTTP in, HTTP out. Every route behind requireAuth + requireAdmin. */
import type { Request, RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import type { Pagination } from '../../middleware/validate.js';
import type {
  AnalyticsQuery,
  ListAdminPaymentsQuery,
  ListReportsQuery,
  ListUsersQuery,
  UpdateReportInput,
  UpdateUserInput,
} from './admin.schema.js';
import * as service from './admin.service.js';
import * as analyticsService from './analytics.service.js';

const targetId = (req: Request): string => req.params['id'] as string;

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const stats: RequestHandler = async (_req, res) => {
  res.json(await analyticsService.platformStats());
};

export const analytics: RequestHandler = async (req, res) => {
  const { days } = req.query as unknown as AnalyticsQuery;
  res.json(await analyticsService.analytics(days));
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const listUsers: RequestHandler = async (req, res) => {
  res.json(await service.listUsers(req.query as unknown as ListUsersQuery));
};

export const getUser: RequestHandler = async (req, res) => {
  res.json(await service.getUser(targetId(req)));
};

export const updateUser: RequestHandler = async (req, res) => {
  const admin = currentUser(req);
  res.json(await service.updateUser(admin.id, targetId(req), req.body as UpdateUserInput));
};

export const deleteUser: RequestHandler = async (req, res) => {
  const admin = currentUser(req);
  await service.deleteUser(admin.id, targetId(req));
  res.status(204).end();
};

export const revokeSessions: RequestHandler = async (req, res) => {
  const admin = currentUser(req);
  res.json({ revoked: await service.revokeUserSessions(admin.id, targetId(req)) });
};

// ── Billing ───────────────────────────────────────────────────────────────────

export const listSubscriptions: RequestHandler = async (req, res) => {
  res.json(await service.listSubscriptions(req.query as unknown as Pagination));
};

export const listPayments: RequestHandler = async (req, res) => {
  res.json(await service.listPayments(req.query as unknown as ListAdminPaymentsQuery));
};

// ── Reports ───────────────────────────────────────────────────────────────────

export const listReports: RequestHandler = async (req, res) => {
  res.json(await service.listReports(req.query as unknown as ListReportsQuery));
};

export const getReport: RequestHandler = async (req, res) => {
  res.json(await service.getReport(targetId(req)));
};

export const updateReport: RequestHandler = async (req, res) => {
  const admin = currentUser(req);
  res.json(await service.updateReport(admin.id, targetId(req), req.body as UpdateReportInput));
};

// ── Public ────────────────────────────────────────────────────────────────────

/** Landing-page counters. Not admin — mounted on its own public router. */
export const publicStats: RequestHandler = async (_req, res) => {
  res.json(await analyticsService.publicStats());
};
