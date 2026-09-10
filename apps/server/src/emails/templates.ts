/**
 * Email templates.
 *
 * Every template returns both HTML and a plain-text alternative. The text part
 * is not a courtesy — a message with no text alternative scores badly with spam
 * filters, and some clients render nothing else.
 *
 * All interpolated values pass through `escapeHtml`, for the same reason the
 * resume renderer does it: titles and names are user-supplied. An unescaped
 * deadline title would be injected into every recipient's inbox.
 *
 * Layout is table-based and conservative: inline styles, no external CSS, no
 * images, no JavaScript, no flexbox. Outlook on Windows renders through Word,
 * which ignores max-width on a div and padding on an anchor — so the shell is
 * nested tables and the button carries a VML fallback.
 */
import { env } from '../config/env.js';
import { escapeHtml } from '../utils/html.js';
import type { Mail } from './transport.js';

/* ── Palette ────────────────────────────────────────────────────────────────
   The same tokens as the app, written as literal hex. Email clients do not
   support CSS custom properties, so these cannot be shared with the frontend
   and have to be kept in step by hand. */
const INK = '#0b0f19'; // headings
const BRAND = '#2f6bfa'; // links, accents
const BRAND_DEEP = '#22459c';
const ACCENT = '#ffd60a';
const MUTED = '#5b6472'; // body copy
const FAINT = '#8b93a3'; // footer
const BORDER = '#e2e5ec';
const CANVAS = '#f1f3f7'; // page background
const SURFACE = '#ffffff'; // card background

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

interface LayoutOptions {
  heading: string;
  intro: string;
  bodyHtml: string;
  bodyText: string;
  actionLabel?: string;
  actionPath?: string;
  footerNote?: string;
  /** The grey line shown after the subject in an inbox list. */
  preheader?: string;
}

/** Absolute link into the web app. Relative links do not work in email. */
function appUrl(path: string): string {
  return `${env.webUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * A call-to-action that survives Outlook.
 *
 * Outlook on Windows renders through Word, which ignores padding and
 * border-radius on an anchor — a plain styled `<a>` collapses to bare
 * underlined text. The button is therefore a single-cell table (Word does
 * respect table cell padding and background), with a VML rectangle supplying
 * the rounded corners inside an MSO-only conditional comment.
 */
function button(label: string, url: string): string {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0">
    <tr><td align="center" bgcolor="${INK}" style="border-radius:8px">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                   href="${safeUrl}" style="height:44px;v-text-anchor:middle;width:220px" arcsize="18%"
                   stroke="f" fillcolor="${INK}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeUrl}"
         style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;
                font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${safeLabel}</a>
      <!--<![endif]-->
    </td></tr>
  </table>`;
}

/**
 * The shell every email shares.
 *
 * Tables, not divs. A `max-width` div centred with `margin:0 auto` is ignored
 * by Word, so the message would render full-bleed and left-aligned in Outlook.
 * The nested-table pattern below is the one thing that lays out the same
 * everywhere.
 */
