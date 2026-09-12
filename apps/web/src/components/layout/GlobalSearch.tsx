/**
 * The header's search box.
 *
 * Two kinds of answer, from two places. Sections and pages — "Projects",
 * "Calendar", "Settings" — are matched here, in the browser, against a list
 * that never changes; there is no reason to ask a server which pages the app
 * has. Records — a project by name, an idea, a paper — come from `/search`,
 * which looks across every kind the user owns and says what each hit is.
 *
 * The two are shown together, the pages first: when "cal" matches both the
 * Calendar page and an idea called "Calibration", the page is the shorter
 * trip and almost always the one meant.
 *
 * Choosing a hit goes somewhere. A project has a page of its own; a record
 * in one of the list sections has none, so the section opens with its own
 * search box already holding the title — the record is at the top, and the
 * user is where they can act on it.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { search as searchApi, type SearchHit, type SearchKind } from '../../lib/api';
import { FEATURES } from '../../lib/features';
import { preloadRoute } from '../../lib/preload';
import { Icon } from '../ui/Icon';

/* ── What can be found ────────────────────────────────────────────────────── */

interface Page {
  title: string;
  to: string;
  icon: string;
  /** Other words that should find it. */
  aliases?: string[];
}

/** Everywhere in the app worth typing the name of. */
const PAGES: Page[] = [
  { title: 'Dashboard', to: '/dashboard', icon: 'dashboard', aliases: ['home'] },
  ...FEATURES.map((f) => ({ title: f.title, to: f.to, icon: f.icon })),
  { title: 'Calendar', to: '/calendar', icon: 'calendar_month', aliases: ['events'] },
  { title: 'Profile', to: '/profile', icon: 'person', aliases: ['account', 'me'] },
  { title: 'Settings', to: '/settings', icon: 'settings', aliases: ['preferences'] },
  {
    title: 'Upgrade to PRO',
    to: '/upgrade',
    icon: 'workspace_premium',
    aliases: ['plan', 'billing'],
  },
  { title: 'Help and feedback', to: '/help', icon: 'help', aliases: ['support', 'report', 'bug'] },
  { title: 'Notifications', to: '/notifications', icon: 'notifications' },
];

/** How each kind of record is named and drawn, and where it lives. */
const KINDS: Record<SearchKind, { label: string; icon: string; section: string }> = {
  project: { label: 'Project', icon: 'folder_open', section: '/projects' },
  idea: { label: 'Idea', icon: 'lightbulb', section: '/ideas' },
  note: { label: 'Note', icon: 'sticky_note_2', section: '/notes' },
  journal: { label: 'Journal entry', icon: 'history_edu', section: '/journal' },
  deadline: { label: 'Deadline', icon: 'flag', section: '/deadlines' },
  'future-work': { label: 'Future work', icon: 'rocket_launch', section: '/future-work' },
  literature: { label: 'Literature', icon: 'menu_book', section: '/literature' },
  'career-goal': { label: 'Career goal', icon: 'stairs', section: '/career-goals' },
  event: { label: 'Event', icon: 'calendar_month', section: '/calendar' },
};

/** One row in the list, whichever of the two sources it came from. */
type Suggestion =
  | { key: string; kind: 'page'; title: string; label: string; icon: string; to: string }
  | { key: string; kind: 'hit'; hit: SearchHit; label: string; icon: string };

function matchPages(q: string): Suggestion[] {
  const needle = q.toLowerCase();
  return PAGES.filter(
    (p) =>
      p.title.toLowerCase().includes(needle) ||
      p.aliases?.some((a) => a.toLowerCase().includes(needle)),
  ).map((p) => ({
    key: `page:${p.to}`,
    kind: 'page',
    title: p.title,
    label: 'Page',
    icon: p.icon,
    to: p.to,
  }));
}

/* ── The box ──────────────────────────────────────────────────────────────── */

