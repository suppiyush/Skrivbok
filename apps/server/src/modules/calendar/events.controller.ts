/** Calendar events: HTTP in, HTTP out. No SQL, no authorization decisions. */
import type { Request, RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import type {
  CreateEventInput,
  ListEventsQuery,
  RangeQuery,
  UpdateEventInput,
} from './events.schema.js';
import * as service from './events.service.js';

const eventId = (req: Request): string => req.params['id'] as string;

/** The calendar grid: expanded occurrences across a window. */
export const range: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const events = await service.listRange(user.id, req.query as unknown as RangeQuery);
  res.json({ events });
};

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.list(user.id, req.query as unknown as ListEventsQuery));
};

export const categories: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ categories: await service.categories(user.id) });
};

export const getById: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.getById(user.id, eventId(req)));
};

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await service.create(user.id, req.body as CreateEventInput));
};

export const update: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.update(user.id, eventId(req), req.body as UpdateEventInput));
};

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.remove(user.id, eventId(req));
  res.status(204).end();
};
