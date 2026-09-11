/**
 * The account screens: Upgrade, Notifications, Help, Settings.
 *
 * They share a file because they share a shape — a heading, a small number of
 * cards, and a form. The profile used to be here too, and left when it grew
 * into an eleven-section record with a résumé printed from it; it is in
 * `Profile.tsx` and `Resume.tsx` now.
 */
import { useState, type FormEvent } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { FieldRow, Select, Textarea } from '../components/ui/Form';
import { Icon } from '../components/ui/Icon';
import { Card, PageHeader, Pagination, Pill, Toolbar } from '../components/ui/Layout';
import { Reveal } from '../components/ui/Motion';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { ApiError, auth, type LimitStatus } from '../lib/api';
import { dateTime, humanise, longDate, relative, rupees } from '../lib/format';
import { useAuth } from '../lib/auth';
import {
  useCreateReport,
  useNotificationActions,
  useNotifications,
  usePayments,
  usePlans,
  useReports,
  useSubscription,
  useUsage,
} from '../lib/queries';

/* ── Upgrade ──────────────────────────────────────────────────────────────── */

export function Upgrade() {
  const { user } = useAuth();
  const subscription = useSubscription();
  const usage = useUsage();
  const plans = usePlans();
  const payments = usePayments({ limit: 10 });
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');

  const pro = (subscription.data?.plan ?? user?.plan) === 'PRO';
  const billingEnabled = subscription.data?.billingEnabled ?? false;
  const price = plans.data?.plans.find((p) => p.id === cycle);

  /**
   * The three capped resources, one card each.
   *
   * Icons and tints are the ones the dashboard already gives these features,
   * so a card here is recognisably the same thing as the card there.
   */
  const meters = [
    {
      name: 'Projects',
      icon: 'folder_open',
      tint: '#fdece0',
      fg: '#c2650b',
      status: usage.data?.projects,
    },
    {
      name: 'Career goals',
      icon: 'stairs',
      tint: '#f1e9fb',
      fg: '#7c4dbd',
      status: usage.data?.careerGoals,
    },
    {
      name: 'Literature',
      icon: 'menu_book',
      tint: '#e8eaff',
      fg: '#4f5bd5',
      status: usage.data?.literature,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Plan and billing"
        description="Unlock unlimited potential for your research and projects"
      />

      {pro ? (
        <Alert tone="success" title="You are on PRO">
          {subscription.data?.subscriptionEndsAt
            ? `Your subscription runs until ${longDate(subscription.data.subscriptionEndsAt)}.`
            : 'Every cap is lifted.'}
        </Alert>
      ) : null}

      <section>
        <h2 className="text-[11px] font-bold tracking-[0.1em] text-ink-5 uppercase">Your usage</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {meters.map((meter, i) => (
            <Reveal key={meter.name} delay={i * 70}>
              <UsageCard {...meter} />
            </Reveal>
          ))}
        </div>
      </section>

      {!pro ? (
        <>
          <div className="flex justify-center">
            <div className="flex rounded-xl border border-line bg-surface p-1">
              {(['MONTHLY', 'YEARLY'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={`press rounded-lg px-4 py-1.5 text-[13px] font-semibold capitalize transition ${
                    cycle === c ? 'bg-brand-tint text-brand-deep' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {c.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Narrowed to a pair of portrait columns rather than spanning the
              full page: at the container's full width these were two wide
              slabs, which reads as two panels of settings rather than as a
              choice between two plans. */}
          <div className="mx-auto grid w-full max-w-[760px] gap-4 sm:grid-cols-2">
            <Reveal className="h-full">
              <Card className="flex h-full min-h-[456px] flex-col border-brand">
                <h2 className="text-[16px] font-bold">Free</h2>
                <p className="mt-3 text-[34px] leading-none font-extrabold tracking-[-0.03em]">
                  ₹0
                </p>
                <p className="mt-2 text-[13px] text-ink-3">Everything you need to start</p>
                <PlanFeatures
                  items={[
                    'Up to 5 projects, goals and papers',
                    'Unlimited ideas, notes and journal',
                    'Unlimited deadlines and events',
                    'Full collaboration and sharing',
                    'Email reminders in your timezone',
                  ]}
                />

                {/* The same footer slot PRO uses, so both cards end on a
                    control at a shared baseline rather than one of them simply
                    running out of content. It also states which plan you are
                    on, which is what the badge beside the title used to do. */}
                <div className="mt-auto pt-6">
                  <Button variant="secondary" size="lg" className="w-full" disabled>
                    Your current plan
                  </Button>
                </div>
              </Card>
            </Reveal>

            <Reveal delay={90} className="h-full">
              <Card className="flex h-full min-h-[456px] flex-col">
                <h2 className="text-[16px] font-bold">PRO</h2>
                <p className="mt-3 text-[34px] leading-none font-extrabold tracking-[-0.03em]">
                  {price ? price.amountDisplay.replace(/^INR\s*/, '₹') : '—'}
                  <span className="text-[14px] font-semibold text-ink-3">
                    /{cycle === 'YEARLY' ? 'year' : 'month'}
                  </span>
                </p>
                <p className="mt-2 text-[13px] text-ink-3">
                  {price ? `${rupees(price.amountPaise)} billed ${cycle.toLowerCase()}` : ''}
                </p>
                <PlanFeatures
                  items={[
                    'Everything in Free',
                    'Unlimited projects',
                    'Unlimited career goals',
                    'Unlimited literature entries',
                  ]}
                />

                {/* `mt-auto` pins the action to the foot of the card, so it
                    sits level with the bottom of the Free card beside it
                    however the two feature lists differ in length. */}
                <div className="mt-auto pt-6">
                  <Button variant="accent" size="lg" className="w-full" disabled={!billingEnabled}>
                    {billingEnabled ? 'Upgrade to PRO' : 'Payments are not configured yet'}
                  </Button>
                  {!billingEnabled ? (
                    <p className="mt-2 text-center text-[12px] text-ink-3">
                      Checkout opens once the payment provider keys are set on the server.
                    </p>
                  ) : null}
                </div>
              </Card>
            </Reveal>
          </div>
        </>
      ) : null}

      <Reveal>
        <Card padded={false}>
          <h2 className="px-5 py-4 text-[15px] font-bold sm:px-6">Payment history</h2>
          {payments.isPending ? (
            <div className="shimmer px-5 pb-5">
              <Skeleton h={120} radius={12} />
            </div>
          ) : (payments.data?.data.length ?? 0) === 0 ? (
            <p className="border-t border-line px-5 py-8 text-center text-[13.5px] text-ink-3 sm:px-6">
              No payments yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="border-y border-line bg-surface-5 text-left">
                    {['Date', 'Plan', 'Amount', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-[11.5px] font-bold tracking-[0.06em] text-ink-4 uppercase sm:px-6"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.data?.data.map((payment) => (
                    <tr key={payment.id} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3 text-[13.5px] sm:px-6">
                        {longDate(payment.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-[13.5px] sm:px-6">
                        {payment.plan ? humanise(payment.plan) : '—'}
                      </td>
                      <td className="px-5 py-3 font-mono text-[13px] tabular sm:px-6">
                        {rupees(payment.amountPaise)}
                      </td>
                      <td className="px-5 py-3 sm:px-6">
                        <Pill tone={payment.status === 'CAPTURED' ? 'success' : 'danger'}>
                          {payment.status.toLowerCase()}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Reveal>
    </AppShell>
  );
}

/**
 * One capped resource, as a card.
 *
 * The figure is the point of this screen — it is what tells someone whether
 * PRO is worth paying for — so it is set at headline size rather than as a
 * label beside a bar. The bar stays underneath as the shape of the same fact.
 *
 * Nothing is invented while the numbers are in flight: the figure shows an em
 * dash rather than a zero, because "you have none" and "we have not asked yet"
 * are different things, and one of them is discouraging.
 */
function UsageCard({
  name,
  icon,
  tint,
  fg,
  status,
}: {
  name: string;
  icon: string;
  tint: string;
  fg: string;
  status: LimitStatus | undefined;
}) {
  const unlimited = status?.limited === false || status?.limit === null;
  const full = status?.remaining === 0;
  const pct = status?.limit ? Math.min(100, (status.used / status.limit) * 100) : 100;

  return (
    <Card className="h-full">
      <div className="flex items-center gap-3">
        <span
          className="grid size-10 flex-none place-items-center rounded-[12px]"
          style={{ background: tint }}
        >
          <Icon name={icon} size={20} style={{ color: fg }} />
        </span>
        <h3 className="text-[14px] font-bold">{name}</h3>
      </div>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-[38px] leading-none font-extrabold tracking-[-0.03em] tabular">
          {status ? status.used : '—'}
        </span>
        <span className="text-[15px] font-semibold text-ink-4">
          / {unlimited ? '∞' : (status?.limit ?? '—')}
        </span>
      </p>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${status ? pct : 0}%`,
            background: full ? 'var(--color-warn)' : 'var(--color-brand)',
          }}
        />
      </div>

      <p className="mt-2.5 text-[12.5px] text-ink-3">
        {!status
          ? 'Checking your usage'
          : unlimited
            ? 'Unlimited on PRO'
            : full
              ? 'Limit reached — PRO lifts this'
              : `${status.remaining} more on the free plan`}
      </p>
    </Card>
  );
}

function PlanFeatures({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
          {/* A filled disc rather than a bare tick: at this size the glyph on
              its own is a thin scratch, and the deep coral needs a solid shape
              to read as the brand rather than as a stray mark. */}
          <span className="mt-px grid size-[18px] flex-none place-items-center rounded-full bg-brand-deep">
            <Icon name="check" size={12} className="text-white" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ── Notifications ────────────────────────────────────────────────────────── */

export function Notifications() {
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const list = useNotifications({
    page,
    limit: 25,
    ...(unreadOnly ? { unreadOnly: 'true' } : {}),
  });
  const { markAllRead, markRead, remove, clearRead } = useNotificationActions();

  const items = list.data?.data ?? [];
  const meta = list.data?.pagination;

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        description="What happened while you were away."
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={clearRead.isPending}
              onClick={() =>
                void clearRead
                  .mutateAsync()
                  .then((r) => toast.success(`${r.deleted} cleared`))
                  .catch(() => toast.error('Could not clear those.'))
              }
            >
              Clear read
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="done_all"
              disabled={markAllRead.isPending}
              onClick={() =>
                void markAllRead
                  .mutateAsync()
                  .then(() => toast.success('All marked read'))
                  .catch(() => toast.error('Could not mark them read.'))
              }
            >
              Mark all read
            </Button>
          </>
        }
      />

      <Toolbar>
        <div className="flex flex-none rounded-xl border border-line bg-surface p-1">
          {[
            { value: false, label: 'All' },
            { value: true, label: 'Unread' },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => {
                setUnreadOnly(option.value);
                setPage(1);
              }}
              className={`press rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                unreadOnly === option.value
                  ? 'bg-brand-tint text-brand-deep'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Toolbar>

      {list.isPending ? (
        <div className="shimmer flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} h={72} radius={14} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="notifications_off" title="Nothing here">
          Reminders, meeting requests and project invitations all arrive on this screen.
        </EmptyState>
      ) : (
        <>
          <Reveal>
            <Card padded={false} className="overflow-hidden">
              <ul>
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="row-hover flex items-start gap-3 border-t border-line px-5 py-3.5 first:border-t-0 hover:bg-surface-3"
                    style={{
                      background: item.readAt === null ? 'var(--color-brand-tint-2)' : undefined,
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">{item.title}</span>
                      {item.message ? (
                        <span className="mt-0.5 block text-[13px] text-ink-3">{item.message}</span>
                      ) : null}
                      <span className="mt-1 block font-mono text-[11px] text-ink-4">
                        {relative(item.createdAt)}
                      </span>
                    </span>

                    {item.readAt === null ? (
                      <button
                        type="button"
                        onClick={() => markRead.mutate([item.id])}
                        className="press flex-none text-[12.5px] font-semibold text-brand-ink"
                      >
                        Mark read
                      </button>
                    ) : null}

                    <button
                      type="button"
                      aria-label="Delete notification"
                      onClick={() => remove.mutate(item.id)}
                      className="press grid size-8 flex-none place-items-center rounded-lg text-ink-4 transition hover:bg-surface-2 hover:text-danger"
                    >
                      <Icon name="close" size={17} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>

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
    </AppShell>
  );
}

/* ── Help ─────────────────────────────────────────────────────────────────── */

type ReportType = 'BUG' | 'FEEDBACK' | 'FEATURE';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'BUG', label: 'Bug report' },
  { value: 'FEEDBACK', label: 'General feedback' },
  { value: 'FEATURE', label: 'Feature request' },
];

/**
 * The wording of the description field, per type.
 *
 * Asking "what happened?" of someone requesting a feature is asking about the
 * past when they are describing a future, and the answers come back shaped by
 * the question. Display only — the value sent as `type` is unchanged.
 */
const REPORT_COPY: Record<ReportType, { label: string; placeholder: string }> = {
  BUG: {
    label: 'What happened?',
    placeholder: 'What you expected, and what happened instead.',
  },
  FEEDBACK: {
    label: 'What would you like us to know?',
    placeholder: 'What is working well, and what is getting in your way.',
  },
  FEATURE: {
    label: 'What would you like to be able to do?',
    placeholder: 'The thing you are trying to do, and what would make it easier.',
  },
};

const REPORT_TONE = {
  OPEN: 'brand',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
} as const;

export function Help() {
  const toast = useToast();
  const create = useCreateReport();
  const mine = useReports({ limit: 10 });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Controlled, because the description field's wording follows it. A reset
  // form would leave the two out of step, so the submit handler clears it.
  const [type, setType] = useState<ReportType>('BUG');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await create.mutateAsync({
        type,
        featurePage: String(data.get('featurePage') ?? '').trim() || null,
        title: String(data.get('title') ?? '').trim() || null,
        description: String(data.get('description') ?? '').trim(),
      });
      form.reset();
      setType('BUG');
      toast.success('Report sent — thank you');
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) setFieldErrors(error.fieldErrors);
      else toast.error(error instanceof ApiError ? error.message : 'Could not send that report.');
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Help and feedback"
        description="Report something broken, ask for a feature, or tell us what is working."
      />

      <Reveal>
        <Card>
          <h2 className="text-[15px] font-bold">Send a report</h2>
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
            <Select
              label="Type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as ReportType)}
              options={REPORT_TYPES}
            />
            <FieldRow>
              <Field
                label="Title"
                name="title"
                placeholder="Optional"
                error={fieldErrors['title']}
              />
              <Field
                label="Which screen?"
                name="featurePage"
                defaultValue={window.location.pathname}
                error={fieldErrors['featurePage']}
              />
            </FieldRow>
            <Textarea
              label={REPORT_COPY[type].label}
              name="description"
              rows={6}
              required
              placeholder={REPORT_COPY[type].placeholder}
              hint="At least 10 characters."
              error={fieldErrors['description']}
            />
            <Button
              type="submit"
              variant="primary"
              loading={create.isPending}
              className="self-start"
            >
              Send report
            </Button>
          </form>
        </Card>
      </Reveal>

      <Reveal delay={90}>
        <Card padded={false}>
          <h2 className="px-5 py-4 text-[15px] font-bold sm:px-6">Your reports</h2>
          {mine.isPending ? (
            <div className="shimmer px-5 pb-5">
              <Skeleton h={120} radius={12} />
            </div>
          ) : (mine.data?.data.length ?? 0) === 0 ? (
            <p className="border-t border-line px-5 py-8 text-center text-[13.5px] text-ink-3 sm:px-6">
              You have not sent anything yet.
            </p>
          ) : (
            <ul>
              {mine.data?.data.map((report) => (
                <li key={report.id} className="border-t border-line px-5 py-4 sm:px-6">
                  <div className="flex items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">
                        {report.title ?? humanise(report.type)}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-3">
                        {humanise(report.type)} · {longDate(report.createdAt)}
                      </span>
                    </span>
                    <Pill
                      tone={REPORT_TONE[report.status as keyof typeof REPORT_TONE] ?? 'neutral'}
                    >
                      {report.status.toLowerCase().replace('_', ' ')}
                    </Pill>
                  </div>
                  {report.resolution ? (
                    <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-3">
                      {report.resolution}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Reveal>
    </AppShell>
  );
}

/* ── Settings ─────────────────────────────────────────────────────────────── */

export function Settings() {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [savingAccount, setSavingAccount] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSaveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setSavingAccount(true);
    const form = new FormData(event.currentTarget);

    try {
      await auth.updateMe({
        name: String(form.get('name') ?? '').trim(),
        timezone: String(form.get('timezone') ?? '').trim(),
      });
      await refresh();
      toast.success('Account updated');
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) setFieldErrors(error.fieldErrors);
      else toast.error(error instanceof ApiError ? error.message : 'Could not save your account.');
    } finally {
      setSavingAccount(false);
    }
  }

  // Every zone the browser knows, so the list is correct rather than a guess.
  const zones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone').map((z) => ({ value: z, label: z }))
      : [{ value: user?.timezone ?? 'UTC', label: user?.timezone ?? 'UTC' }];

  return (
    <AppShell>
      <PageHeader title="Settings" description="Your account and its security." />

      {/* One card, centred and held to a readable measure. Spread across the
          full page the three fields would each be a metre wide. */}
      <Reveal className="mx-auto w-full max-w-[760px]">
        <Card>
          <h2 className="text-[15px] font-bold">Account</h2>
          <form onSubmit={onSaveAccount} className="mt-4 flex flex-col gap-4" noValidate>
            <Field
              label="Name"
              name="name"
              defaultValue={user?.name ?? ''}
              error={fieldErrors['name']}
            />
            <Field
              label="Email"
              name="email"
              defaultValue={user?.email ?? ''}
              disabled
              hint="Contact support to change the address on your account."
            />
            <Select
              label="Timezone"
              name="timezone"
              defaultValue={user?.timezone ?? 'UTC'}
              options={zones}
              hint="Drives reminder delivery and the default for new events."
            />
            <Button type="submit" variant="primary" loading={savingAccount} className="self-start">
              Save
            </Button>
          </form>

          {/* The facts about the account, below the fields that change it.
              These were a second card headed "Your account", which sat beside
              this one and read as a different subject. */}
          <dl className="mt-6 flex flex-col gap-3 border-t border-line pt-5 text-[13.5px]">
            <Row label="Plan" value={user?.plan ?? '—'} />
            <Row label="Role" value={user ? humanise(user.role) : '—'} />
            <Row label="Member since" value={user ? longDate(user.createdAt) : '—'} />
            <Row
              label="Sign-in method"
              value={user ? humanise(user.providers.join(', ')) || '—' : '—'}
            />
            {user?.subscriptionEndsAt ? (
              <Row label="Renews" value={dateTime(user.subscriptionEndsAt)} />
            ) : null}
          </dl>

          {/* Security, in the two lines it actually needs. The paragraph this
              replaced explained that there is no password to manage, which the
              "Sign-in method" row above already answers. */}
          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-[13.5px] font-bold">Security</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
              Signing out everywhere ends every session, including this one.
            </p>
            <Button
              variant="caution"
              icon="logout"
              className="mt-3"
              onClick={() =>
                void auth
                  .logoutAll()
                  .then((r) => toast.success(`${r.revokedSessions} sessions signed out`))
                  .catch(() => toast.error('Could not sign out your sessions.'))
              }
            >
              Sign out everywhere
            </Button>
          </div>
        </Card>
      </Reveal>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2.5 last:border-b-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
