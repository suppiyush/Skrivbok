/** Career goal routes. Auth is applied router-wide. */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './career-goals.controller.js';
import {
  advanceSchema,
  createCareerGoalSchema,
  createHistorySchema,
  historyParamSchema,
  listCareerGoalsSchema,
  setStageSchema,
  updateCareerGoalSchema,
  updateHistorySchema,
} from './career-goals.schema.js';

export const careerGoalsRouter: Router = Router();

careerGoalsRouter.use(requireAuth);

// Literal paths first, or they would be parsed as an id.
careerGoalsRouter.get('/quota', controller.quota);
careerGoalsRouter.get('/summary', controller.summary);

careerGoalsRouter.get('/', validate({ query: listCareerGoalsSchema }), controller.list);
careerGoalsRouter.post('/', validate({ body: createCareerGoalSchema }), controller.create);

careerGoalsRouter.get('/:id', validate({ params: idParamSchema }), controller.getById);
careerGoalsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateCareerGoalSchema }),
  controller.update,
);
careerGoalsRouter.delete('/:id', validate({ params: idParamSchema }), controller.remove);

// ── Stage movement ────────────────────────────────────────────────────────────
// Separate endpoints rather than a PATCH field, so a stage change always writes
// its history entry.
careerGoalsRouter.post(
  '/:id/advance',
  validate({ params: idParamSchema, body: advanceSchema }),
  controller.advance,
);
careerGoalsRouter.put(
  '/:id/stage',
  validate({ params: idParamSchema, body: setStageSchema }),
  controller.setStage,
);

// ── History ───────────────────────────────────────────────────────────────────
careerGoalsRouter.get('/:id/history', validate({ params: idParamSchema }), controller.listHistory);
careerGoalsRouter.post(
  '/:id/history',
  validate({ params: idParamSchema, body: createHistorySchema }),
  controller.addHistory,
);
careerGoalsRouter.patch(
  '/:id/history/:historyId',
  validate({ params: historyParamSchema, body: updateHistorySchema }),
  controller.updateHistory,
);
careerGoalsRouter.delete(
  '/:id/history/:historyId',
  validate({ params: historyParamSchema }),
  controller.removeHistory,
);
