/** Meeting requests: HTTP in, HTTP out. No SQL, no authorization decisions. */
import type { Request, RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import type {
  CreateMeetingRequestInput,
  ListMeetingRequestsQuery,
  RescheduleInput,
} from './meetings.schema.js';
import * as service from './meetings.service.js';
import * as groups from './group-meetings.service.js';
import type { CreateGroupMeetInput } from './meetings.schema.js';

const requestId = (req: Request): string => req.params['id'] as string;

// ── Group meets ───────────────────────────────────────────────────────────────

export const contacts: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ contacts: await groups.contacts(user.id) });
};

export const createGroup: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await groups.create(user.id, req.body as CreateGroupMeetInput));
};

export const cancelGroup: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await groups.cancel(user.id, req.params['groupId'] as string);
  res.status(204).end();
};

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.list(user.id, req.query as unknown as ListMeetingRequestsQuery));
};

/**
 * The detail view also reports the caller's own clashing events, so the person
 * deciding can see the conflict before accepting.
 */
export const getById: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const request = await service.getById(user.id, requestId(req));
  const conflicts = await service.conflictsFor(user.id, request.startAt, request.endAt, request.id);
  res.json({ ...request, conflicts });
};

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await service.create(user.id, req.body as CreateMeetingRequestInput));
};

export const reschedule: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.reschedule(user.id, requestId(req), req.body as RescheduleInput));
};

export const accept: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.accept(user.id, requestId(req)));
};

export const decline: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.decline(user.id, requestId(req)));
};

export const cancel: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.cancel(user.id, requestId(req)));
};
