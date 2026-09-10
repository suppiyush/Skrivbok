/** Future Work routes. Auth is applied router-wide. */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './future-work.controller.js';
import {
  createFutureWorkSchema,
  listFutureWorkSchema,
  updateFutureWorkSchema,
} from './future-work.schema.js';

export const futureWorkRouter: Router = Router();

futureWorkRouter.use(requireAuth);

futureWorkRouter.get('/', validate({ query: listFutureWorkSchema }), controller.list);
futureWorkRouter.post('/', validate({ body: createFutureWorkSchema }), controller.create);

futureWorkRouter.get('/:id', validate({ params: idParamSchema }), controller.getById);
futureWorkRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateFutureWorkSchema }),
  controller.update,
);
futureWorkRouter.delete('/:id', validate({ params: idParamSchema }), controller.remove);
