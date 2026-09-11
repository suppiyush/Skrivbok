/**
 * Display formatting.
 *
 * The backend stores instants in UTC and records the timezone the user authored
 * them in. Everything here formats for reading; nothing here parses user input
 * back into an instant — that belongs with the form that collects it.
 */

/** "2 days ago", "in 3 hours", "just now". */
export function relative(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(then.getTime())) return '—';

  const seconds = Math.round((then.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 2_592_000) return rtf.format(Math.round(seconds / 86_400), 'day');
  if (abs < 31_536_000) return rtf.format(Math.round(seconds / 2_592_000), 'month');
  return rtf.format(Math.round(seconds / 31_536_000), 'year');
}

/**
 * A duration as a clock reading: `0:07`, `3:07`, `12:40`.
 *
 * Seconds only — nothing here runs to an hour, and `0:07` is read at a glance
 * where `7s` beside `3:07` is not.
 */
export function clock(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** A compact relative age for list rows: "2d", "3w", "1y". */
export function shortAge(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(then.getTime())) return '—';

  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d`;
  if (seconds < 2_592_000) return `${Math.round(seconds / 604_800)}w`;
  if (seconds < 31_536_000) return `${Math.round(seconds / 2_592_000)}mo`;
  return `${Math.round(seconds / 31_536_000)}y`;
}

/** "7 September 2026". */
export function longDate(iso: string | Date | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
}

/** "Mon 7 Sep, 17:00" — the form used everywhere a deadline is listed. */
export function dateTime(iso: string | Date | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
}

/** "17:00". */
export function timeOnly(iso: string | Date | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
}

/** `YYYY-MM-DD` in the given zone — the value an `<input type="date">` wants. */
export function dateInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `YYYY-MM-DDTHH:mm` in local time — for `<input type="datetime-local">`. */
export function dateTimeInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateInputValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** How overdue, or how long left. Returns null when there is nothing to say. */
export function dueLabel(iso: string | null | undefined): {
  text: string;
  tone: 'danger' | 'warning' | 'neutral';
} | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;

  const ms = due.getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);

  if (ms < 0) return { text: `Overdue by ${shortAge(due)}`, tone: 'danger' };
  if (days === 0) return { text: `Due today, ${timeOnly(due)}`, tone: 'warning' };
  if (days === 1) return { text: `Due tomorrow, ${timeOnly(due)}`, tone: 'warning' };
  if (days <= 7) return { text: `Due ${dateTime(due)}`, tone: 'warning' };
  return { text: `Due ${dateTime(due)}`, tone: 'neutral' };
}

/** Paise from the billing API into "₹4,999". */
export function rupees(paise: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}

/** Up to two initials for an avatar. */
export function initials(name: string | null | undefined, fallback = '?'): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || fallback;
}

/** Title Case for an enum value: `IN_PROGRESS` → `In progress`. */
export function humanise(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
