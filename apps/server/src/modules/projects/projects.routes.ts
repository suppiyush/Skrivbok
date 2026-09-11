/**
 * Project routes. Auth is applied router-wide; the *role* each endpoint needs
 * is enforced inside the service, not here, so it cannot be bypassed by a
 * second route reaching the same service function.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as controller from './projects.controller.js';
import {
  addMemberSchema,
  createProjectSchema,
  listProjectsSchema,
  memberParamSchema,
  transferOwnershipSchema,
  updateMemberSchema,
  updateProjectSchema,
  upsertBriefSchema,
  createMeetingSchema,
  meetingParamSchema,
  updateMeetingSchema,
} from './projects.schema.js';

export const projectsRouter: Router = Router();

projectsRouter.use(requireAuth);

// Literal paths first, or they would be parsed as an id.
projectsRouter.get('/quota', controller.quota);

projectsRouter.get('/', validate({ query: listProjectsSchema }), controller.list);
projectsRouter.post('/', validate({ body: createProjectSchema }), controller.create);

projectsRouter.get('/:id', validate({ params: idParamSchema }), controller.getById);
projectsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateProjectSchema }),
  controller.update,
);
projectsRouter.delete('/:id', validate({ params: idParamSchema }), controller.remove);

// ── Members ───────────────────────────────────────────────────────────────────
projectsRouter.get('/:id/members', validate({ params: idParamSchema }), controller.listMembers);
projectsRouter.post(
  '/:id/members',
  validate({ params: idParamSchema, body: addMemberSchema }),
  controller.addMember,
);
projectsRouter.post(
  '/:id/members/accept',
  validate({ params: idParamSchema }),
  controller.acceptInvite,
);
projectsRouter.patch(
  '/:id/members/:memberId',
  validate({ params: memberParamSchema, body: updateMemberSchema }),
  controller.updateMember,
);
projectsRouter.delete(
  '/:id/members/:memberId',
  validate({ params: memberParamSchema }),
  controller.removeMember,
);
projectsRouter.post(
  '/:id/transfer-ownership',
  validate({ params: idParamSchema, body: transferOwnershipSchema }),
  controller.transferOwnership,
);

// ── Brief ─────────────────────────────────────────────────────────────────────
projectsRouter.get('/:id/brief', validate({ params: idParamSchema }), controller.getBrief);
projectsRouter.put(
  '/:id/brief',
  validate({ params: idParamSchema, body: upsertBriefSchema }),
  controller.saveBrief,
);

// ── Meetings ──────────────────────────────────────────────────────────────────
projectsRouter.get('/:id/meetings', validate({ params: idParamSchema }), controller.listMeetings);
projectsRouter.post(
  '/:id/meetings',
  validate({ params: idParamSchema, body: createMeetingSchema }),
  controller.createMeeting,
);
projectsRouter.patch(
  '/:id/meetings/:meetingId',
  validate({ params: meetingParamSchema, body: updateMeetingSchema }),
  controller.updateMeeting,
);
projectsRouter.delete(
  '/:id/meetings/:meetingId',
  validate({ params: meetingParamSchema }),
  controller.removeMeeting,
);
