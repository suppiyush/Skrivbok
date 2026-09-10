/** Journal: HTTP in, HTTP out. */
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import type {
  CreateJournalEntryInput,
  ListJournalQuery,
  UpdateJournalEntryInput,
} from './journal.schema.js';
import * as service from './journal.service.js';

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.list(user.id, req.query as unknown as ListJournalQuery));
};

export const activity: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { from, to } = req.query as unknown as { from: Date; to: Date };
  res.json({ activity: await service.activity(user.id, from, to) });
};

export const getById: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.getById(user.id, req.params['id'] as string));
};

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await service.create(user.id, req.body as CreateJournalEntryInput));
};

export const update: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(
    await service.update(user.id, req.params['id'] as string, req.body as UpdateJournalEntryInput),
  );
};

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.remove(user.id, req.params['id'] as string);
  res.status(204).end();
};
