/**
 * Profile routes. Auth is applied router-wide.
 *
 * The avatar has its own endpoints rather than being a field on the profile
 * save: the URL is issued by the storage provider, not typed by the user, and
 * accepting it through the general save would let a client point the field at
 * anything it liked.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './profile.controller.js';
import { setAvatarSchema, upsertProfileSchema } from './profile.schema.js';

export const profileRouter: Router = Router();

profileRouter.use(requireAuth);

profileRouter.get('/', controller.get);
profileRouter.put('/', validate({ body: upsertProfileSchema }), controller.upsert);
profileRouter.delete('/', controller.remove);

// ── Avatar ────────────────────────────────────────────────────────────────────
// The image goes straight from the browser to the storage provider; only the
// signature and the resulting URL pass through here.
profileRouter.post('/avatar/signature', controller.avatarSignature);
profileRouter.put('/avatar', validate({ body: setAvatarSchema }), controller.setAvatar);
profileRouter.delete('/avatar', controller.clearAvatar);