function layout(options: LayoutOptions): { html: string; text: string } {
  const action =
    options.actionLabel && options.actionPath
      ? button(options.actionLabel, appUrl(options.actionPath))
      : '';

  const footerNote =
    options.footerNote ?? 'You are receiving this because of your Skrivbok notification settings.';

  // Shown in the inbox preview line and nowhere else. The run of zero-width
  // spaces stops the client filling the rest of the preview with body copy.
  const preheader = options.preheader ?? options.intro;

  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(options.heading)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  /* Clients that support <style> get the responsive step-down; the inline
     styles below already render correctly without it. */
  @media only screen and (max-width:620px) {
    .sb-card { padding:24px 20px !important; }
    .sb-h1 { font-size:20px !important; }
  }
  a { color:${BRAND}; }
</style>
</head>
<body style="margin:0;padding:0;background:${CANVAS};font-family:${FONT};color:${INK}">
  <div style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${escapeHtml(preheader)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background:${CANVAS};padding:28px 12px">
    <tr><td align="center">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
             style="width:600px;max-width:600px">

        <tr><td style="padding:0 4px 18px">
          <span style="font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-.02em;color:${INK}">
            Skrivbok<span style="color:${BRAND}">.</span>
          </span>
        </td></tr>

        <tr><td class="sb-card" bgcolor="${SURFACE}"
                style="background:${SURFACE};border:1px solid ${BORDER};border-radius:14px;padding:32px">
          <h1 class="sb-h1" style="margin:0 0 10px;font-family:${FONT};font-size:22px;line-height:1.25;
                     letter-spacing:-.02em;font-weight:800;color:${INK}">${escapeHtml(options.heading)}</h1>
          <p style="margin:0 0 22px;font-family:${FONT};font-size:15px;line-height:1.6;color:${MUTED}">
            ${escapeHtml(options.intro)}
          </p>
          ${options.bodyHtml}
          ${action}
        </td></tr>

        <tr><td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;
                       color:${FAINT};text-align:center">
          ${escapeHtml(footerNote)}<br>
          <a href="${escapeHtml(appUrl('/settings'))}" style="color:${FAINT};text-decoration:underline">Email preferences</a>
          &nbsp;·&nbsp;
          <a href="mailto:${escapeHtml(env.mail.supportEmail)}" style="color:${FAINT};text-decoration:underline">Contact support</a>
        </td></tr>

      </table>

    </td></tr>
  </table>
</body></html>`;

  const text = [
    options.heading,
    '',
    options.intro,
    '',
    options.bodyText,
    options.actionLabel && options.actionPath
      ? `\n${options.actionLabel}: ${appUrl(options.actionPath)}`
      : '',
    '',
    '—',
    footerNote,
    `Email preferences: ${appUrl('/settings')}`,
    `Support: ${env.mail.supportEmail}`,
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { html, text };
}

/** One labelled row inside an email body. */
function row(label: string, value: string): string {
  return `<tr>
    <td width="120" style="width:120px;padding:5px 14px 5px 0;font-family:${FONT};color:${MUTED};
               font-size:14px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:5px 0;font-family:${FONT};font-size:14px;color:${INK}">${escapeHtml(value)}</td>
  </tr>`;
}

function table(rows: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"
                 style="border-collapse:collapse;width:100%">${rows.join('')}</table>`;
}

/**
 * A highlighted block, used where an email carries one thing that matters —
 * the project you were added to, the meeting being proposed.
 */
function panel(inner: string, tone: 'brand' | 'accent' = 'brand'): string {
  const bg = tone === 'accent' ? '#fff6d1' : '#eaf0ff';
  const bar = tone === 'accent' ? ACCENT : BRAND;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                 style="margin:0 0 18px"><tr>
    <td width="4" bgcolor="${bar}" style="background:${bar};border-radius:3px 0 0 3px">&nbsp;</td>
    <td bgcolor="${bg}" style="background:${bg};padding:14px 16px;border-radius:0 8px 8px 0;
               font-family:${FONT};font-size:14px;line-height:1.6;color:${BRAND_DEEP}">${inner}</td>
  </tr></table>`;
}

/** Format an instant in the recipient's own timezone, not the server's. */
export function formatInZone(date: Date, timezone: string, withTime = true): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    dateStyle: 'full',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(date);
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface DeadlineReminderData {
  recipientName: string;
  timezone: string;
  deadlines: { title: string; dueAt: Date; priority: string; description: string | null }[];
  daysUntil: number;
}

export function deadlineReminder(to: string, data: DeadlineReminderData): Mail {
  const when =
    data.daysUntil === 0
      ? 'today'
      : data.daysUntil === 1
        ? 'tomorrow'
        : `in ${data.daysUntil} days`;

  const heading =
    data.deadlines.length === 1
      ? `A deadline is due ${when}`
      : `${data.deadlines.length} deadlines are due ${when}`;

  const bodyHtml = data.deadlines
    .map(
      (
        d,
      ) => `<div style="border-left:3px solid ${BRAND};padding:2px 0 2px 14px;margin-bottom:20px">
        <div style="font-family:${FONT};font-weight:700;font-size:15px;color:${INK}">${escapeHtml(d.title)}</div>
        ${table([
          row('Due', formatInZone(d.dueAt, data.timezone)),
          row('Priority', d.priority.toLowerCase()),
        ])}
        ${d.description ? `<p style="margin:8px 0 0;font-family:${FONT};color:${MUTED};font-size:14px;line-height:1.6">${escapeHtml(d.description.slice(0, 300))}</p>` : ''}
      </div>`,
    )
    .join('');

  const bodyText = data.deadlines
    .map(
      (d) =>
        `- ${d.title}\n  Due: ${formatInZone(d.dueAt, data.timezone)}\n  Priority: ${d.priority.toLowerCase()}`,
    )
    .join('\n\n');

  const { html, text } = layout({
    heading,
    intro: `Hello ${data.recipientName}, here is what is coming up.`,
    bodyHtml,
    bodyText,
    actionLabel: 'Open deadlines',
    actionPath: '/deadlines',
  });

  return { to, subject: heading, html, text };
}

export interface DailyAgendaData {
  recipientName: string;
  timezone: string;
  date: Date;
  events: {
    title: string;
    startAt: Date;
    endAt: Date;
    isAllDay: boolean;
    location: string | null;
  }[];
  deadlines: { title: string; dueAt: Date; priority: string }[];
}

export function dailyAgenda(to: string, data: DailyAgendaData): Mail {
  const dayLabel = formatInZone(data.date, data.timezone, false);

  const time = (start: Date, end: Date, allDay: boolean): string => {
    if (allDay) return 'All day';
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: data.timezone,
      timeStyle: 'short',
    });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  };

  const eventsHtml = data.events.length
    ? `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:${MUTED};
                 margin:24px 0 10px">Schedule</h2>` +
      table(
        data.events.map((e) =>
          row(
            time(e.startAt, e.endAt, e.isAllDay),
            e.location ? `${e.title} · ${e.location}` : e.title,
          ),
        ),
      )
    : '';

  const deadlinesHtml = data.deadlines.length
    ? `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:${MUTED};
                 margin:24px 0 10px">Due today</h2>` +
      table(
        data.deadlines.map((d) =>
          row(
            new Intl.DateTimeFormat('en-GB', {
              timeZone: data.timezone,
              timeStyle: 'short',
            }).format(d.dueAt),
            `${d.title} (${d.priority.toLowerCase()})`,
          ),
        ),
      )
    : '';

  const bodyText = [
    data.events.length ? 'Schedule:' : '',
    ...data.events.map((e) => `  ${time(e.startAt, e.endAt, e.isAllDay)}  ${e.title}`),
    data.deadlines.length ? '\nDue today:' : '',
    ...data.deadlines.map((d) => `  ${d.title} (${d.priority.toLowerCase()})`),
  ]
    .filter(Boolean)
    .join('\n');

  const { html, text } = layout({
    heading: 'Your day ahead',
    intro: `${dayLabel} — ${data.events.length} event${data.events.length === 1 ? '' : 's'}, ${data.deadlines.length} deadline${data.deadlines.length === 1 ? '' : 's'}.`,
    bodyHtml: eventsHtml + deadlinesHtml,
    bodyText,
    actionLabel: 'Open calendar',
    actionPath: '/calendar',
  });

  return { to, subject: `Your day ahead — ${dayLabel}`, html, text };
}

export function projectInvite(
  to: string,
  data: { projectName: string; inviterName: string; role: string; projectId: string },
): Mail {
  const { html, text } = layout({
    heading: 'You were added to a project',
    intro: `${data.inviterName} added you to a project on Skrivbok.`,
    bodyHtml:
      panel(
        `<strong style="font-size:15px">${escapeHtml(data.projectName)}</strong><br>` +
          `You have been added as ${escapeHtml(data.role.toLowerCase())}.`,
      ) +
      table([row('Added by', data.inviterName), row('Your role', data.role.toLowerCase())]) +
      `<p style="margin:18px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${MUTED}">
        The project is already in your workspace. Open it and choose
        <strong style="color:${INK}">Accept</strong> to join.
      </p>`,
    bodyText:
      `Project: ${data.projectName}\n` +
      `Your role: ${data.role.toLowerCase()}\n` +
      `Added by: ${data.inviterName}\n\n` +
      'The project is already in your workspace. Open it and choose Accept to join.',
    actionLabel: 'Open project',
    actionPath: `/projects/${data.projectId}`,
  });

  return { to, subject: `Added to “${data.projectName}”`, html, text };
}

export function meetingRequest(
  to: string,
  data: {
    senderName: string;
    title: string;
    startAt: Date;
    endAt: Date;
    timezone: string;
    description: string | null;
  },
): Mail {
  const { html, text } = layout({
    heading: 'New meeting request',
    intro: `${data.senderName} would like to meet.`,
    bodyHtml:
      panel(
        `<strong style="font-size:15px">${escapeHtml(data.title)}</strong><br>` +
          `${escapeHtml(formatInZone(data.startAt, data.timezone))}`,
      ) +
      table([
        row('Until', formatInZone(data.endAt, data.timezone)),
        row('Timezone', data.timezone),
        ...(data.description ? [row('Note', data.description.slice(0, 300))] : []),
      ]),
    bodyText: `Subject: ${data.title}\nWhen: ${formatInZone(data.startAt, data.timezone)}\nUntil: ${formatInZone(data.endAt, data.timezone)}`,
    actionLabel: 'Respond',
    actionPath: '/calendar',
  });

  return { to, subject: `Meeting request: ${data.title}`, html, text };
}

export function meetingResponse(
  to: string,
  data: {
    responderName: string;
    title: string;
    accepted: boolean;
    startAt: Date;
    timezone: string;
  },
): Mail {
  const heading = data.accepted ? 'Meeting request accepted' : 'Meeting request declined';

  const { html, text } = layout({
    heading,
    intro: `${data.responderName} ${data.accepted ? 'accepted' : 'declined'} your meeting request.`,
    bodyHtml: table([
      row('Subject', data.title),
      row('When', formatInZone(data.startAt, data.timezone)),
    ]),
    bodyText: `Subject: ${data.title}\nWhen: ${formatInZone(data.startAt, data.timezone)}`,
    actionLabel: 'Open calendar',
    actionPath: '/calendar',
  });

  return { to, subject: `${heading}: ${data.title}`, html, text };
}

export function welcome(to: string, data: { name: string }): Mail {
  const { html, text } = layout({
    heading: 'Welcome to Skrivbok',
    intro: `Hello ${data.name}, your account is ready.`,
    bodyHtml:
      `<p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:1.6;color:${MUTED}">
        A place for your projects, deadlines, literature, ideas and goals — all in one workspace.
      </p>` +
      panel(
        'Start with one thing: add the deadlines you already know about. ' +
          'Reminders arrive at the hour you choose, in your own timezone.',
        'accent',
      ),
    bodyText:
      'A place for your projects, deadlines, literature, ideas and goals — all in one workspace.\n\n' +
      'Start with one thing: add the deadlines you already know about. Reminders arrive at the hour ' +
      'you choose, in your own timezone.',
    actionLabel: 'Open Skrivbok',
    actionPath: '/dashboard',
    footerNote: 'You are receiving this because you created a Skrivbok account.',
  });

  return { to, subject: 'Welcome to Skrivbok', html, text };
}
