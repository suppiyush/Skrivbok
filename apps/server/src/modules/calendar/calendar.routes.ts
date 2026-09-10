/**
 * Calendar routes. Auth is applied router-wide.
 *
 * Part 7a covers the caller's own events. 7b adds meeting requests and 7c the
 * shared/team views, both mounted on this same router.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { idParamSchema, validate } from '../../middleware/validate.js';
import * as access from './access.controller.js';
import * as events from './events.controller.js';
import * as meetings from './meetings.controller.js';
import {
  createEventSchema,
  listEventsSchema,
  rangeQuerySchema,
  updateEventSchema,
} from './events.schema.js';
import {
  createMeetingRequestSchema,
  listMeetingRequestsSchema,
  rescheduleSchema,
} from './meetings.schema.js';
import {
  approveAccessSchema,
  availabilitySchema,
  createAccessRequestSchema,
  emailParamSchema,
  listAccessRequestsSchema,
  sharedRangeSchema,
  updateAccessSchema,
} from './access.schema.js';

export const calendarRouter: Router = Router();

calendarRouter.use(requireAuth);

// Literal paths first, or they would be parsed as an id.
calendarRouter.get('/events/range', validate({ query: rangeQuerySchema }), events.range);
calendarRouter.get('/events/categories', events.categories);

calendarRouter.get('/events', validate({ query: listEventsSchema }), events.list);
calendarRouter.post('/events', validate({ body: createEventSchema }), events.create);

calendarRouter.get('/events/:id', validate({ params: idParamSchema }), events.getById);
calendarRouter.patch(
  '/events/:id',
  validate({ params: idParamSchema, body: updateEventSchema }),
  events.update,
);
calendarRouter.delete('/events/:id', validate({ params: idParamSchema }), events.remove);

// ── Meeting requests (7b) ─────────────────────────────────────────────────────
// A request is not a calendar event. Accepting one *creates* the paired events;
// see meetings.service.ts for why the two are kept linked.
calendarRouter.get(
  '/meeting-requests',
  validate({ query: listMeetingRequestsSchema }),
  meetings.list,
);
calendarRouter.post(
  '/meeting-requests',
  validate({ body: createMeetingRequestSchema }),
  meetings.create,
);
calendarRouter.get('/meeting-requests/:id', validate({ params: idParamSchema }), meetings.getById);
calendarRouter.patch(
  '/meeting-requests/:id',
  validate({ params: idParamSchema, body: rescheduleSchema }),
  meetings.reschedule,
);

// State changes are named endpoints rather than a status field on PATCH: each
// has different rules about who may call it, and accept/cancel additionally
// create or delete calendar events.
calendarRouter.post(
  '/meeting-requests/:id/accept',
  validate({ params: idParamSchema }),
  meetings.accept,
);
calendarRouter.post(
  '/meeting-requests/:id/decline',
  validate({ params: idParamSchema }),
  meetings.decline,
);
calendarRouter.post(
  '/meeting-requests/:id/cancel',
  validate({ params: idParamSchema }),
  meetings.cancel,
);

// ── Calendar access and sharing (7c) ──────────────────────────────────────────
// Access is a *grant*, checked on every shared read. What a grant reveals is
// decided by visibility.ts, not by the caller.

// Requests
calendarRouter.get(
  '/access/requests',
  validate({ query: listAccessRequestsSchema }),
  access.listRequests,
);
calendarRouter.post(
  '/access/requests',
  validate({ body: createAccessRequestSchema }),
  access.createRequest,
);
calendarRouter.post(
  '/access/requests/:id/approve',
  validate({ params: idParamSchema, body: approveAccessSchema }),
  access.approveRequest,
);
calendarRouter.post(
  '/access/requests/:id/reject',
  validate({ params: idParamSchema }),
  access.rejectRequest,
);
calendarRouter.delete(
  '/access/requests/:id',
  validate({ params: idParamSchema }),
  access.withdrawRequest,
);

// Grants. 'granted' = people who can see me; 'held' = calendars I can see.
calendarRouter.get('/access/granted', access.listGranted);
calendarRouter.get('/access/held', access.listHeld);
calendarRouter.patch(
  '/access/:id',
  validate({ params: idParamSchema, body: updateAccessSchema }),
  access.updateGrant,
);
calendarRouter.delete('/access/:id', validate({ params: idParamSchema }), access.revokeGrant);

// Shared views
calendarRouter.get('/availability', validate({ query: availabilitySchema }), access.availability);
calendarRouter.get('/combined', validate({ query: sharedRangeSchema }), access.combined);
calendarRouter.get(
  '/shared/:email',
  validate({ params: emailParamSchema, query: sharedRangeSchema }),
  access.sharedCalendar,
);
