/** Journal routes. Auth is applied router-wide. */
import { z } from 'zod';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './journal.controller.js';
import {
  createJournalEntrySchema,
  dateOnlySchema,
  listJournalSchema,
  updateJournalEntrySchema,
} from './journal.schema.js';

/** The heatmap window is required — an unbounded scan is not a useful default. */
const activityQuerySchema = z
  .object({ from: dateOnlySchema, to: dateOnlySchema })
  .refine((v) => v.from <= v.to, { message: '`from` must not be after `to`' });

export const journalRouter: Router = Router();

journalRouter.use(requireAuth);

// All three are declared before '/:id', or their names would be parsed as ids.
journalRouter.get('/activity', validate({ query: activityQuerySchema }), controller.activity);
journalRouter.get('/tags', controller.tags);
journalRouter.get('/stats', controller.stats);

journalRouter.get('/', validate({ query: listJournalSchema }), controller.list);
journalRouter.post('/', validate({ body: createJournalEntrySchema }), controller.create);

journalRouter.get('/:id', validate({ params: idParamSchema }), controller.getById);
journalRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateJournalEntrySchema }),
  controller.update,
);
journalRouter.delete('/:id', validate({ params: idParamSchema }), controller.remove);
