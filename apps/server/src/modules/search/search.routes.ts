/** One route: the header's search box. Auth is applied router-wide. */
import { z } from 'zod';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { search } from './search.service.js';

/** Two characters at least: one matches half of everything and says nothing. */
const querySchema = z.object({ q: z.string().trim().min(2).max(100) });

const handler: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  const { q } = req.query as unknown as { q: string };
  res.json({ results: await search(user.id, q) });
};

export const searchRouter: Router = Router();
searchRouter.use(requireAuth);
searchRouter.get('/', validate({ query: querySchema }), handler);
