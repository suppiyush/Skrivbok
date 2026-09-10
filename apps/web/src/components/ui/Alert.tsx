/** Inline alert. Four severities, each with an icon so colour is never the only signal. */
import type { ReactNode } from 'react';
import { Icon } from './Icon';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<Tone, { bar: string; icon: string; tint: string; fg: string }> = {
  info: { bar: 'border-l-brand', icon: 'info', tint: 'text-brand', fg: 'text-ink' },
  success: {
    bar: 'border-l-[#2e7d55]',
    icon: 'check_circle',
    tint: 'text-[#2e7d55]',
    fg: 'text-ink',
  },
  warning: { bar: 'border-l-warn', icon: 'warning', tint: 'text-warn', fg: 'text-ink' },
  danger: { bar: 'border-l-danger', icon: 'error', tint: 'text-danger', fg: 'text-ink' },
};

export function Alert({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-2xl border-l-[3px] bg-surface p-[18px_20px] ${t.bar}`}
    >
      <Icon name={t.icon} size={21} className={`flex-none ${t.tint}`} />
      <div className="min-w-0">
        <h2 className={`text-[15px] font-bold ${t.fg}`}>{title}</h2>
        {children ? (
          <div className="mt-1.5 max-w-[70ch] text-[13.5px] leading-relaxed text-ink-3">
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
