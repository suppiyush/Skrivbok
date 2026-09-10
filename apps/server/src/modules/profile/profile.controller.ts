/** Profile: HTTP in, HTTP out. */
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import { BadRequestError } from '../../utils/errors.js';
import { isOwnStorageUrl, isUploadEnabled, signAvatarUpload } from '../uploads/uploads.service.js';
import type { SetAvatarInput, UpsertProfileInput } from './profile.schema.js';
import * as service from './profile.service.js';

export const get: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ profile: await service.get(user.id), uploadsEnabled: isUploadEnabled() });
};

export const upsert: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ profile: await service.upsert(user.id, req.body as UpsertProfileInput) });
};

export const remove: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  await service.remove(user.id);
  res.status(204).end();
};

export const avatarSignature: RequestHandler = (req, res) => {
  const user = currentUser(req);
  res.json(signAvatarUpload(user.id));
};

/**
 * Record the uploaded avatar.
 *
 * The URL is checked against our own storage host before it is stored. The
 * client reports this value after uploading, and a client can report anything —
 * without the check the field becomes a way to point our pages at an arbitrary
 * third-party image.
 */
export const setAvatar: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { url } = req.body as SetAvatarInput;

  if (!isOwnStorageUrl(url)) {
    throw new BadRequestError('That image was not uploaded to Skrivbok');
  }

  res.json({ profile: await service.setAvatar(user.id, url) });
};

export const clearAvatar: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json({ profile: await service.clearAvatar(user.id) });
};
