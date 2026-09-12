/**
 * Mail transport.
 *
 * Mail is **optional**. With neither `BREVO_API_KEY` nor `SMTP_HOST` set the
 * transport goes into a "log only" mode: every send is recorded at info level
 * and reported as skipped. That keeps local development and CI working without
 * credentials, and means a missing mail server degrades reminders rather than
 * breaking the request that triggered one.
 *
 * Two ways out, chosen once at first use:
 *
 *   - Brevo's HTTPS API, when an API key is set. Preferred, because it uses
 *     port 443 and so works from hosts that block outbound SMTP — Render's free
 *     tier drops every packet to 25/465/587, and the only symptom is a connect
 *     timeout that looks like a misconfiguration.
 *   - SMTP through nodemailer otherwise. Any server, any provider.
 *
 * A send failure never propagates to the caller. A deadline that could not be
 * emailed is a nuisance; a 500 on the request that created it is a bug.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const log = createLogger('mail');

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

/** What the two providers have in common. */
interface Backend {
  /** Human name for logs, so a failure says which path it took. */
  readonly name: 'brevo' | 'smtp';
  send(mail: Mail & { subject: string }): Promise<void>;
  /** Check reachability and credentials without sending anything. */
  verify(): Promise<void>;
  close(): void;
}

// ── Brevo over HTTPS ──────────────────────────────────────────────────────────

const BREVO_API = 'https://api.brevo.com/v3';

/** Read a Brevo error body for the log; their errors are `{ code, message }`. */
async function brevoError(response: Response): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    detail = [body.code, body.message].filter(Boolean).join(': ');
  } catch {
    // Not JSON — the status is all we have.
  }
  return `Brevo ${response.status}${detail ? ` — ${detail}` : ''}`;
}

function brevoBackend(apiKey: string): Backend {
  const headers = {
    'api-key': apiKey,
    'content-type': 'application/json',
    accept: 'application/json',
  };

  return {
    name: 'brevo',

    async send(mail) {
      const response = await fetch(`${BREVO_API}/smtp/email`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sender: { name: env.mail.fromName, email: env.mail.fromAddress },
          to: [{ email: mail.to }],
          subject: mail.subject,
          htmlContent: mail.html,
          textContent: mail.text,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(await brevoError(response));
    },

    async verify() {
      // The account endpoint needs a valid key and nothing else, so a 401 here
      // is "wrong key" and a network failure is "cannot reach Brevo".
      const response = await fetch(`${BREVO_API}/account`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(await brevoError(response));
    },

    close() {
      // Stateless: nothing to release.
    },
  };
}

// ── SMTP ──────────────────────────────────────────────────────────────────────

function smtpBackend(host: string): Backend {
  const transporter: Transporter = nodemailer.createTransport({
    host,
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

  return {
    name: 'smtp',

    async send(mail) {
      await transporter.sendMail({
        from: { name: env.mail.fromName, address: env.mail.fromAddress },
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    },

    async verify() {
      await transporter.verify();
    },

    close() {
      transporter.close();
    },
  };
}

// ── Selection ─────────────────────────────────────────────────────────────────

let backend: Backend | null | undefined;

function getBackend(): Backend | null {
  if (backend !== undefined) return backend;

  if (env.mail.brevoApiKey) backend = brevoBackend(env.mail.brevoApiKey);
  else if (env.mail.host) backend = smtpBackend(env.mail.host);
  else backend = null;

  return backend;
}

/** Which way mail leaves this server, or `null` when it is disabled. */
export function mailRoute(): 'brevo' | 'smtp' | null {
  return getBackend()?.name ?? null;
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
  const transport = getBackend();

  if (!transport) {
    log.info({ to: mail.to, subject }, 'Mail disabled — email not sent');
    return { sent: false, skipped: 'mail-disabled' };
  }

  try {
    await transport.send({ ...mail, subject });
    log.info({ to: mail.to, subject, via: transport.name }, 'Email sent');
    return { sent: true };
  } catch (error) {
    // Logged, not thrown: see the note at the top of the file.
    const message = error instanceof Error ? error.message : String(error);
    log.error({ to: mail.to, subject, via: transport.name, err: error }, 'Email failed to send');
    return { sent: false, error: message };
  }
}

/** Confirm the mail settings work. Called by the worker at startup. */
export async function verifyTransport(): Promise<boolean> {
  const transport = getBackend();
  if (!transport) return false;

  try {
    await transport.verify();
    log.info({ via: transport.name }, 'Mail transport verified');
    return true;
  } catch (error) {
    log.error(
      { via: transport.name, err: error },
      'Mail transport verification failed — reminders will not be delivered',
    );
    return false;
  }
}

/** Release any connection pool during shutdown. */
export function closeTransport(): void {
  backend?.close();
  backend = undefined;
}
