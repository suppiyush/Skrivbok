/** Reports: HTTP in, HTTP out. */
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/auth.js';
import type { CreateReportInput, ListOwnReportsQuery } from './reports.schema.js';
import * as service from './reports.service.js';

export const create: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.status(201).json(await service.create(user.id, req.body as CreateReportInput));
};

export const listOwn: RequestHandler = async (req, res) => {
  const user = currentUser(req);
  res.json(await service.listOwn(user.id, req.query as unknown as ListOwnReportsQuery));
};
