/** Literature routes. Auth is applied router-wide. */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './literature.controller.js';
import {
  createLiteratureSchema,
  listLiteratureSchema,
  updateLiteratureSchema,
} from './literature.schema.js';

export const literatureRouter: Router = Router();

literatureRouter.use(requireAuth);

// Declared before '/:id', or 'tags' and 'export' would be parsed as ids.
literatureRouter.get('/tags', controller.tags);
literatureRouter.get('/export', controller.exportCsv);

literatureRouter.get('/', validate({ query: listLiteratureSchema }), controller.list);
literatureRouter.post('/', validate({ body: createLiteratureSchema }), controller.create);

literatureRouter.get('/:id', validate({ params: idParamSchema }), controller.getById);
literatureRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateLiteratureSchema }),
  controller.update,
);
literatureRouter.delete('/:id', validate({ params: idParamSchema }), controller.remove);
