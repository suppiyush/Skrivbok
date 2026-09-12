/**
 * Transactional email dispatch.
 *
 * Wrapped in `void`-safe helpers so a module can fire an email without making
 * the request wait for SMTP, and without a mail failure turning into a failed
 * request. `sendMail` already swallows its own errors; these add the
 * preference check.
 */
import { waitUntil } from '@vercel/functions';
import { prisma } from '../db/prisma.js';
import { createLogger } from '../config/logger.js';
import * as templates from './templates.js';
import { mailRoute, sendMail, type SendResult } from './transport.js';

const log = createLogger('mail');

/** Which preference flag governs a given message. */
type Preference = 'meetingRequestsEnabled' | 'always';

/**
 * Send in the background.
 *
 * The caller does not await this: a project invite should not be slower, or
 * fail, because a mail server is unreachable. Errors are logged inside.
 *
 * On a serverless host the function can be frozen the moment it responds,
 * which would cut the send off mid-flight. `waitUntil` tells Vercel to keep the
 * instance alive until the promise settles; anywhere else it is a no-op.
 */
function dispatch(promise: Promise<unknown>): void {
  const settled = promise.catch((error: unknown) =>
    log.error({ err: error }, 'Transactional email failed'),
  );
  waitUntil(settled);
}

async function wants(userId: string, preference: Preference): Promise<boolean> {
  if (preference === 'always') return true;

  const pref = await prisma.emailPreference.findUnique({
    where: { userId },
    select: { meetingRequestsEnabled: true },
  });

  // No preference row means defaults, and every default is "on".
  return pref?.[preference] ?? true;
}

export function sendWelcome(to: string, name: string): void {
  dispatch(sendMail(templates.welcome(to, { name })));
}

/**
 * A project invitation.
 *
 * Two templates behind one call: someone with an account is told the project
 * is already in their workspace, someone without is told how to get one. The
 * caller knows which applies, because it has just looked the address up.
 */
export function sendProjectInvite(
  to: string,
  data: {
    projectName: string;
    inviterName: string;
    role: string;
    projectId: string;
    registered: boolean;
  },
): void {
  dispatch(
    sendMail(
      data.registered
        ? templates.projectInvite(to, data)
        : templates.projectInviteNewUser(to, data),
    ),
  );
}

export function sendMeetingRequest(
  userId: string,
  to: string,
  data: {
    senderName: string;
    title: string;
    startAt: Date;
    endAt: Date;
    timezone: string;
    description: string | null;
    rescheduled?: boolean;
  },
): void {
  dispatch(
    wants(userId, 'meetingRequestsEnabled').then((ok) =>
      ok ? sendMail(templates.meetingRequest(to, data)) : undefined,
    ),
  );
}

export function sendMeetingResponse(
  userId: string,
  to: string,
  data: {
    responderName: string;
    title: string;
    accepted: boolean;
    startAt: Date;
    timezone: string;
  },
): void {
  dispatch(
    wants(userId, 'meetingRequestsEnabled').then((ok) =>
      ok ? sendMail(templates.meetingResponse(to, data)) : undefined,
    ),
  );
}

// ── Added with the notification pass ─────────────────────────────────────────

export function sendMeetingCancelled(
  userId: string,
  to: string,
  data: { byName: string; title: string; startAt: Date; timezone: string },
): void {
  dispatch(
    wants(userId, 'meetingRequestsEnabled').then((ok) =>
      ok ? sendMail(templates.meetingCancelled(to, data)) : undefined,
    ),
  );
}

export function sendCalendarAccessRequest(
  userId: string,
  to: string,
  data: { requesterName: string; message: string | null },
): void {
  dispatch(
    wants(userId, 'meetingRequestsEnabled').then((ok) =>
      ok ? sendMail(templates.calendarAccessRequest(to, data)) : undefined,
    ),
  );
}

export function sendOwnershipTransferred(
  to: string,
  data: { projectName: string; fromName: string; projectId: string },
): void {
  dispatch(sendMail(templates.ownershipTransferred(to, data)));
}

/* Billing and account mail is transactional: it goes regardless of
   preferences, because the person needs it whether or not they want reminders. */

export function sendReceipt(to: string, data: templates.ReceiptData): void {
  dispatch(sendMail(templates.subscriptionReceipt(to, data)));
}

export function sendPaymentFailed(to: string, data: { name: string; reason: string | null }): void {
  dispatch(sendMail(templates.paymentFailed(to, data)));
}

export function sendPlanChanged(
  to: string,
  data: { name: string; plan: 'FREE' | 'PRO'; endsAt: Date | null; timezone: string },
): void {
  dispatch(sendMail(templates.planChanged(to, data)));
}

export function sendSessionsRevoked(to: string, name: string): void {
  dispatch(sendMail(templates.sessionsRevoked(to, { name })));
}

export function sendAccountDeleted(to: string, name: string): void {
  dispatch(sendMail(templates.accountDeleted(to, { name })));
}

export function sendReportUpdate(
  to: string,
  data: {
    name: string;
    title: string;
    status: 'RESOLVED' | 'DISMISSED';
    resolution: string | null;
  },
): void {
  dispatch(sendMail(templates.reportUpdate(to, data)));
}

/**
 * The one send that *is* awaited: the admin's "does mail work?" button. The
 * caller wants the provider's actual answer on screen, not a log line.
 */
export async function sendTestMessage(to: string): Promise<SendResult> {
  const via = mailRoute();
  if (!via) return { sent: false, skipped: 'mail-disabled' };
  return sendMail(templates.testMessage(to, { via }));
}
