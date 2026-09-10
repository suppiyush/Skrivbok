/**
 * SMTP transport.
 *
 * Mail is **optional**. With `SMTP_HOST` unset the transport goes into a "log
 * only" mode: every send is recorded at info level and reported as successful.
 * That keeps local development and CI working without credentials, and means a
 * missing mail server degrades reminders rather than breaking the request that
 * triggered one.
 *
 * A send failure never propagates to the caller. A deadline that could not be
 * emailed is a nuisance; a 500 on the request that created it is a bug.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('mail');

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.mail.enabled || !env.mail.host) return null;

  transporter ??= nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    // true for 465 (implicit TLS), false for 587 (STARTTLS).
    secure: env.mail.secure,
    ...(env.mail.user && env.mail.pass
      ? { auth: { user: env.mail.user, pass: env.mail.pass } }
      : {}),
    // Bound so a hanging mail server cannot pin a worker tick open.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  sent: boolean;
  skipped?: 'mail-disabled';
  error?: string;
}

/**
 * Strip anything that could inject an extra header.
 *
 * A subject line is a single header value; a CR or LF inside it would let the
 * rest of the string be read as new headers (a Bcc, say). Subjects here are
 * built from user-supplied titles, so they are not trusted.
 */
function sanitiseHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 200);
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  const subject = sanitiseHeader(mail.subject);
  const transport = getTransporter();

  if (!transport) {
    log.info({ to: mail.to, subject }, 'Mail disabled — email not sent');
    return { sent: false, skipped: 'mail-disabled' };
  }

  try {
    await transport.sendMail({
      from: { name: env.mail.fromName, address: env.mail.fromAddress },
      to: mail.to,
      subject,
      html: mail.html,
      text: mail.text,
    });

    log.info({ to: mail.to, subject }, 'Email sent');
    return { sent: true };
  } catch (error) {
    // Logged, not thrown: see the note at the top of the file.
    const message = error instanceof Error ? error.message : String(error);
    log.error({ to: mail.to, subject, err: error }, 'Email failed to send');
    return { sent: false, error: message };
  }
}

/** Confirm the SMTP settings work. Called by the worker at startup. */
export async function verifyTransport(): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;

  try {
    await transport.verify();
    log.info({ host: env.mail.host }, 'SMTP connection verified');
    return true;
  } catch (error) {
    log.error({ err: error }, 'SMTP verification failed — reminders will not be delivered');
    return false;
  }
}

/** Release the connection pool during shutdown. */
export function closeTransport(): void {
  transporter?.close();
  transporter = null;
}
