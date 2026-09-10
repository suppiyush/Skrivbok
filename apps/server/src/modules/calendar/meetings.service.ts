/**
 * Meeting requests, and the calendar events they produce.
 *
 * ## The two-sided sync
 *
 * Accepting a request creates **two** calendar events — one on each person's
 * calendar — both carrying `meetingRequestId`. That link is what keeps the two
 * copies together: cancelling deletes both, and the schema's cascade removes
 * both if the request row itself is ever deleted.
 *
 * The legacy server created these events with separate, unlinked inserts and
 * then tried to find the counterpart again later by matching on date and
 * description text (`DELETE /meetings/by-content`). Editing a title was enough
 * to orphan one side. Here the relationship is a foreign key.
 *
 * Every state change is a single transaction: a half-applied accept would leave
 * a request marked ACCEPTED with an event on only one calendar.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { createLogger } from '../../config/logger.js';
import type { Pagination } from '../../middleware/validate.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import { sendMeetingRequest, sendMeetingResponse } from '../../emails/index.js';
import { expandOccurrences } from './recurrence.js';
import type {
  CreateMeetingRequestInput,
  ListMeetingRequestsQuery,
  RescheduleInput,
} from './meetings.schema.js';

const log = createLogger('meetings');

const party = { select: { id: true, name: true, email: true } } as const;

const requestSelect = {
  id: true,
  senderId: true,
  receiverId: true,
  title: true,
  description: true,
  startAt: true,
  endAt: true,
  timezone: true,
  status: true,
  respondedAt: true,
  createdAt: true,
  updatedAt: true,
  sender: party,
  receiver: party,
} as const;

type MeetingRequest = Prisma.MeetingRequestGetPayload<{ select: typeof requestSelect }>;

/** A meeting request as the caller sees it, with their side of it resolved. */
export interface MeetingRequestView extends MeetingRequest {
  /** True when the caller sent it — the UI shows a different set of actions. */
  isSender: boolean;
  /** The other person, whichever side the caller is on. */
  counterpart: { id: string; name: string | null; email: string };
}

function decorate(request: MeetingRequest, userId: string): MeetingRequestView {
  const isSender = request.senderId === userId;
  return {
    ...request,
    isSender,
    counterpart: isSender ? request.receiver : request.sender,
  };
}

const ORDER_BY: Record<
  ListMeetingRequestsQuery['sort'],
  Prisma.MeetingRequestOrderByWithRelationInput[]
> = {
  soonest: [{ startAt: 'asc' }],
  latest: [{ startAt: 'desc' }],
  newest: [{ createdAt: 'desc' }],
};

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function list(
  userId: string,
  query: ListMeetingRequestsQuery,
): Promise<Paginated<MeetingRequestView>> {
  // The caller only ever sees requests they are a party to. There is no way to
  // widen this from the client.
  const mine: Prisma.MeetingRequestWhereInput =
    query.box === 'incoming'
      ? { receiverId: userId }
      : query.box === 'outgoing'
        ? { senderId: userId }
        : { OR: [{ senderId: userId }, { receiverId: userId }] };

  const where: Prisma.MeetingRequestWhereInput = {
    ...mine,
    ...(query.status ? { status: query.status } : {}),
    ...(query.upcoming ? { endAt: { gte: new Date() } } : {}),
  };

  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [rows, total] = await prisma.$transaction([
    prisma.meetingRequest.findMany({
      where,
      select: requestSelect,
      orderBy: ORDER_BY[query.sort],
      ...toSkipTake(pagination),
    }),
    prisma.meetingRequest.count({ where }),
  ]);

  return paginate(
    rows.map((row) => decorate(row, userId)),
    total,
    pagination,
  );
}

/** Fetch a request the caller is a party to. Anyone else gets 404. */
async function getOwnedRequest(userId: string, id: string): Promise<MeetingRequest> {
  const request = await prisma.meetingRequest.findFirst({
    where: { id, OR: [{ senderId: userId }, { receiverId: userId }] },
    select: requestSelect,
  });

  if (!request) throw new NotFoundError('Meeting request');
  return request;
}

export async function getById(userId: string, id: string): Promise<MeetingRequestView> {
  return decorate(await getOwnedRequest(userId, id), userId);
}

