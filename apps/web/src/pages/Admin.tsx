/**
 * Admin.
 *
 * Deliberately denser and plainer than the rest of the app — this is an
 * operator's tool, not a workspace. One thing it does not offer, because the
 * backend does not: changing a user's email. There is no password to change —
 * sign-in is delegated to Google.
 */
import { useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import {
  Card,
  FilterButton,
  PageHeader,
  Pill,
  SearchInput,
  Toolbar,
} from '../components/ui/Layout';
import { useToast } from '../components/ui/Toast';
import { useAdminReviews, useModerateReview } from '../lib/queries';

type Tab = 'overview' | 'users' | 'subscriptions' | 'reports' | 'reviews';

const STATS = [
  { label: 'Total users', value: '1,284', delta: '+38 this week', icon: 'group' },
  { label: 'PRO', value: '206', delta: '16.0% of users', icon: 'workspace_premium' },
  { label: 'Active this week', value: '742', delta: '57.8% of users', icon: 'bolt' },
  { label: 'Revenue, 30 days', value: '₹1,04,790', delta: '+12.4%', icon: 'payments' },
];

const CONTENT = [
  ['Projects', '3,912'],
  ['Deadlines', '11,504'],
  ['Literature', '28,771'],
  ['Ideas', '19,340'],
  ['Notes', '9,655'],
  ['Journal entries', '41,206'],
  ['Calendar events', '15,882'],
  ['Career goals', '2,104'],
];

const ADOPTION = [
  ['Deadlines', 88],
  ['Projects', 74],
  ['Literature', 61],
  ['Calendar', 57],
  ['Ideas', 52],
  ['Journal', 34],
  ['Career goals', 21],
] as const;

const USERS = [
  {
    name: 'A. Lindqvist',
    email: 'a.lindqvist@uni.se',
    plan: 'PRO',
    role: 'USER',
    joined: '14 Jan 2026',
    active: '2h ago',
  },
  {
    name: 'R. Mehta',
    email: 'r.mehta@uni.se',
    plan: 'PRO',
    role: 'USER',
    joined: '3 Feb 2026',
    active: 'Yesterday',
  },
  {
    name: 'K. Osei',
    email: 'k.osei@uni.se',
    plan: 'FREE',
    role: 'USER',
    joined: '21 Mar 2026',
    active: '4 days ago',
  },
  {
    name: 'Administrator',
    email: 'admin@skrivbok.local',
    plan: 'PRO',
    role: 'ADMIN',
    joined: '2 Sep 2026',
    active: 'Now',
  },
  {
    name: null,
    email: 'j.svensson@other.ac.uk',
    plan: 'FREE',
    role: 'USER',
    joined: '1 Sep 2026',
    active: 'Never',
  },
];

const REPORTS = [
  {
    type: 'BUG',
    title: 'Recurrence off by an hour',
    from: 'a.lindqvist@uni.se',
    status: 'OPEN',
    date: '2 Sep',
  },
  {
    type: 'FEATURE',
    title: 'iCal export for the calendar',
    from: 'r.mehta@uni.se',
    status: 'OPEN',
    date: '28 Aug',
  },
  {
    type: 'BUG',
    title: 'Tag filter drops the last tag',
    from: 'k.osei@uni.se',
    status: 'IN_PROGRESS',
    date: '26 Aug',
  },
  {
    type: 'FEEDBACK',
    title: 'Tag filters are excellent',
    from: '(deleted account)',
    status: 'RESOLVED',
    date: '20 Aug',
  },
];

const REPORT_TONE = {
  OPEN: 'brand',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
} as const;

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');

  // The review queue is real; the rest of this screen is still sample data.
  const pendingQueue = useAdminReviews({ status: 'PENDING', limit: 1 });
  const pendingReviews = pendingQueue.data?.pagination.total ?? 0;

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
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <Card key={s.label} className="!p-4">
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-3">
                  <Icon name={s.icon} size={15} className="text-ink-4" />
                  {s.label}
                </span>
                <span className="mt-1.5 block text-[26px] leading-none font-extrabold tabular">
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
                {CONTENT.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[13px] text-ink-3">{k}</dt>
                    <dd className="font-mono text-[13px] font-semibold tabular">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <h2 className="text-[15px] font-bold">Feature adoption</h2>
              <p className="mt-1 text-[12.5px] text-ink-3">
                Share of active users who have used each area.
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                {ADOPTION.map(([name, pct]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-24 flex-none text-[12.5px] text-ink-2">{name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-9 flex-none text-right font-mono text-[12px] text-ink-3 tabular">
                      {pct}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {tab === 'users' ? (
        <>
          <Toolbar>
            <SearchInput value={query} onChange={setQuery} placeholder="Search name or email" />
            <FilterButton label="Plan" />
            <FilterButton label="Role" />
          </Toolbar>

          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['User', 'Plan', 'Role', 'Joined', 'Last active', ''].map((h) => (
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
                  {USERS.map((u) => (
                    <tr
                      key={u.email}
                      className="border-b border-line last:border-b-0 hover:bg-surface-3"
                    >
                      <td className="px-5 py-3">
                        <p className="text-[13.5px] font-semibold">{u.name ?? '—'}</p>
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
                      <td className="px-5 py-3 text-[13px] text-ink-3 tabular">{u.joined}</td>
                      <td className="px-5 py-3 text-[13px] text-ink-3">{u.active}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          aria-label={`Actions for ${u.email}`}
                          className="grid size-8 place-items-center rounded-lg text-ink-4 hover:bg-surface-2"
                        >
                          <Icon name="more_horiz" size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-[12.5px] text-ink-3">
            Deleting a user permanently removes their content and requires typing{' '}
            <code>DELETE</code> to confirm. Email addresses cannot be changed from here.
          </p>
        </>
      ) : null}

      {tab === 'subscriptions' ? (
        <Card padded={false}>
          <div className="flex items-center justify-between p-5">
            <h2 className="text-[15px] font-bold">PRO subscriptions</h2>
            <span className="text-[12.5px] text-ink-3">Sorted by soonest to lapse</span>
          </div>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-line text-left">
                  {['User', 'Plan', 'Renews', 'Days left'].map((h) => (
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
                {[
                  ['r.mehta@uni.se', 'Monthly', '12 Sep 2026', 6],
                  ['a.lindqvist@uni.se', 'Yearly', '2 Mar 2027', 177],
                  ['admin@skrivbok.local', 'Comped', '—', null],
                ].map(([email, plan, renews, days]) => (
                  <tr key={email as string} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-3 text-[13.5px]">{email}</td>
                    <td className="px-5 py-3 text-[13px] text-ink-3">{plan}</td>
                    <td className="px-5 py-3 text-[13px] tabular">{renews}</td>
                    <td className="px-5 py-3">
                      {days === null ? (
                        <span className="text-[13px] text-ink-3">—</span>
                      ) : (
                        <Pill tone={(days as number) < 14 ? 'warning' : 'neutral'}>
                          {days} days
                        </Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === 'reports' ? (
        <Card padded={false}>
          <ul>
            {REPORTS.map((r) => (
              <li key={r.title} className="border-t border-line first:border-t-0">
                <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-semibold">{r.title}</h3>
                      <Pill tone={REPORT_TONE[r.status as keyof typeof REPORT_TONE]}>
                        {r.status.toLowerCase().replace('_', ' ')}
                      </Pill>
                      <Pill>{r.type.toLowerCase()}</Pill>
                    </div>
                    <p className="mt-1 text-[12.5px] text-ink-3">
                      {r.from} · {r.date}
                    </p>
                  </div>
                  {r.status === 'OPEN' || r.status === 'IN_PROGRESS' ? (
                    <div className="flex flex-none gap-2">
                      <Button variant="ghost" size="sm">
                        Dismiss
                      </Button>
                      <Button variant="secondary" size="sm" icon="check">
                        Resolve
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {tab === 'reviews' ? <ReviewQueue /> : null}
    </AppShell>
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
