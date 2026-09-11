/** Note: HTTP in, HTTP out. No SQL, no authorization decisions. */
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { isUploadEnabled, signVoiceNoteUpload } from '../uploads/uploads.service.js';
import type { CreateNoteInput, ListNotesQuery, UpdateNoteInput } from './notes.schema.js';
import * as service from './notes.service.js';

/**
 * Whether voice notes can be recorded at all.
 *
 * Storage is optional, like mail and billing. Reported rather than assumed, so
 * the UI can leave the button out instead of offering one that fails on tap.
 */
export const voiceConfig: RequestHandler = (_req, res) => {
  res.json({ voiceNotesEnabled: isUploadEnabled() });
};

/** A short-lived signature for uploading one recording, straight to storage. */
export const voiceSignature: RequestHandler = (req, res) => {
  const user = currentUser(req);
  res.json(signVoiceNoteUpload(user.id));
};

export const list: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.list(user.id, req.query as unknown as ListNotesQuery));
};

export const categories: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ categories: await service.categories(user.id) });
};

export const getById: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.getById(user.id, req.params['id'] as string));
};

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await service.create(user.id, req.body as CreateNoteInput));
};

export const update: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.update(user.id, req.params['id'] as string, req.body as UpdateNoteInput));
};

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.remove(user.id, req.params['id'] as string);
  res.status(204).end();
};
