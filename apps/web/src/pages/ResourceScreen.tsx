/**
 * The screen behind Ideas, Notes, Journal, Deadlines, Future work, Literature
 * and Career goals.
 *
 * These seven are the same thing with different fields: a searchable, filtered,
 * paginated list of records the signed-in user owns, with create, edit and
 * delete. Writing them separately would be seven chances for the loading state,
 * the empty state, the error state or the free-plan cap to be handled slightly
 * differently.
 *
 * Everything specific to one resource arrives through `ResourceConfig`:
 * which hooks to call, how to render a row, and what the form contains.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppShell, useDensity } from '../components/layout/AppShell';
import { Alert } from '../components/ui/Alert';
import { AudioPlayer } from '../components/ui/AudioPlayer';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import {
  Card,
  PageHeader,
  Pagination,
  Pill,
  SearchInput,
  SectionLabel,
  Toolbar,
} from '../components/ui/Layout';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { Reveal } from '../components/ui/Motion';
import { Skeleton, useSlowLoad } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { ApiError, type LimitStatus, type Paginated } from '../lib/api';
import type { ResourceHooks } from '../lib/queries';

/** What a record looks like once reduced to a list row. */
export interface Row {
  primary: string;
  secondary?: string | null | undefined;
  meta?: string | undefined;
  tag?: string | undefined;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | undefined;
  /** Rendered under the row when present — used for progress bars. */
  extra?: ReactNode;
}

/**
 * A record drawn as a card rather than a row.
 *
 * Offered per resource, because only some of them are objects. An idea is a
 * thing you wrote on a coloured square and want to recognise across a wall of
 * them; a deadline is a record in a register, and a register is a list.
 */
export interface CardView {
  /**
   * A background colour, for a resource whose colour means something.
   *
   * Its presence is what makes the card a sticky note: tinted, taller, and
   * with a turned-up corner. Without it the card is a plain panel — which is
   * what a record you never chose a colour for should look like.
   */
  tint?: string | undefined;
  primary: string;
  secondary?: string | null | undefined;
  badge?: string | undefined;
  meta?: string | undefined;
  /** A recording to play in place, without opening the record first. */
  audioUrl?: string | undefined;
  /** Its length, so the bar reads correctly before anything is downloaded. */
  audioSeconds?: number | null | undefined;
}

