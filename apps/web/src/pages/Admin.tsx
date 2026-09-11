/**
 * Admin.
 *
 * Deliberately denser and plainer than the rest of the app — this is an
 * operator's tool, not a workspace. One thing it does not offer, because the
 * backend does not: changing a user's email. There is no password to change —
 * sign-in is delegated to Google.
 */
import { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Card, PageHeader, Pagination, Pill, SearchInput, Toolbar } from '../components/ui/Layout';
import { FieldRow, Select, Textarea } from '../components/ui/Form';
import { Field } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { ApiError, type AdminReport, type AdminUser, type ReportStatus } from '../lib/api';
import { useAuth } from '../lib/auth';
import { longDate, relative, rupees } from '../lib/format';
import {
  useAdminAnalytics,
  useAdminReports,
  useAdminReviews,
  useAdminStats,
  useAdminSubscriptions,
  useAdminUserActions,
  useAdminUsers,
  useModerateReview,
  useUpdateReport,
} from '../lib/queries';

type Tab = 'overview' | 'users' | 'subscriptions' | 'reports' | 'reviews';

const REPORT_TONE = {
  OPEN: 'brand',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
} as const;

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');

  const pendingQueue = useAdminReviews({ status: 'PENDING', limit: 1 });
  const pendingReviews = pendingQueue.data?.pagination.total ?? 0;
  const openQueue = useAdminReports({ status: 'OPEN', limit: 1 });
  const openReports = openQueue.data?.statusCounts.OPEN ?? 0;

  return (
    <AppShell>
      <PageHeader
        title="Admin"
        description="Platform statistics, user management and report triage."
        actions={
          <Pill tone="danger" icon="shield_person">
            Administrator
          </Pill>
        }
      />

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {(['overview', 'users', 'subscriptions', 'reports', 'reviews'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px flex-none border-b-2 px-4 py-2.5 text-[14px] font-semibold capitalize transition ${
              tab === t
                ? 'border-brand text-brand-deep'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {t}
            {t === 'reviews' && pendingReviews > 0 ? (
              <span className="ml-1.5 rounded-full bg-danger-strong px-1.5 py-0.5 text-[10px] text-white">
                {pendingReviews}
              </span>
            ) : null}
            {t === 'reports' && openReports > 0 ? (
              <span className="ml-1.5 rounded-full bg-danger-strong px-1.5 py-0.5 text-[10px] text-white">
                {openReports}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <Overview /> : null}
      {tab === 'users' ? <UsersTab /> : null}
      {tab === 'subscriptions' ? <SubscriptionsTab /> : null}
      {tab === 'reports' ? <ReportQueue /> : null}
      {tab === 'reviews' ? <ReviewQueue /> : null}
    </AppShell>
  );
}

/* ── Overview ─────────────────────────────────────────────────────────────── */

/** Feature keys from the analytics, as the sections are named to users. */
const FEATURE_NAME: Record<string, string> = {
  projects: 'Projects',
  ideas: 'Ideas',
  notes: 'Notes',
  journal: 'Journal',
  deadlines: 'Deadlines',
  literature: 'Literature',
  careerGoals: 'Career goals',
  calendar: 'Calendar',
};

const CONTENT_NAME: Record<string, string> = {
  projects: 'Projects',
  ideas: 'Ideas',
  notes: 'Notes',
  journalEntries: 'Journal entries',
  deadlines: 'Deadlines',
  futureWork: 'Future work',
  literature: 'Literature',
  careerGoals: 'Career goals',
  calendarEvents: 'Calendar events',
  meetingRequests: 'Meeting requests',
  openReports: 'Open reports',
};

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));
const n = (value: number) => value.toLocaleString();

/**
 * The headline numbers, from the database as it is now.
 *
 * Every figure here is a count or a sum the server computed at request time.
 * "Active this week" is anyone whose last sign-in was in the past seven days
 * — a session start, not activity as such — and the revenue figure is the
 * captured payments of the last thirty days, summed from the daily series.
 */
function Overview() {
  const stats = useAdminStats();
  const analytics = useAdminAnalytics(30);

  if (stats.isPending || analytics.isPending) {
    return (
      <div className="shimmer grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} h={110} radius={16} />
        ))}
      </div>
    );
  }

  if (!stats.data || !analytics.data) {
    return (
      <Card className="grid place-items-center gap-2 py-14 text-center">
        <Icon name="cloud_off" size={28} className="text-danger" />
        <p className="text-[14px] text-ink-3">The statistics could not be loaded.</p>
      </Card>
    );
  }

  const { users, content, engagement } = stats.data;
  const revenue30 = analytics.data.revenue.reduce((sum, d) => sum + d.paise, 0);
  const signups30 = analytics.data.signups.reduce((sum, d) => sum + d.count, 0);

  const headline = [
    {
      label: 'Total users',
      value: n(users.total),
      delta: `+${n(users.newThisWeek)} this week · ${n(signups30)} in 30 days`,
      icon: 'group',
    },
    {
      label: 'PRO',
      value: n(users.pro),
      delta: `${pct(users.pro, users.total)}% of users · ${n(users.admins)} admin${users.admins === 1 ? '' : 's'}`,
      icon: 'workspace_premium',
    },
    {
      label: 'Active this week',
      value: n(users.activeThisWeek),
      delta: `${pct(users.activeThisWeek, users.total)}% of users · ${n(engagement.neverLoggedIn)} never signed in`,
      icon: 'bolt',
    },
    {
      label: 'Revenue, 30 days',
      value: rupees(revenue30),
      delta: `${rupees(stats.data.revenue.capturedPaise)} all time · ${n(stats.data.revenue.capturedCount)} payments`,
      icon: 'payments',
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {headline.map((s) => (
          <Card key={s.label}>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-ink-3">{s.label}</span>
              <Icon name={s.icon} size={18} className="text-ink-4" />
            </div>
            <span className="mt-2 block text-[26px] leading-none font-extrabold tracking-[-0.02em] tabular">
              {s.value}
            </span>
            <span className="mt-1.5 block text-[11.5px] text-ink-3">{s.delta}</span>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="text-[15px] font-bold">Content across the platform</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
            {Object.entries(content).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-ink-3">{CONTENT_NAME[k] ?? k}</dt>
                <dd className="font-mono text-[13px] font-semibold tabular">{n(v)}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <h2 className="text-[15px] font-bold">Feature adoption</h2>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Share of all {n(users.total)} users who have used each area at least once.
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            {analytics.data.featureAdoption.map((f) => {
              const share = pct(f.users, users.total);
              return (
                <div key={f.feature} className="flex items-center gap-3">
                  <span className="w-24 flex-none text-[12.5px] text-ink-2">
                    {FEATURE_NAME[f.feature] ?? f.feature}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${share}%` }}
                    />
                  </span>
                  <span className="w-16 flex-none text-right font-mono text-[12px] text-ink-3 tabular">
                    {share}% · {n(f.users)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

/* ── Users ────────────────────────────────────────────────────────────────── */

function UsersTab() {
  const { user: me } = useAuth();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState<'' | 'FREE' | 'PRO'>('');
  const [role, setRole] = useState<'' | 'USER' | 'ADMIN'>('');
  const [page, setPage] = useState(1);
  const [managing, setManaging] = useState<AdminUser | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [input]);

  const list = useAdminUsers({
    page,
    limit: 25,
    sort: 'newest',
    ...(search ? { search } : {}),
    ...(plan ? { plan } : {}),
    ...(role ? { role } : {}),
  });
  const users = list.data?.data ?? [];
  const rowsShown = users.length;

  return (
    <>
      <Toolbar>
        <SearchInput value={input} onChange={setInput} placeholder="Search name or email" />
        <Chips
          value={plan}
          onChange={(v) => {
            setPlan(v as typeof plan);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Any plan' },
            { value: 'FREE', label: 'Free' },
            { value: 'PRO', label: 'PRO' },
          ]}
        />
        <Chips
          value={role}
          onChange={(v) => {
            setRole(v as typeof role);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Any role' },
            { value: 'USER', label: 'Users' },
            { value: 'ADMIN', label: 'Admins' },
          ]}
        />
        {list.data ? (
          <span className="ml-auto text-[12.5px] text-ink-3 tabular">
            {n(list.data.pagination.total)}{' '}
            {list.data.pagination.total === 1 ? 'account' : 'accounts'}
          </span>
        ) : null}
      </Toolbar>

      {list.isPending ? (
        <p className="py-10 text-center text-[13.5px] text-ink-3">Loading…</p>
      ) : users.length === 0 ? (
        <Card className="grid place-items-center gap-2 py-14 text-center">
          <Icon name="person_off" size={28} className="text-ink-5" />
          <p className="text-[14px] text-ink-3">No accounts match.</p>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-line text-left">
                  {['User', 'Plan', 'Role', 'Joined', 'Last sign-in', 'Content', ''].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-[11.5px] font-bold text-ink-4 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-line last:border-b-0 hover:bg-surface-3"
                  >
                    <td className="px-5 py-3">
                      <p className="text-[13.5px] font-semibold">
                        {u.name ?? '—'}
                        {u.id === me?.id ? (
                          <span className="ml-1.5 text-[11px] font-normal text-ink-4">(you)</span>
                        ) : null}
                      </p>
                      <p className="text-[12.5px] text-ink-3">{u.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={u.plan === 'PRO' ? 'brand' : 'neutral'}>{u.plan}</Pill>
                    </td>
                    <td className="px-5 py-3">
                      {u.role === 'ADMIN' ? (
                        <Pill tone="danger">admin</Pill>
                      ) : (
                        <span className="text-[13px] text-ink-3">user</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-ink-3 tabular">
                      {longDate(u.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-ink-3">
                      {u.lastLoginAt ? relative(u.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] text-ink-3 tabular">
                      {u._count.ownedProjects} projects · {u._count.ideas} ideas
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => setManaging(u)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.data ? (
            <div className="border-t border-line px-5 py-3">
              <Pagination
                page={list.data.pagination.page}
                totalPages={list.data.pagination.totalPages}
                total={list.data.pagination.total}
                shown={rowsShown}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            </div>
          ) : null}
        </Card>
      )}

      {managing ? (
        <ManageUserDialog
          user={managing}
          isSelf={managing.id === me?.id}
          onClose={() => setManaging(null)}
        />
      ) : null}
    </>
  );
}

/**
 * One account, and what an admin can do to it.
 *
 * Role and plan are the two switches; a subscription end date is the manual
 * override for comping an account or correcting a failed webhook. Signing
 * out everywhere and deletion are separate, and deletion is typed — the
 * server refuses it without the word, so a stray click cannot remove an
 * account. Neither is offered on the admin's own account.
 */
function ManageUserDialog({
  user,
  isSelf,
  onClose,
}: {
  user: AdminUser;
  isSelf: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { update, remove, revokeSessions } = useAdminUserActions();
  const [role, setRole] = useState<'USER' | 'ADMIN'>(user.role);
  const [plan, setPlan] = useState<'FREE' | 'PRO'>(user.plan);
  const [endsAt, setEndsAt] = useState(user.subscriptionEndsAt?.slice(0, 10) ?? '');
  const [confirm, setConfirm] = useState('');

  const changed =
    role !== user.role ||
    plan !== user.plan ||
    endsAt !== (user.subscriptionEndsAt?.slice(0, 10) ?? '');
  const busy = update.isPending || remove.isPending || revokeSessions.isPending;

  async function save() {
    try {
      await update.mutateAsync({
        id: user.id,
        ...(role !== user.role ? { role } : {}),
        ...(plan !== user.plan ? { plan } : {}),
        ...(endsAt !== (user.subscriptionEndsAt?.slice(0, 10) ?? '')
          ? { subscriptionEndsAt: endsAt ? new Date(`${endsAt}T00:00:00Z`).toISOString() : null }
          : {}),
      });
      toast.success('Account updated');
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not update that account.');
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={user.name ?? user.email}
      description={user.email}
      busy={busy}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button
            type="submit"
            variant="brand"
            size="sm"
            loading={update.isPending}
            disabled={!changed}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FieldRow>
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            options={[
              { value: 'USER', label: 'User' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
            disabled={isSelf}
            hint={isSelf ? 'You cannot change your own role.' : undefined}
          />
          <Select
            label="Plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value as typeof plan)}
            options={[
              { value: 'FREE', label: 'Free' },
              { value: 'PRO', label: 'PRO' },
            ]}
          />
        </FieldRow>
        <Field
          label="Subscription ends"
          type="date"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          hint="Leave empty for no end date. A manual override — Razorpay sets this on its own."
        />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px]">
          <dt className="text-ink-3">Joined</dt>
          <dd className="text-right tabular">{longDate(user.createdAt)}</dd>
          <dt className="text-ink-3">Last sign-in</dt>
          <dd className="text-right">{user.lastLoginAt ? relative(user.lastLoginAt) : 'Never'}</dd>
          <dt className="text-ink-3">Time zone</dt>
          <dd className="text-right">{user.timezone}</dd>
          <dt className="text-ink-3">Owns</dt>
          <dd className="text-right tabular">
            {user._count.ownedProjects} projects · {user._count.ideas} ideas
          </dd>
        </dl>

        {!isSelf ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-ink-2">Sign this account out of every device.</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={revokeSessions.isPending}
                onClick={() =>
                  void revokeSessions
                    .mutateAsync(user.id)
                    .then((r) =>
                      toast.success(
                        `Signed out of ${r.revoked} session${r.revoked === 1 ? '' : 's'}`,
                      ),
                    )
                    .catch(() => toast.error('Could not revoke the sessions.'))
                }
              >
                Sign out everywhere
              </Button>
            </div>

            <div className="rounded-xl border border-danger/25 bg-danger-tint p-3.5">
              <p className="text-[13px] font-semibold text-danger-ink">Delete this account</p>
              <p className="mt-0.5 text-[12.5px] text-danger-ink/80">
                Everything they made goes with it. Type DELETE to confirm.
              </p>
              <div className="mt-2.5 flex gap-2">
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="h-9 min-w-0 flex-1 rounded-[9px] border border-danger/30 bg-surface px-3 font-mono text-[13px] outline-none focus:border-danger"
                />
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={confirm !== 'DELETE'}
                  loading={remove.isPending}
                  onClick={() =>
                    void remove
                      .mutateAsync(user.id)
                      .then(() => {
                        toast.success('Account deleted');
                        onClose();
                      })
                      .catch((error: unknown) =>
                        toast.error(
                          error instanceof ApiError
                            ? error.message
                            : 'Could not delete that account.',
                        ),
                      )
                  }
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/* ── Subscriptions ────────────────────────────────────────────────────────── */

function SubscriptionsTab() {
  const [page, setPage] = useState(1);
  const list = useAdminSubscriptions({ page, limit: 25 });
  const rows = list.data?.data ?? [];
  const rowsShown = rows.length;

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between p-5">
        <div>
          <h2 className="text-[15px] font-bold">PRO subscriptions</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            {list.data ? `${n(list.data.pagination.total)} on PRO` : ''} · soonest to lapse first
          </p>
        </div>
      </div>

      {list.isPending ? (
        <p className="border-t border-line py-10 text-center text-[13.5px] text-ink-3">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="border-t border-line py-10 text-center text-[13.5px] text-ink-3">
          Nobody is on PRO yet.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-line text-left">
                {['User', 'Since', 'Ends', 'Days left'].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-[11.5px] font-bold text-ink-4 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-3">
                    <p className="text-[13.5px] font-semibold">{r.name ?? '—'}</p>
                    <p className="text-[12.5px] text-ink-3">{r.email}</p>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-ink-3 tabular">
                    {longDate(r.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-[13px] tabular">
                    {r.subscriptionEndsAt ? longDate(r.subscriptionEndsAt) : 'No end date'}
                  </td>
                  <td className="px-5 py-3">
                    {r.daysRemaining === null ? (
                      <span className="text-[13px] text-ink-3">—</span>
                    ) : r.isExpired ? (
                      <Pill tone="danger">expired</Pill>
                    ) : (
                      <Pill tone={r.daysRemaining < 14 ? 'warning' : 'neutral'}>
                        {r.daysRemaining} {r.daysRemaining === 1 ? 'day' : 'days'}
                      </Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.data ? (
            <div className="border-t border-line px-5 py-3">
              <Pagination
                page={list.data.pagination.page}
                totalPages={list.data.pagination.totalPages}
                total={list.data.pagination.total}
                shown={rowsShown}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/** A row of toggle chips, one on at a time. */
function Chips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-none rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`press rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
            value === o.value ? 'bg-brand-tint text-brand-deep' : 'text-ink-3 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Report triage ────────────────────────────────────────────────────────── */

const REPORT_STATUSES: { value: ReportStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

const REPORT_TYPES = [
  { value: 'BUG', label: 'Bug report' },
  { value: 'FEEDBACK', label: 'General feedback' },
  { value: 'FEATURE', label: 'Feature request' },
];

/**
 * Where reports land, and where they are answered.
 *
 * A report is a person telling us something went wrong or could be better.
 * Every one is answered from here: closing it — resolved or dismissed — asks
 * for a note the author sees on their Help page, so "closed" is never
 * silent. Taking one on marks it in progress, so two admins do not start on
 * the same one.
 */
function ReportQueue() {
  const toast = useToast();
  const [status, setStatus] = useState<ReportStatus>('OPEN');
  const [type, setType] = useState<string>('');
  const [closing, setClosing] = useState<{ report: AdminReport; to: ReportStatus } | null>(null);
  const [note, setNote] = useState('');

  const list = useAdminReports({ status, ...(type ? { type } : {}), limit: 50, sort: 'newest' });
  const update = useUpdateReport();

  const reports = list.data?.data ?? [];
  const counts = list.data?.statusCounts;

  function move(id: string, to: ReportStatus, resolution?: string | null) {
    void update
      .mutateAsync({ id, status: to, ...(resolution !== undefined ? { resolution } : {}) })
      .then(() => {
        toast.success(
          to === 'IN_PROGRESS'
            ? 'Taken on'
            : to === 'RESOLVED'
              ? 'Resolved — the author can see your note'
              : to === 'DISMISSED'
                ? 'Dismissed'
                : 'Reopened',
        );
        setClosing(null);
        setNote('');
      })
      .catch((error: unknown) =>
        toast.error(error instanceof ApiError ? error.message : 'Could not update that report.'),
      );
  }

  return (
    <>
      <Toolbar>
        <div className="flex flex-none rounded-xl border border-line bg-surface p-1">
          {REPORT_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={`press flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                status === s.value ? 'bg-brand-tint text-brand-deep' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {s.label}
              {counts ? (
                <span className="text-[11.5px] font-bold opacity-60 tabular">
                  {counts[s.value]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex flex-none rounded-xl border border-line bg-surface p-1">
          {[{ value: '', label: 'All types' }, ...REPORT_TYPES].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`press rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                type === t.value ? 'bg-brand-tint text-brand-deep' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Toolbar>

      {list.isPending ? (
        <p className="py-10 text-center text-[13.5px] text-ink-3">Loading…</p>
      ) : reports.length === 0 ? (
        <Card className="grid place-items-center gap-2 py-14 text-center">
          <Icon name="inbox" size={28} className="text-ink-5" />
          <p className="text-[14px] text-ink-3">
            {status === 'OPEN'
              ? 'Nothing open. Good.'
              : `No ${status.toLowerCase().replace('_', ' ')} reports.`}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => {
            const open = r.status === 'OPEN' || r.status === 'IN_PROGRESS';
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14.5px] font-bold">
                        {r.title ?? REPORT_TYPES.find((t) => t.value === r.type)?.label ?? r.type}
                      </h3>
                      <Pill tone={REPORT_TONE[r.status as keyof typeof REPORT_TONE]}>
                        {r.status.toLowerCase().replace('_', ' ')}
                      </Pill>
                      <Pill>{REPORT_TYPES.find((t) => t.value === r.type)?.label ?? r.type}</Pill>
                    </div>
                    <p className="mt-1 text-[12.5px] text-ink-3">
                      {r.user
                        ? r.user.name
                          ? `${r.user.name} · ${r.user.email}`
                          : r.user.email
                        : 'Deleted account'}
                      {' · '}
                      {relative(r.createdAt)}
                      {r.featurePage ? ` · ${r.featurePage}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-none flex-wrap gap-2">
                    {r.status === 'OPEN' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="play_arrow"
                        disabled={update.isPending}
                        onClick={() => move(r.id, 'IN_PROGRESS')}
                      >
                        Take on
                      </Button>
                    ) : null}
                    {open ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={update.isPending}
                          onClick={() => setClosing({ report: r, to: 'DISMISSED' })}
                        >
                          Dismiss
                        </Button>
                        <Button
                          variant="brand"
                          size="sm"
                          icon="check"
                          disabled={update.isPending}
                          onClick={() => setClosing({ report: r, to: 'RESOLVED' })}
                        >
                          Resolve
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="undo"
                        disabled={update.isPending}
                        onClick={() => move(r.id, 'OPEN', null)}
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>

                <p className="mt-3 max-w-[80ch] text-[14px] leading-[1.7] whitespace-pre-wrap text-ink-2">
                  {r.description}
                </p>

                {r.resolution ? (
                  <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-3">
                    Note to author: {r.resolution}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {/* Closing asks for a note. It is what the author reads on their Help
          page, and the one thing that makes "resolved" mean something. */}
      <Modal
        open={closing !== null}
        onClose={() => {
          setClosing(null);
          setNote('');
        }}
        title={closing?.to === 'RESOLVED' ? 'Resolve this report' : 'Dismiss this report'}
        description={
          closing?.to === 'RESOLVED'
            ? 'Say what was done. The author sees this on their Help page.'
            : 'Say why. The author sees this on their Help page.'
        }
        busy={update.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          if (closing) move(closing.report.id, closing.to, note.trim() || null);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setClosing(null);
                setNote('');
              }}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={closing?.to === 'RESOLVED' ? 'brand' : 'caution'}
              size="sm"
              loading={update.isPending}
            >
              {closing?.to === 'RESOLVED' ? 'Mark resolved' : 'Dismiss'}
            </Button>
          </>
        }
      >
        {closing ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
              {closing.report.title ?? closing.report.type} —{' '}
              {closing.report.description.slice(0, 200)}
              {closing.report.description.length > 200 ? '…' : ''}
            </p>
            <Textarea
              label="Note to the author"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                closing.to === 'RESOLVED'
                  ? 'Fixed in today’s release — thank you for the clear steps.'
                  : 'Not something we plan to change, because…'
              }
              autoFocus
            />
          </div>
        ) : null}
      </Modal>
    </>
  );
}

/* ── Review moderation ────────────────────────────────────────────────────── */

/**
 * The approval queue.
 *
 * Nothing a user writes reaches the public homepage until it is approved here.
 * Rejections carry a note back to the author, so "not published" is never
 * silent — they can see why and rewrite it.
 */
function ReviewQueue() {
  const toast = useToast();
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const list = useAdminReviews({ status, limit: 25 });
  const moderate = useModerateReview();

  const reviews = list.data?.data ?? [];

  const act = (id: string, next: 'APPROVED' | 'REJECTED') => {
    const adminNote =
      next === 'REJECTED'
        ? (window.prompt('Why is this not being published? The author will see this note.') ?? '')
        : '';

    void moderate
      .mutateAsync({ id, status: next, adminNote: adminNote || null })
      .then(() =>
        toast.success(next === 'APPROVED' ? 'Published to the homepage' : 'Review rejected'),
      )
      .catch(() => toast.error('Could not update that review.'));
  };

  return (
    <>
      <Toolbar>
        <div className="flex flex-none rounded-xl border border-line bg-surface p-1">
          {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`press rounded-lg px-3 py-1.5 text-[13px] font-semibold capitalize transition ${
                status === s ? 'bg-brand-tint text-brand-deep' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      </Toolbar>

      {list.isPending ? (
        <p className="py-10 text-center text-[13.5px] text-ink-3">Loading…</p>
      ) : reviews.length === 0 ? (
        <Card className="grid place-items-center gap-2 py-14 text-center">
          <Icon name="reviews" size={28} className="text-ink-5" />
          <p className="text-[14px] text-ink-3">
            {status === 'PENDING'
              ? 'Nothing waiting for approval.'
              : `No ${status.toLowerCase()} reviews.`}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-bold">
                      {review.user.name ?? review.user.email}
                    </span>
                    <span className="text-[12.5px] text-ink-3">{review.role ?? '—'}</span>
                    <span className="flex gap-0.5" aria-label={`Rated ${review.rating} out of 5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Icon
                          key={i}
                          name="star"
                          size={14}
                          className={i < review.rating ? 'text-accent' : 'text-line-3'}
                        />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-4">{review.user.email}</p>
                </div>

                {status === 'PENDING' ? (
                  <div className="flex flex-none gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={moderate.isPending}
                      onClick={() => act(review.id, 'REJECTED')}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon="check"
                      disabled={moderate.isPending}
                      onClick={() => act(review.id, 'APPROVED')}
                    >
                      Approve
                    </Button>
                  </div>
                ) : (
                  <Pill tone={review.status === 'APPROVED' ? 'success' : 'danger'}>
                    {review.status.toLowerCase()}
                  </Pill>
                )}
              </div>

              <blockquote className="mt-3 max-w-[80ch] text-[14px] leading-[1.7] text-ink-2">
                “{review.body}”
              </blockquote>

              {review.adminNote ? (
                <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-3">
                  Note to author: {review.adminNote}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
