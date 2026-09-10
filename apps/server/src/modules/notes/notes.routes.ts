/** Notes routes. Auth is applied router-wide. */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './notes.controller.js';
import { createNoteSchema, listNotesSchema, updateNoteSchema } from './notes.schema.js';

export const notesRouter: Router = Router();

notesRouter.use(requireAuth);

notesRouter.get('/categories', controller.categories);

notesRouter.get('/', validate({ query: listNotesSchema }), controller.list);
notesRouter.post('/', validate({ body: createNoteSchema }), controller.create);

notesRouter.get('/:id', validate({ params: idParamSchema }), controller.getById);
notesRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateNoteSchema }),
  controller.update,
);
notesRouter.delete('/:id', validate({ params: idParamSchema }), controller.remove);
