/** Literature: HTTP in, HTTP out. No SQL, no authorization decisions. */
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import type {
  CreateLiteratureInput,
  ListLiteratureQuery,
  UpdateLiteratureInput,
} from './literature.schema.js';
import * as service from './literature.service.js';

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.list(user.id, req.query as unknown as ListLiteratureQuery));
};

export const tags: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ tags: await service.tagCounts(user.id) });
};

export const getById: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.getById(user.id, req.params['id'] as string));
};

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await service.create(user.id, req.body as CreateLiteratureInput));
};

export const update: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(
    await service.update(user.id, req.params['id'] as string, req.body as UpdateLiteratureInput),
  );
};

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.remove(user.id, req.params['id'] as string);
  res.status(204).end();
};
