/**
 * One colour per person, the same everywhere.
 *
 * A teammate drawn as a chip or an avatar — on a project, in a meeting's
 * attendees, beside a shared calendar — wears the same colour on every page,
 * so a person can be followed across the workspace at a glance.
 *
 * The colour is derived from the email address rather than stored or handed
 * out in order. That makes it:
 *
 *   - stable: it does not change when someone joins, leaves or is re-sorted;
 *   - shared: everyone looking at Alice sees Alice in the same colour, without
 *     a table to keep in sync;
 *   - available for people with no account yet, who have only an address.
 *
 * Twelve hues, so with a large team two people can share one. The name beside
 * the colour is still what identifies them; the colour is for recognising.
 */

export interface PersonColour {
  /** Dots, borders, calendar blocks. */
  solid: string;
  /** Backgrounds of avatars and chips. */
  tint: string;
  /** Text on the tint — dark enough to read on it. */
  ink: string;
}

const PALETTE: PersonColour[] = [
  { solid: '#2563eb', tint: '#dbeafe', ink: '#1e40af' },
  { solid: '#059669', tint: '#d1fae5', ink: '#065f46' },
  { solid: '#7c3aed', tint: '#ede9fe', ink: '#5b21b6' },
  { solid: '#ea580c', tint: '#ffedd5', ink: '#9a3412' },
  { solid: '#0891b2', tint: '#cffafe', ink: '#155e75' },
  { solid: '#db2777', tint: '#fce7f3', ink: '#9d174d' },
  { solid: '#65a30d', tint: '#ecfccb', ink: '#3f6212' },
  { solid: '#4f46e5', tint: '#e0e7ff', ink: '#3730a3' },
  { solid: '#0d9488', tint: '#ccfbf1', ink: '#115e59' },
  { solid: '#d97706', tint: '#fef3c7', ink: '#92400e' },
  { solid: '#e11d48', tint: '#ffe4e6', ink: '#9f1239' },
  { solid: '#0284c7', tint: '#e0f2fe', ink: '#075985' },
];

/** FNV-1a: small, fast, and spreads similar addresses across the palette. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function personColour(email: string): PersonColour {
  const key = email.trim().toLowerCase();
  return PALETTE[hash(key) % PALETTE.length] ?? PALETTE[0]!;
}
