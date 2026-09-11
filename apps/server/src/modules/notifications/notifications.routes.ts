/** Notification routes. Auth is applied router-wide. */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './notifications.controller.js';
import {
  listNotificationsSchema,
  markReadSchema,
  updatePreferencesSchema,
} from './notifications.schema.js';

export const notificationsRouter: Router = Router();

notificationsRouter.use(requireAuth);

// Literal paths first, or they would be parsed as an id.
notificationsRouter.get('/unread-count', controller.unreadCount);
notificationsRouter.post('/read-all', controller.markAllRead);
notificationsRouter.delete('/read', controller.clearRead);
notificationsRouter.get('/preferences', controller.getPreferences);
notificationsRouter.patch(
  '/preferences',
  validate({ body: updatePreferencesSchema }),
  controller.updatePreferences,
);

notificationsRouter.get('/', validate({ query: listNotificationsSchema }), controller.list);
notificationsRouter.post('/read', validate({ body: markReadSchema }), controller.markRead);
notificationsRouter.delete('/:id', validate({ params: idParamSchema }), controller.remove);
