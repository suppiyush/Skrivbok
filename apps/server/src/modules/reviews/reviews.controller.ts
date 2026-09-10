/** Reviews: HTTP in, HTTP out. */
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import type { ListReviewsQuery, ModerateReviewInput, UpsertReviewInput } from './reviews.schema.js';
import * as service from './reviews.service.js';

export const getOwn: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ review: await service.getOwn(user.id) });
};

export const upsertOwn: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ review: await service.upsertOwn(user.id, req.body as UpsertReviewInput) });
};

export const removeOwn: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.removeOwn(user.id);
  res.status(204).end();
};

/** Unauthenticated: this is what the landing page reads. */
export const listPublic: RequestHandler = async (_req, res) => {
  res.json({ reviews: await service.listPublic(12) });
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const listAll: RequestHandler = async (req, res) => {
  res.json(await service.listAll(req.query as unknown as ListReviewsQuery));
};

export const moderate: RequestHandler = async (req, res) => {
  const admin = currentUser(req);
  const id = req.params['id'] as string;
  res.json({ review: await service.moderate(admin.id, id, req.body as ModerateReviewInput) });
};
