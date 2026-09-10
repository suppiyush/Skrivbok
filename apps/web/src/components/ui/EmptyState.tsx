/**
 * Empty state.
 *
 * Two distinct cases, deliberately not merged: `first-use` explains the feature
 * and offers the primary action; `filtered` says the search found nothing and
 * offers to clear it. Showing the onboarding copy after a failed search reads
 * as though the user's data has vanished.
 */
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 rounded-[20px] bg-surface px-7 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-surface-2">
        <Icon name={icon} size={28} className="text-ink-4" />
      </span>
      <h2 className="text-[19px] font-bold">{title}</h2>
      {children ? (
        <p className="max-w-[46ch] text-sm leading-relaxed text-ink-3">{children}</p>
      ) : null}
      {action ? <div className="mt-1.5 flex gap-2.5">{action}</div> : null}
    </div>
  );
}