/**
 * The caller's own events that clash with this proposed slot.
 *
 * Surfaced rather than enforced: double-booking is sometimes deliberate, and a
 * hard block would be worse than an informed decision. Only the caller's own
 * calendar is examined — telling a sender what is on the recipient's calendar
 * would leak it, which is what Part 7c's access grants exist to control.
 */
export async function conflictsFor(
  userId: string,
  startAt: Date,
  endAt: Date,
  ignoreRequestId?: string,
): Promise<{ id: string; title: string; startAt: Date; endAt: Date }[]> {
  const candidates = await prisma.calendarEvent.findMany({
    where: {
      userId,
      // A FREE event is not a clash — that is what marking it free means.
      showAs: { not: 'FREE' },
      AND: [
        // Exclude this request's own paired events, so a meeting never reports
        // itself as a conflict.
        //
        // `NOT: { meetingRequestId: id }` would be wrong: in SQL,
        // `meetingRequestId <> 'x'` evaluates to NULL — not true — for every row
        // where the column is NULL, so every ordinary event would be filtered
        // out and no conflict could ever be found. The NULL case is spelled out.
        ...(ignoreRequestId
          ? [
              {
                OR: [{ meetingRequestId: null }, { meetingRequestId: { not: ignoreRequestId } }],
              },
            ]
          : []),
        {
          OR: [
            { recurrence: 'NONE' as const, startAt: { lt: endAt }, endAt: { gt: startAt } },
            {
              recurrence: { not: 'NONE' as const },
              startAt: { lt: endAt },
              OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: startAt } }],
            },
          ],
        },
      ],
    },
  });

  // Repeating candidates still have to be expanded: the coarse query above says
  // only that the series *could* overlap.
  return candidates.flatMap((event) =>
    expandOccurrences(event, startAt, endAt)
      .filter((o) => o.startAt < endAt && o.endAt > startAt)
      .map((o) => ({ id: event.id, title: event.title, startAt: o.startAt, endAt: o.endAt })),
  );
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function create(
  userId: string,
  input: CreateMeetingRequestInput,
): Promise<MeetingRequestView> {
  const receiver = await prisma.user.findUnique({
    where: { email: input.receiverEmail },
    select: { id: true, timezone: true },
  });

  if (!receiver) {
    // A meeting needs a calendar on the other side, so unlike a project invite
    // this cannot be left pending for someone who has not registered.
    throw new NotFoundError('An account with that email address');
  }

  if (receiver.id === userId) {
    throw new BadRequestError('You cannot send a meeting request to yourself');
  }

  if (input.endAt <= new Date()) {
    throw new BadRequestError('That meeting time has already passed');
  }

  const sender = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  });

  const request = await prisma.meetingRequest.create({
    data: {
      senderId: userId,
      receiverId: receiver.id,
      title: input.title,
      // Location and link are carried on the description until the events are
      // created; the request table itself stores only what both sides agree on.
      description: input.description ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      timezone: input.timezone ?? sender.timezone,
    },
    select: requestSelect,
  });

  await prisma.notification.create({
    data: {
      userId: receiver.id,
      type: 'MEETING_REQUEST',
      title: 'New meeting request',
      message: input.title,
      link: `/calendar?request=${request.id}`,
    },
  });

  sendMeetingRequest(receiver.id, request.receiver.email, {
    senderName: request.sender.name ?? request.sender.email,
    title: request.title,
    startAt: request.startAt,
    endAt: request.endAt,
    timezone: request.timezone,
    description: request.description,
  });

  log.info({ requestId: request.id }, 'Meeting request created');
  return decorate(request, userId);
}

/** Only the sender may reschedule, and only while the request is pending. */
export async function reschedule(
  userId: string,
  id: string,
  input: RescheduleInput,
): Promise<MeetingRequestView> {
  const request = await getOwnedRequest(userId, id);

  if (request.senderId !== userId) {
    throw new ForbiddenError('Only the sender can reschedule this request');
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError(`This request has already been ${request.status.toLowerCase()}`);
  }
  if (input.endAt <= new Date()) {
    throw new BadRequestError('That meeting time has already passed');
  }

  const updated = await prisma.meetingRequest.update({
    where: { id },
    data: {
      startAt: input.startAt,
      endAt: input.endAt,
      ...(input.timezone ? { timezone: input.timezone } : {}),
    },
    select: requestSelect,
  });

  await prisma.notification.create({
    data: {
      userId: request.receiverId,
      type: 'MEETING_REQUEST',
      title: 'A meeting request was rescheduled',
      message: request.title,
      link: `/calendar?request=${id}`,
    },
  });

  return decorate(updated, userId);
}

