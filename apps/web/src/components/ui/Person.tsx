/**
 * A person, drawn in their colour.
 *
 * `PersonAvatar` is the initials disc; `PersonChip` is the pill with a name.
 * Both take the email as the identity, so the colour comes out the same
 * wherever the person appears — see `lib/people.ts`. Plain text mentions of a
 * person (an invite form, "From: …") stay uncoloured; these are for where a
 * person is shown as a thing to recognise.
 */
import type { ReactNode } from 'react';
import { initials } from '../../lib/format';
import { personColour } from '../../lib/people';

export function PersonAvatar({
  name,
  email,
  size = 32,
}: {
  name: string | null | undefined;
  email: string;
  size?: number;
}) {
  const colour = personColour(email);
  return (
    <span
      aria-hidden="true"
      className="grid flex-none place-items-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.36)),
        background: colour.tint,
        color: colour.ink,
        boxShadow: `inset 0 0 0 1.5px ${colour.solid}`,
      }}
    >
      {initials(name ?? email)}
    </span>
  );
}

export function PersonChip({
  name,
  email,
  children,
}: {
  name: string | null | undefined;
  email: string;
  /** Anything after the name, e.g. a status. */
  children?: ReactNode;
}) {
  const colour = personColour(email);
  return (
    <span
      title={email}
      className="flex h-7 max-w-full items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-[12px] font-semibold"
      style={{
        borderColor: `color-mix(in srgb, ${colour.solid} 35%, transparent)`,
        background: colour.tint,
        color: colour.ink,
      }}
    >
      <PersonAvatar name={name} email={email} size={20} />
      <span className="min-w-0 truncate">{name ?? email}</span>
      {children}
    </span>
  );
}