export interface FilterDef {
  /** The query parameter sent to the backend. */
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface ResourceConfig<T extends { id: string }> {
  title: string;
  icon: string;
  blurb: string;
  createLabel: string;
  /** Singular, for dialog titles: "idea", "deadline". */
  noun: string;

  hooks: ResourceHooks<T, Record<string, unknown>, Record<string, unknown>>;
  /**
   * Free-plan cap, when this resource has one.
   *
   * `isPending` is part of the contract because the quota decides whether the
   * header carries a usage meter: the screen waits for it before drawing the
   * body, so the meter cannot appear late and displace what is beneath it.
   */
  useQuota?: () => { data?: LimitStatus | undefined; isPending: boolean };

  filters?: FilterDef[];
  sorts?: { value: string; label: string }[];
  searchable?: boolean;

  row: (item: T) => Row;
  /**
   * Draw this resource as a grid of cards instead of a list.
   *
   * `row` is still required when this is set: the delete dialog names what it
   * is about to delete, and it asks `row` for that name.
   */
  card?: (item: T) => CardView;
  /** The dialog body. `item` is null when creating. */
  form: (item: T | null) => ReactNode;
  /** Turn the submitted form into the request body. */
  toInput: (form: FormData) => Record<string, unknown>;

  /**
   * Rendered beside the create button.
   *
   * A function rather than a node so it can own state and dialogs of its own —
   * recording a voice note is a second way of creating a note, not a variation
   * on the first, and it does not belong in the shared create form.
   */
  extraAction?: () => ReactNode;

  /**
   * Rendered between the header and the toolbar — a row of figures about the
   * whole collection, where the list below shows only a page of it.
   */
  stats?: () => ReactNode;

  /** A small heading over the list, e.g. "Your goals". */
  listLabel?: string;

  /** Rendered to the left of the list, e.g. the literature tag filter. */
  aside?: (state: {
    filters: Record<string, string>;
    setFilter: (n: string, v: string) => void;
  }) => ReactNode;

  emptyTitle: string;
  emptyBody: string;
}

const PAGE_SIZE = 20;

export function ResourceScreen<T extends { id: string }>({
  config,
}: {
  config: ResourceConfig<T>;
}) {
  const { compact } = useDensity();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(config.sorts?.[0]?.value ?? '');

  /**
   * A link into this page (the dashboard's "New" menu) can ask for the create
   * dialog to be open on arrival, through router state rather than a query
   * string — it is intent for one navigation, not part of the URL.
   *
   * Read during the first render, not in an effect. An effect runs after the
   * browser has painted, so opening it there would show the bare list for a
   * frame and then pop the dialog over it; deciding here puts the dialog in the
   * first painted frame instead.
   */
  const openOnArrival = (location.state as { openCreate?: boolean } | null)?.openCreate === true;

  const [editing, setEditing] = useState<T | null | undefined>(openOnArrival ? null : undefined); // undefined = closed
  const [deleting, setDeleting] = useState<T | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // The flag has been acted on, so it is dropped from history straight away —
  // left in place, a refresh or a back navigation would reopen the dialog.
  useEffect(() => {
    if (openOnArrival) navigate(location.pathname, { replace: true, state: null });
    // Once, on arrival: re-running this when `location` changes would fire
    // again for the very navigation it just performed.
  }, []);

  // Debounce the search so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...filters,
      ...(sort ? { sort } : {}),
    }),
    [page, search, filters, sort],
  );

  const list = config.hooks.useList(query);
  const create = config.hooks.useCreate();
  const update = config.hooks.useUpdate();
  const remove = config.hooks.useRemove();
  const quota = config.useQuota?.();

  const result = list.data as Paginated<T> | undefined;
  const items = result?.data ?? [];
  const meta = result?.pagination;

  const filtering = search !== '' || Object.values(filters).some(Boolean);
  const limit = quota?.data;
  const atLimit = limit?.limited === true && limit.remaining === 0;

  const setFilter = (name: string, value: string) => {
    setFilters((current) => {
      const next = { ...current };
      if (value) next[name] = value;
      else delete next[name];
      return next;
    });
    setPage(1);
  };

  function clearFilters() {
    setFilters({});
    setSearchInput('');
    setSearch('');
    setPage(1);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const input = config.toInput(new FormData(event.currentTarget));
    const item = editing;

    try {
      if (item) await update.mutateAsync({ id: item.id, input });
      else await create.mutateAsync(input);

      toast.success(item ? `${cap(config.noun)} updated` : `${cap(config.noun)} created`);
      setEditing(undefined);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        setFieldErrors(error.fieldErrors);
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('Could not reach the server. Check your connection and try again.');
      }
    }
  }

  async function onDelete() {
    const item = deleting;
    if (!item) return;
    try {
      await remove.mutateAsync(item.id);
      toast.success(`${cap(config.noun)} deleted`);
      setDeleting(null);
      // Stepping back a page avoids landing on an empty final page.
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete that. Try again.');
      setDeleting(null);
    }
  }

  const saving = create.isPending || update.isPending;
  // Hoisted so the narrowing survives into the render callback below, where
  // `config.card` on its own is only ever "possibly undefined".
  const asCard = config.card;
  // The quota is waited on too: it decides whether the header carries a usage
  // meter, and arriving late it would push the whole body down the page.
  const loading = list.isPending || (quota?.isPending ?? false);
  // Nothing is drawn for a wait too short to read — see `useSlowLoad`.
  const showSkeleton = useSlowLoad(loading);

  return (
    <AppShell>
      <PageHeader
        title={config.title}
        description={config.blurb}
        crumbs={[{ label: config.title }]}
        icon={config.icon}
        meta={limit?.limited ? <QuotaMeter status={limit} /> : undefined}
        actions={
          <>
            {config.extraAction?.()}
            <Button
              variant="primary"
              size="sm"
              icon="add"
              disabled={atLimit}
              onClick={() => setEditing(null)}
            >
              {config.createLabel}
            </Button>
          </>
        }
      />

      {atLimit && limit?.limit !== null && limit !== undefined ? (
        <Alert
          tone="warning"
          title={`All ${limit.limit} on the free plan are in use`}
          action={
            <Link to="/upgrade">
              <Button variant="primary" size="sm">
                See PRO
              </Button>
            </Link>
          }
        >
          PRO lifts the cap. Ideas, notes, journal entries, deadlines and calendar events are
          unlimited on every plan.
        </Alert>
      ) : null}

      {config.stats?.()}

      {(config.searchable ?? true) || config.filters?.length || config.sorts?.length ? (
        <Toolbar>
          {(config.searchable ?? true) ? (
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder={`Search ${config.title.toLowerCase()}`}
            />
          ) : null}

          {config.filters?.map((filter) => (
            <SelectFilter
              key={filter.name}
              label={filter.label}
              value={filters[filter.name] ?? ''}
              options={filter.options}
              onChange={(v) => setFilter(filter.name, v)}
            />
          ))}

          {config.sorts?.length ? (
            <SelectFilter
              label="Sort"
              value={sort}
              options={config.sorts}
              onChange={(v) => {
                setSort(v);
                setPage(1);
              }}
              alwaysLabelled
            />
          ) : null}
        </Toolbar>
      ) : null}

      {config.listLabel ? <SectionLabel>{config.listLabel}</SectionLabel> : null}

      <div className={config.aside ? 'grid items-start gap-5 lg:grid-cols-[228px_1fr]' : ''}>
        {config.aside?.({ filters, setFilter })}

        <div className="flex min-w-0 flex-col gap-4">
          {loading ? (
            showSkeleton ? (
              <div className="shimmer flex flex-col gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} h={compact ? 54 : 66} radius={14} />
                ))}
              </div>
            ) : null
          ) : list.isError ? (
            <Card className="grid place-items-center gap-3 py-14 text-center">
              <Icon name="cloud_off" size={30} className="text-danger" />
              <h2 className="text-[17px] font-bold">{config.title} could not be loaded</h2>
              <p className="max-w-[46ch] text-[13.5px] leading-relaxed text-ink-3">
                Nothing has been lost.{' '}
                {list.error instanceof ApiError
                  ? list.error.message
                  : 'The server did not respond.'}
              </p>
              <Button variant="primary" size="sm" onClick={() => void list.refetch()}>
                Try again
              </Button>
            </Card>
          ) : items.length === 0 && filtering ? (
            <EmptyState
              icon="search_off"
              title="Nothing matches those filters"
              action={
                <Button variant="secondary" icon="close" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            >
              Try a shorter phrase, or remove one of the filters above.
            </EmptyState>
          ) : items.length === 0 ? (
            <EmptyState
              icon={config.icon}
              title={config.emptyTitle}
              action={
                <Button variant="primary" icon="add" onClick={() => setEditing(null)}>
                  {config.createLabel}
                </Button>
              }
            >
              {config.emptyBody}
            </EmptyState>
          ) : (
            <>
              {asCard ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item, i) => (
                    <Reveal key={item.id} delay={i * 35}>
                      <ResourceCard
                        view={asCard(item)}
                        onEdit={() => setEditing(item)}
                        onDelete={() => setDeleting(item)}
                      />
                    </Reveal>
                  ))}
                </div>
              ) : (
                <Reveal>
                  <Card padded={false} className="overflow-hidden">
                    <ul>
                      {items.map((item) => {
                        const row = config.row(item);
                        return (
                          <li key={item.id} className="border-t border-line first:border-t-0">
                            <div
                              className={`row-hover group flex items-center gap-4 px-5 hover:bg-surface-3 ${
                                compact ? 'py-2.5' : 'py-3.5'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setEditing(item)}
                                className="min-w-0 flex-1 cursor-pointer text-left"
                              >
                                <span className="block truncate text-[14.5px] font-semibold text-ink">
                                  {row.primary}
                                </span>
                                {row.secondary ? (
                                  <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                                    {row.secondary}
                                  </span>
                                ) : null}
                                {row.extra}
                              </button>

                              {row.tag ? (
                                <span className="hidden sm:block">
                                  <Pill tone={row.tone ?? 'neutral'}>{row.tag}</Pill>
                                </span>
                              ) : null}

                              {row.meta ? (
                                <span className="hidden w-28 flex-none text-right font-mono text-[12px] text-ink-3 tabular sm:block">
                                  {row.meta}
                                </span>
                              ) : null}

                              <RowActions
                                onEdit={() => setEditing(item)}
                                onDelete={() => setDeleting(item)}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                </Reveal>
              )}

              {meta ? (
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  total={meta.total}
                  shown={items.length}
                  onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => p + 1)}
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? `Edit ${config.noun}` : `New ${config.noun}`}
        onSubmit={onSubmit}
        busy={saving}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(undefined)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              {editing ? 'Save changes' : config.createLabel}
            </Button>
          </>
        }
      >
        {formError ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-xl border-l-[3px] border-l-danger bg-danger-tint px-4 py-3"
          >
            <Icon name="error" size={18} className="mt-px flex-none text-danger" />
            <p className="text-[13px] leading-relaxed text-danger-ink">{formError}</p>
          </div>
        ) : null}

        {/* Only while open.

            The dialog element itself stays mounted, and the fields inside are
            uncontrolled — `defaultValue` applies when an input mounts and
            never again. Left mounted, the form kept whatever was last typed
            into it: creating one record and opening the dialog again showed
            the previous one's title and body, ready to be saved a second time.
            Unmounting on close makes every opening a fresh form. */}
        {editing !== undefined ? (
          <FormErrors.Provider value={fieldErrors}>
            {/* Rendered as a component, not called as a function: `useFieldError`
                has to run *inside* the provider to see the errors, and calling
                `config.form()` here would run its hooks in this component's
                scope, outside it, where the context is always empty. */}
            <ResourceForm item={editing ?? null} render={config.form} />
          </FormErrors.Provider>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void onDelete()}
        title={`Delete this ${config.noun}?`}
        what={deleting ? config.row(deleting).primary : ''}
        busy={remove.isPending}
      />
    </AppShell>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

/**
 * One record as a sticky note.
 *
 * The colour is the point: a wall of these is meant to be scannable by hue
 * before a word of it is read, which is what choosing a colour was always for.
 * The tints are pale enough that the ordinary ink colour still sits on them at
 * full contrast — a note you cannot read is a worse note than a white one.
 *
 * The body is clamped rather than scrolled. A card is a reminder of what you
 * wrote; the dialog is where you read it.
 */
function ResourceCard({
  view,
  onEdit,
  onDelete,
}: {
  view: CardView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // A tint makes it a note; without one it is a card, and a card has no
  // coloured field to fill, so it sits tighter and shows less of the body.
  const sticky = view.tint !== undefined;

  return (
    <div
      className={`lift group relative flex h-full flex-col rounded-[16px] border border-line p-4 ${
        sticky ? 'min-h-[150px]' : 'min-h-[112px] bg-surface'
      }`}
      style={sticky ? { background: view.tint } : undefined}
    >
      {sticky ? <span className="note-fold" aria-hidden="true" /> : null}

      {/* The face opens it; the actions live in the footer instead of the
          corner, which the fold occupies on a note. */}
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 cursor-pointer flex-col text-left"
      >
        <span
          className={`line-clamp-2 text-[14.5px] leading-snug font-bold text-ink ${sticky ? 'pr-6' : ''}`}
        >
          {view.primary}
        </span>
        {view.secondary ? (
          <span
            className={`mt-1.5 text-[13px] leading-relaxed text-ink-2 ${
              sticky ? 'line-clamp-4' : 'line-clamp-2'
            }`}
          >
            {view.secondary}
          </span>
        ) : null}
      </button>

      {/* Playable from the list. Opening a dialog to hear a thirty-second clip
          is three interactions where one will do. */}
      {view.audioUrl ? (
        <AudioPlayer src={view.audioUrl} seconds={view.audioSeconds} className="mt-3" />
      ) : null}

      <div className="mt-3 flex flex-none items-center gap-2">
        {view.badge ? (
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white capitalize">
            {view.badge}
          </span>
        ) : null}
        {view.meta ? <span className="ml-auto text-[11.5px] text-ink-3">{view.meta}</span> : null}
        <span className={view.meta ? '' : 'ml-auto'}>
          <RowActions onEdit={onEdit} onDelete={onDelete} />
        </span>
      </div>
    </div>
  );
}

/* ── Field errors ─────────────────────────────────────────────────────────── */

/**
 * Server-side field errors, passed down rather than threaded through every
 * form config. The forms are defined in `screens.tsx` as plain JSX; asking each
 * to accept and forward an errors object would clutter all seven of them.
 */
const FormErrors = createContext<Record<string, string>>({});

/** `error={useFieldError('title')}` inside a resource form. */
export function useFieldError(name: string): string | undefined {
  return useContext(FormErrors)[name];
}

/** Renders a config's form inside the error provider. See the note at its use. */
function ResourceForm<T>({
  item,
  render,
}: {
  item: T | null;
  render: (item: T | null) => ReactNode;
}) {
  return <div className="flex flex-col gap-4">{render(item)}</div>;
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

function cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The free-plan usage bar shown under a capped resource's heading. */
export function QuotaMeter({ status }: { status: LimitStatus }) {
  if (!status.limited || status.limit === null) return null;
  const pct = Math.min(100, Math.round((status.used / status.limit) * 100));
  const full = status.remaining === 0;

  return (
    <div className="flex max-w-[380px] items-center gap-3">
      <span className="h-1.5 min-w-[110px] flex-1 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background: full ? 'var(--color-warn)' : 'var(--color-brand)',
          }}
        />
      </span>
      <span className="flex-none text-[12.5px] text-ink-3 tabular">
        {status.used} of {status.limit}
      </span>
      {full ? (
        <Link to="/upgrade" className="flex-none text-[12.5px] font-semibold text-brand-ink">
          Upgrade
        </Link>
      ) : null}
    </div>
  );
}

/** A filter rendered as a native select, so it works on touch without extra code. */
function SelectFilter({
  label,
  value,
  options,
  onChange,
  alwaysLabelled = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  alwaysLabelled?: boolean;
}) {
  const active = value !== '';
  return (
    <div className="relative flex-none">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`h-10 cursor-pointer appearance-none rounded-xl border py-0 pr-9 pl-3.5 text-[13.5px] font-medium outline-none transition ${
          active && !alwaysLabelled
            ? 'border-brand bg-brand-tint text-brand-deep'
            : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
        }`}
      >
        {!alwaysLabelled ? <option value="">{label}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {alwaysLabelled ? `${label}: ${o.label}` : o.label}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        size={17}
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-4"
      />
    </div>
  );
}

/**
 * Per-row edit and delete.
 *
 * Both actions in the open rather than behind a menu. There are only ever two
 * of them, and a menu to reach two things costs a click and a guess at what is
 * inside — the pencil and the bin say what they do without being opened.
 *
 * They sit quiet until wanted: grey at rest, and the bin only turns red under
 * the pointer, so a wall of cards is not a wall of red.
 */
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-none items-center gap-0.5">
      <RowAction icon="edit" label="Edit" onClick={onEdit} />
      <RowAction icon="delete" label="Delete" onClick={onDelete} danger />
    </div>
  );
}

function RowAction({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Stopped here because a card's whole face opens the record: without it,
      // deleting would open the dialog on the way out.
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`press grid size-8 place-items-center rounded-lg text-ink-4 transition ${
        danger ? 'hover:bg-danger-tint hover:text-danger-ink' : 'hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}
