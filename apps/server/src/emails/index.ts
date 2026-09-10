/**
 * Transactional email dispatch.
 *
 * Wrapped in `void`-safe helpers so a module can fire an email without making
 * the request wait for SMTP, and without a mail failure turning into a failed
 * request. `sendMail` already swallows its own errors; these add the
 * preference check.
 */
import { prisma } from '../db/prisma.js';
import { createLogger } from '../config/logger.js';
import * as templates from './templates.js';
import { sendMail } from './transport.js';

const log = createLogger('mail');

/** Which preference flag governs a given message. */
type Preference = 'meetingRequestsEnabled' | 'always';

/**
 * Send in the background.
 *
 * The caller does not await this: a project invite should not be slower, or
 * fail, because a mail server is unreachable. Errors are logged inside.
 */
function dispatch(promise: Promise<unknown>): void {
  promise.catch((error: unknown) => log.error({ err: error }, 'Transactional email failed'));
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

export function sendProjectInvite(
  to: string,
  data: { projectName: string; inviterName: string; role: string; projectId: string },
): void {
  dispatch(sendMail(templates.projectInvite(to, data)));
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
