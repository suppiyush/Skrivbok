/** Career goals: HTTP in, HTTP out. No SQL, no authorization decisions. */
import type { Request, RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { getLimitStatus } from '../billing/limits.service.js';
import type {
  AdvanceInput,
  CreateCareerGoalInput,
  CreateHistoryInput,
  ListCareerGoalsQuery,
  SetStageInput,
  UpdateCareerGoalInput,
  UpdateHistoryInput,
} from './career-goals.schema.js';
import * as service from './career-goals.service.js';

// Both are guaranteed present and cuid-shaped by `validate({ params })`.
const goalId = (req: Request): string => req.params['id'] as string;
const historyId = (req: Request): string => req.params['historyId'] as string;

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.list(user.id, req.query as unknown as ListCareerGoalsQuery));
};

export const quota: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await getLimitStatus(user.id, 'careerGoals'));
};

export const summary: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.summary(user.id));
};

export const getById: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.getById(user.id, goalId(req)));
};

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await service.create(user.id, req.body as CreateCareerGoalInput));
};

export const update: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.update(user.id, goalId(req), req.body as UpdateCareerGoalInput));
};

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.remove(user.id, goalId(req));
  res.status(204).end();
};

// ── Stage movement ────────────────────────────────────────────────────────────

export const advance: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { description } = req.body as AdvanceInput;
  res.json(await service.advance(user.id, goalId(req), description));
};

export const setStage: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { stage, description } = req.body as SetStageInput;
  res.json(await service.setStage(user.id, goalId(req), stage, description));
};

// ── History ───────────────────────────────────────────────────────────────────

export const listHistory: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ history: await service.listHistory(user.id, goalId(req)) });
};

export const addHistory: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res
    .status(201)
    .json(await service.addHistory(user.id, goalId(req), req.body as CreateHistoryInput));
};

export const updateHistory: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(
    await service.updateHistory(
      user.id,
      goalId(req),
      historyId(req),
      req.body as UpdateHistoryInput,
    ),
  );
};

export const removeHistory: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.removeHistory(user.id, goalId(req), historyId(req));
  res.status(204).end();
};
