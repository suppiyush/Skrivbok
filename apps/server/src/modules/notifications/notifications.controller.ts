/** Notifications: HTTP in, HTTP out. Read and mark only — nothing creates one. */
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import type {
  ListNotificationsQuery,
  MarkReadInput,
  UpdatePreferencesInput,
} from './notifications.schema.js';
import * as service from './notifications.service.js';

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.list(user.id, req.query as unknown as ListNotificationsQuery));
};

export const unreadCount: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ unreadCount: await service.unreadCount(user.id) });
};

export const markRead: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { ids } = req.body as MarkReadInput;
  res.json({ marked: await service.markRead(user.id, ids) });
};

export const markAllRead: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ marked: await service.markAllRead(user.id) });
};

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.remove(user.id, req.params['id'] as string);
  res.status(204).end();
};

export const clearRead: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ deleted: await service.clearRead(user.id) });
};

export const getPreferences: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ preferences: await service.getPreferences(user.id) });
};

export const updatePreferences: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({
    preferences: await service.updatePreferences(user.id, req.body as UpdatePreferencesInput),
  });
};
