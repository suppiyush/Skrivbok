/**
 * Ideas routes.
 *
 * `requireAuth` is applied to the whole router rather than route by route, so
 * an endpoint added later cannot accidentally ship unauthenticated.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './ideas.controller.js';
import { createIdeaSchema, listIdeasSchema, updateIdeaSchema } from './ideas.schema.js';

export const ideasRouter: Router = Router();

ideasRouter.use(requireAuth);

// Literal paths are declared before `/:id`, or "categories" would be parsed as an id.
ideasRouter.get('/categories', controller.categories);

ideasRouter.get('/', validate({ query: listIdeasSchema }), controller.list);
ideasRouter.post('/', validate({ body: createIdeaSchema }), controller.create);

ideasRouter.get('/:id', validate({ params: idParamSchema }), controller.getById);
ideasRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateIdeaSchema }),
  controller.update,
);
ideasRouter.delete('/:id', validate({ params: idParamSchema }), controller.remove);
