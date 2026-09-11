/**
 * The signed-in shell: top bar, collapsible sidebar, content region.
 *
 * Restraint is the point. Navigation is neutral by default and only the active
 * item carries colour — a sidebar where every label is blue has no hierarchy
 * left to spend on the item you are actually on.
 *
 * Density (comfortable / compact) lives in Settings rather than the sidebar:
 * it is set once and then never touched, so it does not deserve permanent
 * space next to the navigation.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { accentVars, FEATURE_PATHS, paletteFor } from '../../lib/features';
import {
  useCareerSummary,
  useDeadlineSummary,
  useEventRange,
  useMeetings,
  useNotificationActions,
  useNotifications,
  useUnreadCount,
  useUsage,
} from '../../lib/queries';
import { longDate, relative } from '../../lib/format';
import type { LimitStatus } from '../../lib/api';
import { Icon } from '../ui/Icon';
import { Logo } from '../marketing/MarketingChrome';
import { GlobalSearch } from './GlobalSearch';

export type Density = 'comfortable' | 'compact';

/**
 * Sidebar navigation.
 *
 * Deliberately short. The dashboard is now a directory of the workspace — one
 * card per feature — so listing the same nine destinations down the side as
 * well is the same menu twice. What stays here is what the dashboard does not
 * cover: the dashboard itself, and the calendar, which has no card.
 *
 * Everything else is still one click away: the features from the dashboard
 * cards, and Profile from the account menu in the top bar.
 */
const NAV_GROUPS: {
  group: string;
  items: {
    icon: string;
    name: string;
    to: string;
    /**
     * Other routes this entry stays lit for.
     *
     * The dashboard's cards are the only way into most of the workspace, so a
     * visitor on Ideas or Projects is still inside the dashboard as far as the
     * navigation is concerned — leaving nothing highlighted there would read
     * as having fallen out of the app.
     */
    covers?: string[];
  }[];
}[] = [
  {
    group: '',
    items: [
      { icon: 'dashboard', name: 'Dashboard', to: '/dashboard', covers: FEATURE_PATHS },
      { icon: 'calendar_month', name: 'Calendar', to: '/calendar' },
    ],
  },
];

const DENSITY_KEY = 'skrivbok:density';
const COLLAPSE_KEY = 'skrivbok:sidebar-collapsed';

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function useDensity() {
  const [density, setDensity] = useState<Density>(
    () => readPref(DENSITY_KEY, 'comfortable') as Density,
  );

  useEffect(() => {
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* private mode — the preference simply does not persist */
    }
  }, [density]);

  return { density, setDensity, compact: density === 'compact' };
}

/** Close a popover on outside click and on Escape. */
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