export function GlobalSearch({ autoFocus = false }: { autoFocus?: boolean } = {}) {
  const navigate = useNavigate();
  const listId = useId();

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();

  // Records, debounced, and only past two characters — one letter matches
  // half of everything and says nothing. A reply that arrives after the box
  // has moved on is dropped rather than shown against the wrong query.
  useEffect(() => {
    if (trimmed.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }

    let stale = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchApi(trimmed)
        .then((r) => {
          if (!stale) setHits(r.results);
        })
        .catch(() => {
          if (!stale) setHits([]);
        })
        .finally(() => {
          if (!stale) setSearching(false);
        });
    }, 180);

    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (trimmed === '') return [];
    const pages = matchPages(trimmed);
    const records = hits.map<Suggestion>((hit) => ({
      key: `${hit.kind}:${hit.id}`,
      kind: 'hit',
      hit,
      label: KINDS[hit.kind].label,
      icon: KINDS[hit.kind].icon,
    }));
    return [...pages, ...records];
  }, [trimmed, hits]);

  // A new list starts at the top.
  useEffect(() => setActive(0), [suggestions]);

  // The phone's search is behind a button, so opening it is already the
  // intent — the keyboard should come up without a second tap.
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  // Outside click and Escape close it; the box keeps its text.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function choose(s: Suggestion) {
    setOpen(false);
    setQuery('');
    input.current?.blur();

    if (s.kind === 'page') {
      navigate(s.to);
      return;
    }

    const { hit } = s;
    if (hit.kind === 'project') {
      navigate(`/projects/${hit.id}`);
    } else if (hit.kind === 'event') {
      // The month it is in, so it is on screen when the calendar opens.
      navigate('/calendar', { state: hit.at ? { at: hit.at } : null });
    } else {
      // No page of its own: the section opens searching for it by name.
      navigate(KINDS[hit.kind].section, { state: { search: hit.title } });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      input.current?.blur();
      return;
    }
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = suggestions[active];
      if (chosen) choose(chosen);
    }
  }

  const showList = open && trimmed !== '';
  const nothing = showList && !searching && suggestions.length === 0 && trimmed.length >= 2;

  return (
    <div ref={root} className="relative w-full max-w-[420px]">
      {/* White, now that the bar behind it is the canvas: `surface-2` is four
          points off the ground it would be sitting on. */}
      <label className="flex h-10 w-full items-center gap-2.5 rounded-full border border-line bg-surface px-4 focus-within:border-brand">
        <Icon name="search" size={19} className="flex-none text-ink-4" />
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search everything"
          aria-label="Search everything"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && suggestions[active] ? `${listId}-${suggestions[active].key}` : undefined
          }
          autoComplete="off"
          className="w-full min-w-0 border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              input.current?.focus();
            }}
            aria-label="Clear search"
            className="flex-none text-ink-4 transition hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        ) : null}
      </label>

      {showList ? (
        <div className="animate-slide-down absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          {suggestions.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="max-h-[min(60vh,440px)] overflow-y-auto py-1.5"
            >
              {suggestions.map((s, i) => (
                <li
                  key={s.key}
                  id={`${listId}-${s.key}`}
                  role="option"
                  aria-selected={i === active}
                >
                  <button
                    type="button"
                    // Mouse down, not click: a click lands after the input's
                    // blur, and the blur is what closes the list.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(s);
                    }}
                    onMouseEnter={() => {
                      setActive(i);
                      if (s.kind === 'page') preloadRoute(s.to);
                    }}
                    className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition ${
                      i === active ? 'bg-surface-2' : ''
                    }`}
                  >
                    <span className="grid size-8 flex-none place-items-center rounded-[9px] bg-surface-4 text-ink-3">
                      <Icon name={s.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {s.kind === 'page' ? s.title : s.hit.title}
                      </span>
                      {s.kind === 'hit' && s.hit.subtitle ? (
                        <span className="block truncate text-[12px] text-ink-4 capitalize">
                          {s.hit.subtitle}
                        </span>
                      ) : null}
                    </span>
                    {/* What it is, so two things with one name can be told
                        apart at a glance. */}
                    <span className="flex-none rounded-md border border-line-2 bg-surface px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.04em] text-ink-3 uppercase">
                      {s.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : nothing ? (
            <p className="px-4 py-5 text-center text-[13px] text-ink-4">
              Nothing named “{trimmed}”
            </p>
          ) : (
            <p className="px-4 py-5 text-center text-[13px] text-ink-4">
              {trimmed.length < 2 ? 'Keep typing…' : 'Searching…'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
