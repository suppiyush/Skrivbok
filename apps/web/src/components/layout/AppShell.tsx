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
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  useDeadlineSummary,
  useNotificationActions,
  useNotifications,
  useUnreadCount,
  useUsage,
} from '../../lib/queries';
import { relative } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { Logo } from '../marketing/MarketingChrome';

export type Density = 'comfortable' | 'compact';

const NAV_GROUPS: { group: string; items: { icon: string; name: string; to: string }[] }[] = [
  { group: '', items: [{ icon: 'dashboard', name: 'Dashboard', to: '/dashboard' }] },
  {
    group: 'Capture',
    items: [
      { icon: 'lightbulb', name: 'Ideas', to: '/ideas' },
      { icon: 'sticky_note_2', name: 'Notes', to: '/notes' },
      { icon: 'history_edu', name: 'Journal', to: '/journal' },
    ],
  },
  {
    group: 'Organise',
    items: [
      { icon: 'folder_open', name: 'Projects', to: '/projects' },
      { icon: 'menu_book', name: 'Literature', to: '/literature' },
      { icon: 'rocket_launch', name: 'Future work', to: '/future-work' },
    ],
  },
  {
    group: 'Commit',
    items: [
      { icon: 'flag', name: 'Deadlines', to: '/deadlines' },
      { icon: 'calendar_month', name: 'Calendar', to: '/calendar' },
      { icon: 'groups', name: 'Meetings', to: '/meetings' },
    ],
  },
  {
    group: 'Grow',
    items: [
      { icon: 'stairs', name: 'Career goals', to: '/career-goals' },
      { icon: 'badge', name: 'Profile', to: '/profile' },
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

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
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
      <header
        className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-line bg-surface px-4 sm:px-5"
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

        <Link to="/dashboard" className="flex-none" aria-label="Dashboard">
          <Logo size={28} />
        </Link>

        <div className="mx-auto hidden min-w-0 flex-1 justify-center md:flex">
          <label className="flex h-10 w-full max-w-[420px] items-center gap-2.5 rounded-full border border-line bg-surface-2 px-4">
            <Icon name="search" size={19} className="flex-none text-ink-4" />
            <input
              placeholder="Search everything"
              aria-label="Search everything"
              className="w-full min-w-0 border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4"
            />
            <kbd className="hidden flex-none rounded border border-line-2 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-4 lg:block">
              ⌘K
            </kbd>
          </label>
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
                <div className="p-1.5">
                  {[
                    { icon: 'badge', label: 'Profile', to: '/profile' },
                    { icon: 'settings', label: 'Settings', to: '/settings' },
                    { icon: 'workspace_premium', label: 'Plan & billing', to: '/upgrade' },
                    { icon: 'help', label: 'Help & feedback', to: '/help' },
                  ].map((m) => (
                    <Link
                      key={m.to}
                      to={m.to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium text-ink-2 hover:bg-surface-3"
                    >
                      <Icon name={m.icon} size={18} className="text-ink-4" />
                      {m.label}
                    </Link>
                  ))}
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
        className={`fixed top-16 bottom-0 left-0 z-30 flex-col border-r border-line bg-surface transition-[width] ${
          mobileNav ? 'flex' : 'hidden'
        } md:flex`}
        style={{ width: expanded ? 236 : 72 }}
      >
        <nav aria-label="Sections" className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((g, gi) => (
            <div key={g.group || gi} className={gi > 0 ? 'mt-5' : ''}>
              {g.group && expanded ? (
                <p className="px-3 pb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-ink-5 uppercase">
                  {g.group}
                </p>
              ) : null}
              {g.group && !expanded ? <div className="mx-3 mb-2 h-px bg-line-3" /> : null}

              <ul className="flex flex-col gap-0.5">
                {g.items.map((i) => (
                  <li key={i.to}>
                    <NavLink
                      to={i.to}
                      title={i.name}
                      onClick={() => setMobileNav(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-[10px] ${
                          expanded ? 'px-3' : 'justify-center px-0'
                        } ${compact ? 'py-1.5' : 'py-2'} text-[14px] transition ${
                          isActive
                            ? 'bg-brand-tint font-semibold text-brand-deep'
                            : 'font-medium text-ink-2 hover:bg-surface-3'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            name={i.icon}
                            size={21}
                            className={`flex-none ${isActive ? 'text-brand' : 'text-ink-4'}`}
                          />
                          {expanded ? <span className="truncate">{i.name}</span> : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          {expanded && user?.plan === 'FREE' ? (
            <Link
              to="/upgrade"
              className="mb-2 block rounded-xl border border-line bg-surface-5 p-3 transition hover:border-line-2"
            >
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold">
                <Icon name="workspace_premium" size={15} className="text-accent-ink" />
                Free plan
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-ink-3">
                {usage
                  ? `${usage.projects.used}/${usage.projects.limit ?? '∞'} projects · ` +
                    `${usage.careerGoals.used}/${usage.careerGoals.limit ?? '∞'} goals · ` +
                    `${usage.literature.used}/${usage.literature.limit ?? '∞'} papers`
                  : 'Projects, goals and papers are capped'}
              </p>
              <span className="mt-2 block text-[12px] font-semibold text-brand-ink">
                Upgrade to PRO →
              </span>
            </Link>
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
              {expanded ? <span>{s.name}</span> : null}
            </Link>
          ))}
        </div>
      </aside>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <main className="with-sidebar pt-16 transition-[padding]">
        <div
          className="mx-auto flex max-w-[1180px] flex-col px-4 py-6 sm:px-6 sm:py-8"
          style={{ gap: compact ? 18 : 24 }}
        >
          {children}
        </div>
      </main>

      {/* Reserve the sidebar's width without a wrapper that fights the fixed
          positioning above. */}
      <style>{`@media (min-width:768px){main{padding-left:${expanded ? 236 : 72}px}}`}</style>
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
  MEETING_DECLINED: { icon: 'event_busy', tint: 'var(--color-surface-2)', fg: 'var(--color-ink-4)' },
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
                  {unread ? <span className="mt-1.5 size-2 flex-none rounded-full bg-brand" /> : null}
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
