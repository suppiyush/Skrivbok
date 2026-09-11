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
import { Textarea } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { ApiError, type AdminReport, type ReportStatus } from '../lib/api';
import { relative } from '../lib/format';
import {
  useAdminReports,
  useAdminReviews,
  useModerateReview,
  useUpdateReport,
} from '../lib/queries';

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

const REPORT_TONE = {
  OPEN: 'brand',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
} as const;

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');

  // Reviews and reports are real; Overview, Users and Subscriptions are still
  // sample data.
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

      {tab === 'reports' ? <ReportQueue /> : null}
      {tab === 'reviews' ? <ReviewQueue /> : null}
    </AppShell>
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
