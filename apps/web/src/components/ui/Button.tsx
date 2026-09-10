/**
 * Button.
 *
 * Five variants, all present in the designs:
 *   primary   dark pill — the app's main action
 *   accent    yellow — the marketing CTA
 *   secondary white with a border
 *   ghost     transparent, hover tint
 *   danger    destructive
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-[#1a2130] border border-transparent',
  accent: 'bg-accent text-ink hover:brightness-95 border border-transparent font-bold',
  secondary: 'bg-surface text-ink border border-line-2 hover:bg-surface-2',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface-3',
  danger: 'bg-danger text-white hover:brightness-95 border border-transparent',
};

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-11 px-4 text-sm gap-2 rounded-[11px]',
  lg: 'h-[52px] px-6 text-[15px] gap-2.5 rounded-[13px]',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconAfter?: string;
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      // A button that is working is also a button that must not be pressed
      // again — the two states are the same thing.
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={`inline-flex select-none items-center justify-center font-semibold transition
        disabled:cursor-not-allowed disabled:opacity-55
        ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Icon name="progress_activity" size={18} className="animate-spin" />
      ) : icon ? (
        <Icon name={icon} size={18} />
      ) : null}
      {children}
      {iconAfter && !loading ? <Icon name={iconAfter} size={18} /> : null}
    </button>
  );
}
