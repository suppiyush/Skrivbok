/** Calendar access and sharing: HTTP in, HTTP out. */
import type { Request, RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import type {
  ApproveAccessInput,
  AvailabilityQuery,
  CreateAccessRequestInput,
  ListAccessRequestsQuery,
  SharedRangeQuery,
  UpdateAccessInput,
} from './access.schema.js';
import * as service from './access.service.js';
import * as sharing from './sharing.service.js';

const id = (req: Request): string => req.params['id'] as string;

// ── Requests ──────────────────────────────────────────────────────────────────

export const createRequest: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await service.createRequest(user.id, req.body as CreateAccessRequestInput));
};

export const listRequests: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.listRequests(user.id, req.query as unknown as ListAccessRequestsQuery));
};

export const approveRequest: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { level } = req.body as ApproveAccessInput;
  res.json(await service.approveRequest(user.id, id(req), level));
};

export const rejectRequest: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.rejectRequest(user.id, id(req)));
};

export const withdrawRequest: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.withdrawRequest(user.id, id(req));
  res.status(204).end();
};

// ── Grants ────────────────────────────────────────────────────────────────────

export const listGranted: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ grants: await service.listGranted(user.id) });
};

export const listHeld: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ grants: await service.listHeld(user.id) });
};

export const updateGrant: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { level } = req.body as UpdateAccessInput;
  res.json(await service.updateGrant(user.id, id(req), level));
};

export const revokeGrant: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.revokeGrant(user.id, id(req));
  res.status(204).end();
};

// ── Shared views ──────────────────────────────────────────────────────────────

export const sharedCalendar: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const email = req.params['email'] as string;
  const { from, to } = req.query as unknown as SharedRangeQuery;
  res.json(await sharing.sharedCalendar(user.id, email, from, to));
};

export const availability: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { from, to, email } = req.query as unknown as AvailabilityQuery;
  res.json({ availability: await sharing.availability(user.id, email, from, to) });
};

export const combined: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { from, to } = req.query as unknown as SharedRangeQuery;
  res.json(await sharing.combined(user.id, from, to));
};
