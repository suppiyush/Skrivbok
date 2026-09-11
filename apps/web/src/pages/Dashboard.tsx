/**
 * Dashboard.
 *
 * A directory of the workspace, not a report on it: one card per feature,
 * named and described so someone new can tell what each one is for before
 * they have put anything into it. Matches `design/dashboard-design.png`,
 * including its small count badge in the top-right corner of every card —
 * how many of that thing already exist, not a status or an alert.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Card, PageHeader } from '../components/ui/Layout';
import { Reveal } from '../components/ui/Motion';
import { longDate } from '../lib/format';
import { useAuth } from '../lib/auth';
import { FEATURES } from '../lib/features';
import { preloadRoute } from '../lib/preload';
import {
  careerGoalHooks,
  deadlineHooks,
  futureWorkHooks,
  ideaHooks,
  journalHooks,
  literatureHooks,
  noteHooks,
  projectHooks,
  useMeetings,
} from '../lib/queries';

/**
 * What the "New" button offers.
 *
 * Each of these pages already has its own create dialog behind local state;
 * `openCreate` in router state asks it to open on arrival instead of adding a
 * second, dashboard-only way to create the same thing. See the matching
 * effect in `ResourceScreen.tsx` and `Projects.tsx`.
 */
const NEW_ITEMS = [
  { to: '/projects', icon: 'folder_open', label: 'Project' },
  { to: '/ideas', icon: 'lightbulb', label: 'Idea' },
  { to: '/notes', icon: 'sticky_note_2', label: 'Note' },
];

/**
 * The greeting.
 *
 * Each has to read on its own as well as with a name after it, since not every
 * account has one: "Welcome back" and "Welcome back, Piyush" both have to be
 * sentences.
 */
const GREETINGS = [
  'Welcome back',
  'Good to see you',
  'Hello again',
  'Good to have you back',
  'Back at it',
  'Ready when you are',
];

/**
 * The same greeting all day, a different one tomorrow.
 *
 * Picked from the date rather than at random. A random choice would be re-rolled
 * on every render — the heading would change while the page was being looked at,
 * and again on every return to the dashboard. Keying it to the local day makes
 * it stable for as long as anyone is looking, and still varied over a week.
 */
function greetingFor(now: Date): string {
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = Math.floor(localMidnight.getTime() / 86_400_000);
  return GREETINGS[((day % GREETINGS.length) + GREETINGS.length) % GREETINGS.length]!;
}

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0];
  const greeting = greetingFor(new Date());

  // One count per card: the true total from `pagination.total`, not the size
  // of the page fetched — `limit: 1` asks for as little of the list itself as
  // the API allows, since only the total is used here.
  const counts: Record<string, { value: number | undefined; loading: boolean }> = {
    '/projects': loadCount(projectHooks.useList({ limit: 1 })),
    '/ideas': loadCount(ideaHooks.useList({ limit: 1 })),
    '/notes': loadCount(noteHooks.useList({ limit: 1 })),
    '/deadlines': loadCount(deadlineHooks.useList({ limit: 1 })),
    '/future-work': loadCount(futureWorkHooks.useList({ limit: 1 })),
    '/literature': loadCount(literatureHooks.useList({ limit: 1 })),
    '/journal': loadCount(journalHooks.useList({ limit: 1 })),
    '/meetings': loadCount(useMeetings({ limit: 1 })),
    '/career-goals': loadCount(careerGoalHooks.useList({ limit: 1 })),
  };

  return (
    <AppShell>
      <PageHeader
        serif
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        description={longDate(new Date())}
        actions={<NewMenu />}
      />

      <section>
        <h2 className="text-[11px] font-bold tracking-[0.1em] text-ink-5 uppercase">
          Your workspace
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const count = counts[f.to];
            return (
              <Reveal key={f.to} delay={i * 30}>
                {/* The whole card is the link — the footer text is no longer
                    its own nested `<a>`, just the affordance for it. */}
                <Link
                  to={f.to}
                  className="block h-full"
                  onMouseEnter={() => preloadRoute(f.to)}
                  onFocus={() => preloadRoute(f.to)}
                >
                  <Card padded={false} className="lift row-hover flex h-full flex-col">
                    <div className="relative flex flex-1 flex-col p-5">
                      <span
                        aria-hidden="true"
                        className="absolute top-4 right-4 grid size-7 place-items-center rounded-full bg-surface-2 text-[12px] font-bold text-ink-3 tabular"
                      >
                        {count?.loading ? (
                          <Icon
                            name="progress_activity"
                            size={13}
                            className="animate-spin text-ink-4"
                          />
                        ) : (
                          (count?.value ?? 0)
                        )}
                      </span>

                      <span
                        className="grid size-10 flex-none place-items-center rounded-[12px]"
                        style={{ background: f.tint }}
                      >
                        <Icon name={f.icon} size={20} style={{ color: f.fg }} />
                      </span>
                      <h3 className="mt-4 pr-8 text-[15.5px] font-bold">{f.title}</h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{f.text}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between border-t border-line px-5 py-3 text-[13px] font-semibold text-brand-ink">
                      View all
                      <Icon name="arrow_forward" size={17} className="row-arrow" />
                    </div>
                  </Card>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

/* ── Small pieces ─────────────────────────────────────────────────────────── */

/** Closes on an outside click or Escape. Returned ref goes on the menu's container. */
function useDismiss(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onDismiss]);

  return ref;
}

/** The single "New" action, replacing the old "New deadline" / "Capture an
 *  idea" pair — one button, a short list of what it can create. */
function NewMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(() => setOpen(false));

  /**
   * Opening the menu is the signal that one of these is about to be needed, so
   * their chunks start downloading now rather than on the click. By the time a
   * pointer has travelled to a menu item, the destination is usually already
   * in memory and the navigation costs nothing.
   */
  const openMenu = () => {
    setOpen((v) => !v);
    for (const item of NEW_ITEMS) preloadRoute(item.to);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="brand"
        size="sm"
        icon="add"
        iconAfter="expand_more"
        aria-expanded={open}
        onMouseEnter={() => {
          for (const item of NEW_ITEMS) preloadRoute(item.to);
        }}
        onClick={openMenu}
      >
        New
      </Button>

      {open ? (
        <div className="animate-slide-down absolute top-full right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop">
          {NEW_ITEMS.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(item.to, { state: { openCreate: true } });
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] font-medium text-ink-2 transition hover:bg-surface-2"
            >
              <Icon name={item.icon} size={17} className="text-ink-4" />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Reads the total out of any resource list query, whatever shape it's in. */
function loadCount(query: {
  data?: { pagination: { total: number } } | undefined;
  isPending: boolean;
}): { value: number | undefined; loading: boolean } {
  return { value: query.data?.pagination.total, loading: query.isPending };
}
