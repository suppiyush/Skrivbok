/** Deadlines routes. Auth is applied router-wide. */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './deadlines.controller.js';
import {
  createDeadlineSchema,
  listDeadlinesSchema,
  updateDeadlineSchema,
} from './deadlines.schema.js';

export const deadlinesRouter: Router = Router();

deadlinesRouter.use(requireAuth);

deadlinesRouter.get('/summary', controller.summary);

deadlinesRouter.get('/', validate({ query: listDeadlinesSchema }), controller.list);
deadlinesRouter.post('/', validate({ body: createDeadlineSchema }), controller.create);

deadlinesRouter.get('/:id', validate({ params: idParamSchema }), controller.getById);
deadlinesRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateDeadlineSchema }),
  controller.update,
);
deadlinesRouter.delete('/:id', validate({ params: idParamSchema }), controller.remove);
