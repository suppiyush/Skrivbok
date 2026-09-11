/** Projects: HTTP in, HTTP out. No SQL, no authorization decisions. */
import type { Request, RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { getLimitStatus } from '../billing/limits.service.js';
import * as briefService from './brief.service.js';
import * as meetingsService from './meetings.service.js';
import * as memberService from './members.service.js';
import type {
  AddMemberInput,
  CreateProjectInput,
  ListProjectsQuery,
  TransferOwnershipInput,
  UpdateMemberInput,
  UpdateProjectInput,
  UpsertBriefInput,
  CreateMeetingInput,
  UpdateMeetingInput,
} from './projects.schema.js';
import * as service from './projects.service.js';

// Both are guaranteed present and cuid-shaped by `validate({ params })`.
const projectId = (req: Request): string => req.params['id'] as string;
const memberId = (req: Request): string => req.params['memberId'] as string;

// ── Projects ──────────────────────────────────────────────────────────────────

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.list(user.id, req.query as unknown as ListProjectsQuery));
};

/** Lets the UI show "3 of 5 used" and disable the create button before trying. */
export const quota: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await getLimitStatus(user.id, 'projects'));
};

export const getById: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.getById(user.id, projectId(req)));
};

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await service.create(user.id, req.body as CreateProjectInput));
};

export const update: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.update(user.id, projectId(req), req.body as UpdateProjectInput));
};

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.remove(user.id, projectId(req));
  res.status(204).end();
};

// ── Members ───────────────────────────────────────────────────────────────────

export const listMembers: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ members: await memberService.list(user.id, projectId(req)) });
};

export const addMember: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res
    .status(201)
    .json(await memberService.add(user.id, projectId(req), req.body as AddMemberInput));
};

export const updateMember: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { role } = req.body as UpdateMemberInput;
  res.json(await memberService.updateRole(user.id, projectId(req), memberId(req), role));
};

export const removeMember: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await memberService.remove(user.id, projectId(req), memberId(req));
  res.status(204).end();
};

export const acceptInvite: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await memberService.accept(user.id, projectId(req)));
};

export const transferOwnership: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const body = req.body as TransferOwnershipInput;
  await memberService.transferOwnership(user.id, projectId(req), body.memberId);
  res.json(await service.getById(user.id, projectId(req)));
};

// ── Brief ─────────────────────────────────────────────────────────────────────

export const getBrief: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ brief: await briefService.get(user.id, projectId(req)) });
};

export const saveBrief: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  // Wrapped to match `getBrief`, so the client reads one shape from both.
  const brief = await briefService.upsert(user.id, projectId(req), req.body as UpsertBriefInput);
  res.json({ brief });
};

// ── Meetings ──────────────────────────────────────────────────────────────────

const meetingId = (req: Request): string => req.params['meetingId'] as string;

export const listMeetings: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ meetings: await meetingsService.list(user.id, projectId(req)) });
};

export const createMeeting: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res
    .status(201)
    .json(await meetingsService.create(user.id, projectId(req), req.body as CreateMeetingInput));
};

export const updateMeeting: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(
    await meetingsService.update(
      user.id,
      projectId(req),
      meetingId(req),
      req.body as UpdateMeetingInput,
    ),
  );
};

export const removeMeeting: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await meetingsService.remove(user.id, projectId(req), meetingId(req));
  res.status(204).end();
};