/**
 * Accept: mark the request and create the paired calendar events.
 *
 * One transaction. If any part fails, the request stays PENDING and neither
 * calendar is touched.
 */
export async function accept(userId: string, id: string): Promise<MeetingRequestView> {
  const request = await getOwnedRequest(userId, id);

  if (request.receiverId !== userId) {
    throw new ForbiddenError('Only the person invited can accept this request');
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError(`This request has already been ${request.status.toLowerCase()}`);
  }

  const sharedEventFields = {
    description: request.description,
    startAt: request.startAt,
    endAt: request.endAt,
    timezone: request.timezone,
    category: 'Meeting',
    showAs: 'BUSY',
    // BUSY, not PRIVATE: a meeting the two of them arranged should show as a
    // blocked slot to anyone either has granted calendar access to.
    visibility: 'BUSY',
    meetingRequestId: id,
  } as const;

  await prisma.$transaction([
    prisma.meetingRequest.update({
      where: { id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    }),
    prisma.calendarEvent.create({
      data: {
        ...sharedEventFields,
        userId: request.senderId,
        title: request.title,
        attendees: [request.receiver.email],
      },
    }),
    prisma.calendarEvent.create({
      data: {
        ...sharedEventFields,
        userId: request.receiverId,
        title: request.title,
        attendees: [request.sender.email],
      },
    }),
    prisma.notification.create({
      data: {
        userId: request.senderId,
        type: 'MEETING_ACCEPTED',
        title: 'Meeting request accepted',
        message: request.title,
        link: `/calendar?request=${id}`,
      },
    }),
  ]);

  sendMeetingResponse(request.senderId, request.sender.email, {
    responderName: request.receiver.name ?? request.receiver.email,
    title: request.title,
    accepted: true,
    startAt: request.startAt,
    timezone: request.timezone,
  });

  log.info({ requestId: id }, 'Meeting request accepted; paired events created');
  return getById(userId, id);
}

/** Decline: receiver only, pending only. No events are created. */
export async function decline(userId: string, id: string): Promise<MeetingRequestView> {
  const request = await getOwnedRequest(userId, id);

  if (request.receiverId !== userId) {
    throw new ForbiddenError('Only the person invited can decline this request');
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError(`This request has already been ${request.status.toLowerCase()}`);
  }

  await prisma.$transaction([
    prisma.meetingRequest.update({
      where: { id },
      data: { status: 'REJECTED', respondedAt: new Date() },
    }),
    prisma.notification.create({
      data: {
        userId: request.senderId,
        type: 'MEETING_REJECTED',
        title: 'Meeting request declined',
        message: request.title,
        link: `/calendar?request=${id}`,
      },
    }),
  ]);

  sendMeetingResponse(request.senderId, request.sender.email, {
    responderName: request.receiver.name ?? request.receiver.email,
    title: request.title,
    accepted: false,
    startAt: request.startAt,
    timezone: request.timezone,
  });

  return getById(userId, id);
}

/**
 * Cancel: either party, at any point before it has happened.
 *
 * When the meeting was already accepted, both calendar events are removed —
 * this is the case the legacy `by-content` delete tried to handle by matching
 * text, and got wrong whenever anything had been edited.
 */
export async function cancel(userId: string, id: string): Promise<MeetingRequestView> {
  const request = await getOwnedRequest(userId, id);

  if (request.status === 'CANCELLED') {
    throw new ConflictError('This request is already cancelled');
  }
  if (request.status === 'REJECTED') {
    throw new ConflictError('This request was already declined');
  }

  const otherPartyId = request.senderId === userId ? request.receiverId : request.senderId;

  await prisma.$transaction([
    prisma.meetingRequest.update({
      where: { id },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    }),
    // Removes both sides at once, because both carry the same link.
    prisma.calendarEvent.deleteMany({ where: { meetingRequestId: id } }),
    prisma.notification.create({
      data: {
        userId: otherPartyId,
        type: 'MEETING_REJECTED',
        title: 'Meeting cancelled',
        message: request.title,
        link: `/calendar?request=${id}`,
      },
    }),
  ]);

  log.info({ requestId: id }, 'Meeting cancelled; paired events removed');
  return getById(userId, id);
}