export function AppShell({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { compact } = useDensity();

  const [collapsed, setCollapsed] = useState(() => readPref(COLLAPSE_KEY, 'false') === 'true');
  const [mobileNav, setMobileNav] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const notifRef = useDismiss(() => setNotifOpen(false));
  const menuRef = useDismiss(() => setMenuOpen(false));

  // The three live numbers in the chrome. All three are cheap counts, and all
  // three are wrong the moment they are hard-coded.
  const unread = useUnreadCount().data?.unreadCount ?? 0;
  const overdue = useDeadlineSummary().data?.overdue ?? 0;
  const usage = useUsage().data;

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const BAR = 64;
  const expanded = !collapsed;

  // Admins get one more group. It is added here rather than listed with the
  // others, so that a user who is not one never sees a route they cannot open.
  const navGroups = useMemo(
    () =>
      user?.role === 'ADMIN'
        ? [
            ...NAV_GROUPS,
            {
              group: 'Admin',
              items: [{ icon: 'admin_panel_settings', name: 'Admin panel', to: '/admin' }],
            },
          ]
        : NAV_GROUPS,
    [user?.role],
  );

  // The section's own colour, applied to the content region and nowhere
  // else: the header and sidebar stay coral whichever section is open, so the
  // chrome reads as one product and the page as one room in it. The variables
  // are the brand tokens themselves, so nothing inside has to know.
  const palette = paletteFor(pathname);
  const accent = palette ? accentVars(palette) : undefined;
  const initials =
    (user?.name ?? user?.email ?? '?')
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    // The sidebar is fixed, so the content region reserves its width through a
    // custom property that a single media query in index.css consumes. This
    // keeps the value in one place instead of duplicating a breakpoint here.
    <div
      className="min-h-screen bg-canvas"
      style={{ ['--sidebar-w' as string]: `${expanded ? 236 : 72}px` }}
    >
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      {/* The chrome shares the canvas rather than sitting on white: header,
          sidebar and content are one continuous ground, and the cards are the
          only thing that lifts off it.

          These two edges carry `line-2` where everything else uses `line`.
          With no change of colour either side of them, the border is the only
          thing dividing the regions at all, and at the lighter weight it had
          almost nothing to do the job with. */}
      <header
        className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-line-2 bg-canvas px-4 sm:px-5"
        style={{ height: BAR }}
      >
        <button
          type="button"
          onClick={() => {
            setCollapsed((v) => !v);
            setMobileNav((v) => !v);
          }}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="grid size-10 flex-none place-items-center rounded-[10px] text-ink-2 hover:bg-surface-2"
        >
          <Icon name="menu" size={23} />
        </button>

        {/* The logo always leaves the app for the marketing site — "/dashboard"
            already has its own nav item for staying inside the app. */}
        <Link to="/" className="flex-none" aria-label="Skrivbok home">
          <Logo size={28} />
        </Link>

        <div className="mx-auto hidden min-w-0 flex-1 justify-center md:flex">
          <GlobalSearch />
        </div>

        <div className="ml-auto flex flex-none items-center gap-1 md:ml-0">
          {overdue > 0 ? (
            <Link
              to="/deadlines"
              title={`${overdue} ${overdue === 1 ? 'deadline is' : 'deadlines are'} overdue`}
              className="animate-fade-in hidden h-9 items-center gap-1.5 rounded-full px-2.5 text-ink-2 transition hover:bg-surface-2 sm:flex"
            >
              <Icon name="local_fire_department" size={20} className="text-warn" />
              <span className="text-[14px] font-bold tabular">{overdue}</span>
            </Link>
          ) : null}

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              aria-expanded={notifOpen}
              className="press relative grid size-10 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2"
            >
              <Icon name="notifications" size={22} />
              {unread > 0 ? (
                <span className="animate-scale-in absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger-strong px-1 text-[10px] font-bold text-white tabular">
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </button>
            {notifOpen ? <NotificationPanel onClose={() => setNotifOpen(false)} /> : null}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Your account"
              aria-expanded={menuOpen}
              className="grid size-9 place-items-center rounded-full bg-brand-avatar text-[13px] font-bold text-brand-avatar-ink"
            >
              {initials}
            </button>
            {menuOpen ? (
              <div className="absolute top-12 right-0 z-50 w-[248px] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
                <div className="border-b border-line px-4 py-3.5">
                  <p className="truncate text-[14px] font-bold">{user?.name ?? 'Your account'}</p>
                  <p className="truncate text-[12.5px] text-ink-3">{user?.email}</p>
                </div>
                {/* Profile only. Settings and Help are in the sidebar footer,
                    so listing them here as well was the same link twice. */}
                <div className="p-1.5">
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium text-ink-2 hover:bg-surface-3"
                  >
                    <Icon name="badge" size={18} className="text-ink-4" />
                    Profile
                  </Link>
                </div>
                <div className="border-t border-line p-1.5">
                  <button
                    type="button"
                    onClick={() => void signOut().then(() => navigate('/login'))}
                    className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium text-ink-2 hover:bg-surface-3"
                  >
                    <Icon name="logout" size={18} className="text-ink-4" />
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside
        className={`sidebar-motion fixed top-16 bottom-0 left-0 z-30 flex-col overflow-x-hidden border-r border-line-2 bg-canvas ${
          mobileNav ? 'flex' : 'hidden'
        } md:flex`}
        style={{ width: expanded ? 236 : 72 }}
      >
        <nav aria-label="Sections" className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((g, gi) => (
            <div key={g.group || gi} className={gi > 0 ? 'mt-5' : ''}>
              {g.group && expanded ? (
                <p className="px-3 pb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-ink-5 uppercase">
                  {g.group}
                </p>
              ) : null}
              {g.group && !expanded ? <div className="mx-3 mb-2 h-px bg-line-3" /> : null}

              <ul className="flex flex-col gap-0.5">
                {g.items.map((i) => {
                  // `Link` with the state worked out here, rather than
                  // `NavLink`: its matching is per-route, and it cannot express
                  // one entry standing in for a set of other paths.
                  const isActive = pathname === i.to || (i.covers?.includes(pathname) ?? false);

                  return (
                    <li key={i.to}>
                      <Link
                        to={i.to}
                        title={i.name}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => setMobileNav(false)}
                        className={`flex items-center gap-3 rounded-[10px] ${
                          expanded ? 'px-3' : 'justify-center px-0'
                        } ${compact ? 'py-1.5' : 'py-2'} text-[14px] transition ${
                          isActive
                            ? 'bg-brand-tint font-semibold text-brand-deep'
                            : 'font-medium text-ink-2 hover:bg-surface-3'
                        }`}
                      >
                        {/* The active icon takes the label's deep coral, not
                            `--color-brand`: the bright coral on the tint behind
                            it is barely 2:1, and reads as glare next to text
                            that is doing the same job properly. */}
                        <Icon
                          name={i.icon}
                          size={21}
                          className={`flex-none ${isActive ? 'text-brand-deep' : 'text-ink-4'}`}
                        />
                        {expanded ? <span className="sidebar-label truncate">{i.name}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Only when expanded: at 72px there is room for an icon and nothing
              else, and a column of bare numbers says nothing. */}
          {expanded ? <SidebarMetrics /> : null}
        </nav>

        <div className="border-t border-line p-3">
          {/* Both plans get a block here, and both lead to the same page.
              On FREE it sells the upgrade; on PRO it is the only way into
              billing — the subscription, its renewal date and the payment
              history all live behind this link, and nothing else in the app
              points at them once you are subscribed.

              Collapsed, either block shrinks to the crown alone, matching how
              Help and Settings below reduce to their icons. */}
          {user ? (
            expanded ? (
              user.plan === 'FREE' ? (
                <FreePlanCard usage={usage} />
              ) : (
                <ProPlanCard endsAt={user.subscriptionEndsAt} />
              )
            ) : (
              <Link
                to="/upgrade"
                title={user.plan === 'FREE' ? 'Upgrade to PRO' : 'Plan and billing'}
                aria-label={user.plan === 'FREE' ? 'Upgrade to PRO' : 'Plan and billing'}
                className="sidebar-label mb-1 flex items-center justify-center rounded-[10px] py-2 hover:bg-surface-3"
              >
                <Crown size={22} />
              </Link>
            )
          ) : null}

          {[
            { icon: 'help', name: 'Help', to: '/help' },
            { icon: 'settings', name: 'Settings', to: '/settings' },
          ].map((s) => (
            <Link
              key={s.to}
              to={s.to}
              title={s.name}
              className={`flex items-center gap-3 rounded-[10px] ${
                expanded ? 'px-3' : 'justify-center px-0'
              } py-2 text-[14px] font-medium text-ink-2 hover:bg-surface-3`}
            >
              <Icon name={s.icon} size={21} className="flex-none text-ink-4" />
              {expanded ? <span className="sidebar-label">{s.name}</span> : null}
            </Link>
          ))}
        </div>
      </aside>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {/* `with-sidebar` reserves the rail's width from the `--sidebar-w`
          property set on the wrapper above, so the padding follows the width
          with no second source of truth. This replaced a <style> element that
          rewrote a global rule on every toggle — a stylesheet reparse landing
          in the middle of the very animation it was driving. */}
      {/* `fill` hands the whole region below the header to the page, at exactly
          the viewport's remaining height and with no padding of its own. For a
          screen that manages its own scrolling — a two-pane editor, say — the
          centred, padded column above is the wrong container: it would let the
          page grow past the fold and put a second scrollbar on the window. */}
      <main className="with-sidebar sidebar-motion pt-16" style={accent}>
        {fill ? (
          <div className="h-[calc(100dvh-64px)] overflow-hidden">{children}</div>
        ) : (
          <div
            className="mx-auto flex max-w-[1180px] flex-col px-4 py-6 sm:px-6 sm:py-8"
            style={{ gap: compact ? 18 : 24 }}
          >
            {children}
          </div>
        )}
      </main>
    </div>
  );
}

/* ── At a glance ──────────────────────────────────────────────────────────── */

/**
 * The live numbers, in the sidebar.
 *
 * Mostly the counters the dashboard used to open with. They read better here:
 * the dashboard is now a directory of the workspace, and a number saying
 * "three deadlines land this week" is worth seeing from every screen, not only
 * from the one you land on.
 *
 * Read-only by design. These report a state rather than offering a
 * destination, and a row that looks clickable but only navigates to a list is
 * a worse answer than the number itself.
 *
 * Each label names its own subject — "Deadlines this week", not "Due this
 * week" — so a figure glanced at in the corner of the screen does not depend
 * on the heading above it to mean anything.
 *
 * A count of zero still gets a row. The block keeping a fixed height means the
 * sidebar does not reshuffle itself as the day goes on, and "nothing is due"
 * is information too — but it greys out, because only a number above zero is
 * asking for anything.
 */
function SidebarMetrics() {
  // "Today" is the user's civil day, taken from the browser: the backend stores
  // instants, and which of them count as today is a display decision.
  const { dayStart, dayEnd } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { dayStart: start.toISOString(), dayEnd: end.toISOString() };
  }, []);

  // `useDeadlineSummary` is already called by the shell for the overdue badge
  // in the top bar; asking again costs nothing, as the query is shared.
  const deadlines = useDeadlineSummary();
  const today = useEventRange(dayStart, dayEnd);
  const incoming = useMeetings({ box: 'incoming', status: 'PENDING', limit: 5 });
  const goals = useCareerSummary();

  /**
   * One pastel per row, from the sticky-notes palette.
   *
   * The colour is on the icon alone and never on the figure: mint at 13px
   * reads at under 2:1 on white, so a number wearing it would be decoration
   * rather than something anyone could read. Green and purple also match what
   * the dashboard already gives meetings and career goals, so the same subject
   * keeps its colour across the two screens.
   */
  const rows: {
    label: string;
    icon: string;
    colour: string;
    value: number | undefined;
    loading: boolean;
    /** For a figure that is not a plain count, such as a percentage. */
    suffix?: string;
  }[] = [
    {
      // "Due this week" on its own does not say due *what* — the label carries
      // the noun so the number can be read without the surrounding context.
      label: 'Deadlines this week',
      icon: 'schedule',
      colour: 'var(--color-brand)', // coral
      value: deadlines.data?.dueThisWeek,
      loading: deadlines.isPending,
    },
    {
      label: 'Events today',
      icon: 'calendar_month',
      colour: 'var(--color-teal)', // blue
      value: today.data?.events.length,
      loading: today.isPending,
    },
    {
      label: 'Awaiting reply',
      icon: 'groups',
      colour: 'var(--color-mint)', // green
      value: incoming.data?.data.length,
      loading: incoming.isPending,
    },
    {
      label: 'Goal progress',
      icon: 'stairs',
      colour: '#9b6fd4', // purple
      value: goals.data?.averageProgress,
      suffix: '%',
      loading: goals.isPending,
    },
  ];

  return (
    <div className="sidebar-label mt-6 border-t border-line pt-4">
      <p className="px-3 pb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-ink-5 uppercase">
        At a glance
      </p>

      {/* Read-only: these report, they do not navigate. No hover state and no
          cursor change, so nothing here invites a click that does nothing. */}
      <dl className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5 px-3 py-1.5">
            <Icon name={r.icon} size={17} className="flex-none" style={{ color: r.colour }} />
            <dt className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-2">
              {r.label}
            </dt>
            {r.loading ? (
              // An em dash rather than a zero: "nothing is due" and "we have
              // not asked yet" are different things to tell someone.
              <dd className="flex-none text-[13px] text-ink-5">—</dd>
            ) : (
              <dd
                className={`flex-none text-[13px] font-bold tabular ${
                  (r.value ?? 0) > 0 ? 'text-ink' : 'text-ink-5'
                }`}
              >
                {r.value ?? 0}
                {r.suffix ?? ''}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Free plan ────────────────────────────────────────────────────────────── */

/**
 * The premium mark.
 *
 * Drawn here rather than taken from the icon font, so that the shape and its
 * colour are certain — a ligature name that is not in the loaded set renders
 * as the literal word, and this mark appears in the collapsed sidebar with no
 * label beside it to explain a failure.
 *
 * Coral rather than the accent yellow: filled solid at this size the yellow
 * washes out against near-white panels, and the orange is the palette's own.
 */
function Crown({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="var(--color-brand)"
      className="flex-none"
    >
      <path d="M3 7.4 7.1 10.3 12 4.6 16.9 10.3 21 7.4 19.6 16.2 4.4 16.2Z" />
      <rect x="3.9" y="17.8" width="16.2" height="2.5" rx="1.25" />
    </svg>
  );
}

/**
 * The free-plan block in the sidebar footer.
 *
 * The three caps are detail, not headline: they matter when you are close to
 * one and are noise the rest of the time. So the block states the plan and
 * offers the upgrade, and the numbers wait behind a hover.
 *
 * Hover alone would leave the figures unreachable from the keyboard, so focus
 * opens it too — the upgrade link inside is a tab stop, and React's focus
 * events bubble from it to this wrapper.
 */
/**
 * The PRO counterpart of the block below.
 *
 * Deliberately quieter: there is nothing to sell and no cap to report, so it
 * states the plan, says how long it runs, and gets out of the way. Its job is
 * to be the way into billing, which otherwise has no entrance for a subscriber.
 *
 * `subscriptionEndsAt` comes from the session rather than a fresh subscription
 * query — the shell renders on every screen, and this line does not warrant a
 * request on each of them.
 */
function ProPlanCard({ endsAt }: { endsAt: string | null }) {
  return (
    <Link
      to="/upgrade"
      className="sidebar-label mb-2 flex items-center gap-2.5 rounded-xl border border-line bg-surface-5 p-3 transition hover:border-line-2"
    >
      <Crown size={16} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold">PRO</span>
        <span className="mt-0.5 block truncate text-[11px] text-ink-3">
          {endsAt ? `Runs until ${longDate(endsAt)}` : 'Plan and billing'}
        </span>
      </span>
      <Icon name="chevron_right" size={16} className="flex-none text-ink-5" />
    </Link>
  );
}

function FreePlanCard({
  usage,
}: {
  usage: { projects: LimitStatus; careerGoals: LimitStatus; literature: LimitStatus } | undefined;
}) {
  const [showCaps, setShowCaps] = useState(false);

  const caps = usage
    ? [
        { label: 'Projects', status: usage.projects },
        { label: 'Career goals', status: usage.careerGoals },
        { label: 'Literature', status: usage.literature },
      ]
    : [];

  return (
    <div className="sidebar-label relative mb-2">
      {showCaps ? (
        // Above the card: this sits near the bottom of the sidebar, so a
        // tooltip below it would open off the edge of the screen.
        <div
          id="free-plan-caps"
          role="tooltip"
          className="animate-slide-down absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-line bg-surface p-3 shadow-pop"
        >
          <p className="text-[10.5px] font-bold tracking-[0.08em] text-ink-5 uppercase">
            Included on free
          </p>
          {caps.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {caps.map((c) => (
                <li key={c.label} className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-ink-3">{c.label}</span>
                  <span className="font-semibold tabular">
                    {c.status.used}/{c.status.limit ?? '∞'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            // No invented zeros while the figures are still loading.
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">
              Projects, career goals and literature are capped. Everything else is unlimited.
            </p>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-line bg-surface-5 p-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold">
          <Crown size={15} />
          Free plan
          {/* The caps show on the (i) alone, not the whole card — a card that
              pops something up whenever the pointer crosses it is a card you
              cannot move past without being interrupted. A button, so the
              keyboard can reach it too. */}
          <button
            type="button"
            aria-label="What the free plan includes"
            aria-describedby={showCaps ? 'free-plan-caps' : undefined}
            onMouseEnter={() => setShowCaps(true)}
            onMouseLeave={() => setShowCaps(false)}
            onFocus={() => setShowCaps(true)}
            onBlur={() => setShowCaps(false)}
            className="ml-auto grid size-6 flex-none place-items-center rounded-md text-ink-5 transition hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="info" size={14} />
          </button>
        </p>

        {/* Styled as the primary button rather than built from `Button`: a
            <button> inside a link is not a thing the browser handles well. */}
        <Link
          to="/upgrade"
          className="press mt-2.5 flex h-9 items-center justify-center rounded-[10px] bg-ink text-[13px] font-semibold text-white transition hover:bg-[#1a2130]"
        >
          Upgrade to PRO
        </Link>
      </div>
    </div>
  );
}

/* ── Notification panel ───────────────────────────────────────────────────── */

/** Each notification type gets an icon and a tint, so the list is scannable. */
const NOTIF_STYLE: Record<string, { icon: string; tint: string; fg: string }> = {
  DEADLINE_REMINDER: {
    icon: 'flag',
    tint: 'var(--color-danger-tint)',
    fg: 'var(--color-danger)',
  },
  DEADLINE_OVERDUE: { icon: 'flag', tint: 'var(--color-danger-tint)', fg: 'var(--color-danger)' },
  MEETING_REQUEST: { icon: 'groups', tint: 'var(--color-brand-tint)', fg: 'var(--color-brand)' },
  MEETING_ACCEPTED: {
    icon: 'event_available',
    tint: 'var(--color-brand-tint)',
    fg: 'var(--color-brand)',
  },
  MEETING_DECLINED: {
    icon: 'event_busy',
    tint: 'var(--color-surface-2)',
    fg: 'var(--color-ink-4)',
  },
  PROJECT_INVITE: {
    icon: 'folder_shared',
    tint: 'var(--color-brand-tint)',
    fg: 'var(--color-brand)',
  },
  CALENDAR_ACCESS_REQUEST: {
    icon: 'shield_person',
    tint: 'var(--color-brand-tint)',
    fg: 'var(--color-brand)',
  },
  CALENDAR_ACCESS_GRANTED: {
    icon: 'shield_lock',
    tint: 'var(--color-brand-tint)',
    fg: 'var(--color-brand)',
  },
  SUBSCRIPTION: {
    icon: 'workspace_premium',
    tint: 'var(--color-accent-tint)',
    fg: 'var(--color-accent-ink)',
  },
};

const DEFAULT_NOTIF_STYLE = {
  icon: 'notifications',
  tint: 'var(--color-surface-2)',
  fg: 'var(--color-ink-4)',
};

function NotificationPanel({ onClose }: { onClose: () => void }) {
  // Only the newest few: the panel is a glance, and /notifications is the list.
  const { data, isPending } = useNotifications({ limit: 6 });
  const { markAllRead, markRead } = useNotificationActions();
  const items = data?.data ?? [];

  return (
    <div className="animate-slide-down absolute top-12 right-0 z-50 w-[358px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-[14px] font-bold">Notifications</span>
        <button
          type="button"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || items.every((n) => n.readAt !== null)}
          className="text-[12.5px] font-semibold text-brand-ink disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>

      {isPending ? (
        <p className="px-4 py-6 text-center text-[13px] text-ink-4">Loading…</p>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Icon name="notifications_off" size={26} className="text-ink-5" />
          <p className="mt-2 text-[13px] text-ink-3">Nothing new.</p>
        </div>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto">
          {items.map((n) => {
            const style = NOTIF_STYLE[n.type] ?? DEFAULT_NOTIF_STYLE;
            const unread = n.readAt === null;
            return (
              <li key={n.id}>
                <Link
                  to={n.link ?? '/notifications'}
                  onClick={() => {
                    if (unread) markRead.mutate([n.id]);
                    onClose();
                  }}
                  className="flex gap-3 border-b border-line px-4 py-3 transition last:border-b-0 hover:bg-surface-3"
                  style={{ background: unread ? 'var(--color-brand-tint-2)' : undefined }}
                >
                  <span
                    className="grid size-8 flex-none place-items-center rounded-[10px]"
                    style={{ background: style.tint }}
                  >
                    <Icon name={style.icon} size={17} style={{ color: style.fg }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">{n.title}</span>
                    {n.message ? (
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
                        {n.message}
                      </span>
                    ) : null}
                    <span className="mt-1 block font-mono text-[10.5px] text-ink-4">
                      {relative(n.createdAt)}
                    </span>
                  </span>
                  {unread ? (
                    <span className="mt-1.5 size-2 flex-none rounded-full bg-brand" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-line px-4 py-2.5">
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-[12.5px] font-semibold text-brand-ink"
        >
          See all notifications
        </Link>
      </div>
    </div>
  );
}
