/**
 * HTML escaping.
 *
 * Lived in the resume renderer until the CV feature was removed; the email
 * templates still need it, and they are the more obvious home for it now —
 * every interpolated value in an email is user-supplied and untrusted.
 */
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}
