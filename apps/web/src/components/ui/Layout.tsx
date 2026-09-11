/**
 * Page-level layout primitives.
 *
 * Everything inside the app is built from these four, so spacing and hierarchy
 * are decided once rather than re-invented per screen. The previous pass let
 * each page set its own margins and put a developer control in the page header,
 * which read as clutter.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

/* ── Breadcrumb ───────────────────────────────────────────────────────────── */

export interface Crumb {
  label: string;
  /** Absent on the last crumb, which is where you are. */
  to?: string;
}

/**
 * Where you are, and the way back.
 *
 * Always starts at the dashboard — every section is reached from it, so it is
 * the one ancestor every trail shares and the one place the trail can begin.
 * The last crumb is the current page and is text, not a link to itself.
 */
export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  const crumbs: Crumb[] = [{ label: 'Dashboard', to: '/dashboard' }, ...trail];

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-ink-3">
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 ? (
              <Icon name="chevron_right" size={15} className="flex-none text-ink-5" />
            ) : null}
            {crumb.to && !last ? (
              <Link to={crumb.to} className="flex items-center gap-1.5 transition hover:text-ink">
                {i === 0 ? <Icon name="dashboard" size={15} /> : null}
                {crumb.label}
              </Link>
            ) : (
              <span
                className={`truncate ${last ? 'font-semibold text-ink-2' : ''}`}
                aria-current={last ? 'page' : undefined}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * The heading block at the top of a screen.
 *
 * Title and description are one unit; actions sit opposite and wrap beneath on
 * narrow screens rather than squeezing the title.
 *
 * `serif` sets the pair in the display face. It is opt-in and not the default
 * because a screen title is a label — it names where you are, and the sans
 * says that more plainly. The greeting on the dashboard is the exception: it
 * addresses the reader rather than labelling the page, which is the one place
 * the warmer face earns its extra download.
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  crumbs,
  icon,
  serif = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  /** The trail below the dashboard. Omit on the dashboard itself. */
  crumbs?: Crumb[];
  /** A tile beside the title — the section's own icon, as on its dashboard card. */
  icon?: string;
  serif?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {crumbs ? (
          <div className="mb-2.5">
            <Breadcrumb trail={crumbs} />
          </div>
        ) : null}
        <div className="flex items-start gap-3.5">
          {icon ? (
            <span
              className="mt-0.5 grid size-11 flex-none place-items-center rounded-[13px] bg-brand-tint text-brand-ink-2"
              aria-hidden="true"
            >
              <Icon name={icon} size={23} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1
              className={
                serif
                  ? 'font-serif text-[31px] leading-tight font-semibold tracking-[-0.01em]'
                  : 'text-[26px] leading-tight font-extrabold tracking-[-0.03em]'
              }
            >
              {title}
            </h1>
            {description ? (
              <p
                className={`mt-1.5 max-w-[68ch] leading-relaxed text-ink-3 ${
                  serif ? 'font-serif text-[15.5px]' : 'text-[14px]'
                }`}
              >
                {description}
              </p>
            ) : null}
            {meta ? <div className="mt-3">{meta}</div> : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A white panel. The single container used across the app. */
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-[18px] border border-line bg-surface ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

/** Heading inside a card. Optional trailing link keeps cards scannable. */
export function CardHeader({
  title,
  count,
  action,
  icon,
  tint,
  fg,
}: {
  title: string;
  count?: string | number | undefined;
  action?: ReactNode;
  icon?: string;
  tint?: string;
  fg?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon ? (
        <span
          className="grid size-9 flex-none place-items-center rounded-[11px]"
          style={{ background: tint ?? 'var(--color-surface-2)' }}
        >
          <Icon name={icon} size={19} style={{ color: fg ?? 'var(--color-ink-2)' }} />
        </span>
      ) : null}
      <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold">{title}</h2>
      {count !== undefined ? (
        <span className="flex-none font-mono text-[12px] text-ink-3 tabular">{count}</span>
      ) : null}
      {action}
    </div>
  );
}

/** Filter/search strip. One row, wrapping, consistent control height. */
/**
 * A small capitals heading with a rule running off to the right — the kind
 * that names a region of a page without competing with the page title.
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="flex-none text-[11px] font-bold tracking-[0.1em] text-ink-4 uppercase">
        {children}
      </h2>
      <span className="h-px flex-1 bg-line-2" aria-hidden="true" />
    </div>
  );
}

/**
 * One figure about a collection — a count, a percentage — with its name
 * beneath and a bar of brand colour down the left edge. Four of these in a
 * row are a summary; one on its own is a badge.
 */
export function MetricCard({
  value,
  label,
  loading = false,
}: {
  value: string | number;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-line bg-surface py-5 pr-5 pl-6">
      <span className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden="true" />
      <p
        className={`text-[30px] leading-none font-extrabold tracking-[-0.02em] text-brand-ink tabular ${
          loading ? 'opacity-40' : ''
        }`}
      >
        {loading ? '—' : value}
      </p>
      <p className="mt-2 text-[13.5px] text-ink-3">{label}</p>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5">
      <Icon name="search" size={19} className="flex-none text-ink-4" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="grid size-6 flex-none place-items-center rounded-full text-ink-4 hover:bg-surface-2"
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </label>
  );
}

/** A dropdown-styled filter trigger. Visual only until wired to real filters. */
export function FilterButton({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={`flex h-10 flex-none items-center gap-1.5 rounded-xl border px-3.5 text-[13.5px] font-medium transition ${
        active
          ? 'border-brand bg-brand-tint text-brand-deep'
          : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
      }`}
    >
      {label}
      <Icon name="expand_more" size={17} className="text-ink-4" />
    </button>
  );
}

/** Small status pill. Tone carries an icon so colour is never the only signal. */
export function Pill({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
  // Explicitly nullable: with `exactOptionalPropertyTypes` a caller passing a
  // conditional `icon={x ? 'star' : undefined}` is a type error otherwise.
  icon?: string | undefined;
}) {
  const TONE = {
    neutral: 'bg-surface-2 text-ink-3',
    brand: 'bg-brand-tint text-brand-deep',
    success: 'bg-[#e7f4ec] text-[#2e7d55]',
    warning: 'bg-warn-tint text-warn-ink',
    danger: 'bg-danger-tint text-danger-ink',
  };

  return (
    <span
      className={`inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${TONE[tone]}`}
    >
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

/**
 * Right-aligned pagination footer used under every list.
 *
 * Hides itself entirely on a single page: a "1 / 1" control with both arrows
 * disabled is noise on the great majority of screens.
 */
export function Pagination({
  page,
  totalPages,
  total,
  shown,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  shown: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  if (totalPages <= 1) {
    return (
      <p className="pt-1 text-[12.5px] text-ink-3 tabular">
        {total} {total === 1 ? 'item' : 'items'}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-[12.5px] text-ink-3 tabular">
        Showing {shown} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrevious}
          className="press flex h-9 items-center gap-1 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition hover:bg-surface-2 disabled:opacity-45 disabled:hover:bg-surface"
        >
          <Icon name="chevron_left" size={17} />
          Previous
        </button>
        <span className="px-2 text-[12.5px] text-ink-3 tabular">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="press flex h-9 items-center gap-1 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition hover:bg-surface-2 disabled:opacity-45 disabled:hover:bg-surface"
        >
          Next
          <Icon name="chevron_right" size={17} />
        </button>
      </div>
    </div>
  );
}
