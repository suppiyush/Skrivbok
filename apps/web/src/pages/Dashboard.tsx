/**
 * Dashboard.
 *
 * Answers one question — what needs me today? — and only then offers the rest
 * of the workspace. The hierarchy is deliberate: four counters, the two things
 * with a date attached, and quiet links to everything else.
 *
 * Every number here is a real count from the API. There is no "recent activity"
 * feed, because a list of things you already did is not a reason to open an app.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Card, CardHeader, PageHeader, Pill } from '../components/ui/Layout';
import { CountUp, Reveal } from '../components/ui/Motion';
import { Skeleton } from '../components/ui/Skeleton';
import { dueLabel, longDate, timeOnly } from '../lib/format';
import { useAuth } from '../lib/auth';
import {
  deadlineHooks,
  useCareerSummary,
  useDeadlineSummary,
  useEventRange,
  useMeetings,
  useUsage,
} from '../lib/queries';

export default function Dashboard() {
  const { user } = useAuth();

  // "Today" is the user's civil day, taken from the browser. The backend stores
  // instants; the window that counts as today is a display decision.
  const { dayStart, dayEnd } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { dayStart: start.toISOString(), dayEnd: end.toISOString() };
  }, []);

  const deadlineSummary = useDeadlineSummary();
  const careerSummary = useCareerSummary();
  const usage = useUsage();
  const today = useEventRange(dayStart, dayEnd);
  const incoming = useMeetings({ box: 'incoming', status: 'PENDING', limit: 5 });
  const attention = deadlineHooks.useList({ limit: 4, sort: 'dueSoonest', status: 'PENDING' });

  const firstName = (user?.name ?? '').trim().split(/\s+/)[0];
  const events = today.data?.events ?? [];
  const pendingMeetings = incoming.data?.data ?? [];
  const upcoming = attention.data?.data ?? [];

  const counters = [
    {
      label: 'Overdue',
      value: deadlineSummary.data?.overdue ?? 0,
      icon: 'error',
      to: '/deadlines',
      tone: 'text-danger',
      loading: deadlineSummary.isPending,
    },
    {
      label: 'Due this week',
      value: deadlineSummary.data?.dueThisWeek ?? 0,
      icon: 'schedule',
      to: '/deadlines',
      tone: 'text-warn',
      loading: deadlineSummary.isPending,
    },
    {
      label: 'Events today',
      value: events.length,
      icon: 'calendar_month',
      to: '/calendar',
      tone: 'text-brand',
      loading: today.isPending,
    },
    {
      label: 'Awaiting reply',
      value: pendingMeetings.length,
      icon: 'groups',
      to: '/meetings',
      tone: 'text-ink-3',
      loading: incoming.isPending,
    },
  ];

  const workspace = [
    {
      to: '/projects',
      icon: 'folder_open',
      label: 'Projects',
      value: usage.data?.projects.used,
      hint: 'Shared work and briefs',
    },
    {
      to: '/literature',
      icon: 'menu_book',
      label: 'Literature',
      value: usage.data?.literature.used,
      hint: 'Papers and reading notes',
    },
    {
      to: '/career-goals',
      icon: 'trending_up',
      label: 'Career goals',
      value: careerSummary.data?.total,
      hint:
        careerSummary.data !== undefined
          ? `${careerSummary.data.averageProgress}% average progress`
          : 'Stage-tracked goals',
    },
    { to: '/ideas', icon: 'lightbulb', label: 'Ideas', hint: 'Captured before they go' },
    { to: '/notes', icon: 'sticky_note_2', label: 'Notes', hint: 'Longer working notes' },
    { to: '/journal', icon: 'history_edu', label: 'Journal', hint: 'What you actually did' },
  ];

  return (
    <AppShell>
      <PageHeader
        title={firstName ? `Good to see you, ${firstName}` : 'Good to see you'}
        description={longDate(new Date())}
        actions={
          <>
            <Link to="/deadlines">
              <Button variant="secondary" size="sm" icon="add">
                New deadline
              </Button>
            </Link>
            <Link to="/ideas">
              <Button variant="primary" size="sm" icon="bolt">
                Capture an idea
              </Button>
            </Link>
          </>
        }
      />

      {/* ── Counters ───────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {counters.map((c, i) => (
          <Reveal key={c.label} delay={i * 50}>
            <Link to={c.to} className="block">
              <Card className="lift h-full">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-3">
                  <Icon name={c.icon} size={17} className={c.tone} />
                  {c.label}
                </span>
                {c.loading ? (
                  <Skeleton h={34} radius={8} className="shimmer mt-2 w-16" />
                ) : (
                  <CountUp
                    value={c.value}
                    className="mt-1.5 block text-[30px] leading-none font-extrabold tabular"
                  />
                )}
              </Card>
            </Link>
          </Reveal>
        ))}
      </div>

      {/* ── The two things with a date attached ────────────────────────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Reveal delay={80}>
          <Card padded={false} className="h-full">
            <div className="px-5 pt-5 pb-3">
              <CardHeader
                title="Needs attention"
                icon="flag"
                tint="var(--color-danger-tint)"
                fg="var(--color-danger)"
                count={deadlineSummary.data?.open}
              />
            </div>

            {attention.isPending ? (
              <ListSkeleton rows={3} />
            ) : upcoming.length === 0 ? (
              <QuietEmpty
                icon="check_circle"
                text="Nothing is due. Add a deadline when the next one is set."
              />
            ) : (
              <ul>
                {upcoming.map((deadline) => {
                  const due = dueLabel(deadline.dueAt);
                  return (
                    <li key={deadline.id} className="border-t border-line">
                      <Link
                        to="/deadlines"
                        className="row-hover flex items-center gap-3 px-5 py-3 hover:bg-surface-3"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">
                            {deadline.title}
                          </span>
                          {due ? (
                            <span
                              className={`mt-0.5 block text-[12.5px] ${
                                due.tone === 'danger' ? 'text-danger-ink' : 'text-ink-3'
                              }`}
                            >
                              {due.text}
                            </span>
                          ) : null}
                        </span>
                        <Pill tone={due?.tone === 'danger' ? 'danger' : 'warning'}>
                          {deadline.priority.charAt(0) + deadline.priority.slice(1).toLowerCase()}
                        </Pill>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <FooterLink to="/deadlines" label="All deadlines" />
          </Card>
        </Reveal>

        <Reveal delay={140}>
          <Card padded={false} className="h-full">
            <div className="px-5 pt-5 pb-3">
              <CardHeader
                title="Today's schedule"
                icon="calendar_month"
                tint="var(--color-brand-tint)"
                fg="var(--color-brand)"
                count={events.length}
              />
            </div>

            {today.isPending ? (
              <ListSkeleton rows={3} />
            ) : events.length === 0 ? (
              <QuietEmpty icon="event_available" text="Nothing scheduled today." />
            ) : (
              <ul>
                {events.slice(0, 5).map((event, i) => (
                  <li key={`${event.id}-${i}`} className="border-t border-line">
                    <Link
                      to="/calendar"
                      className="row-hover flex items-center gap-4 px-5 py-3 hover:bg-surface-3"
                    >
                      <span className="w-12 flex-none font-mono text-[12px] text-ink-3 tabular">
                        {event.isAllDay ? 'all day' : timeOnly(event.startAt)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-[14px] font-semibold ${
                            event.redacted ? 'text-ink-4 italic' : ''
                          }`}
                        >
                          {event.title}
                        </span>
                        {event.location ? (
                          <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
                            {event.location}
                          </span>
                        ) : null}
                      </span>
                      {event.redacted ? (
                        <Icon name="lock" size={15} className="flex-none text-ink-5" />
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <FooterLink to="/calendar" label="Open calendar" />
          </Card>
        </Reveal>
      </div>

      {/* ── Meeting requests, only when there are any ──────────────────────── */}
      {pendingMeetings.length > 0 ? (
        <Reveal delay={60}>
          <Card>
            <CardHeader
              title="Meeting requests waiting on you"
              icon="groups"
              tint="var(--color-brand-tint)"
              fg="var(--color-brand)"
              count={pendingMeetings.length}
              action={
                <Link to="/meetings" className="text-[12.5px] font-semibold text-brand-ink">
                  Review
                </Link>
              }
            />
            <ul className="mt-3 flex flex-col gap-1.5">
              {pendingMeetings.slice(0, 3).map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-[13.5px]">
                  <Icon name="schedule" size={16} className="flex-none text-ink-4" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{m.title}</span>
                  <span className="flex-none text-[12.5px] text-ink-3">
                    {m.sender?.name ?? m.sender?.email ?? 'Someone'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      ) : null}

      {/* ── Everything else ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-bold tracking-[0.1em] text-ink-5 uppercase">
          Your workspace
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspace.map((w, i) => (
            <Reveal key={w.to} delay={i * 40}>
              <Link to={w.to} className="block">
                <Card className="lift h-full !p-4">
                  <span className="flex items-center gap-3">
                    <Icon name={w.icon} size={19} className="flex-none text-ink-4" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold">{w.label}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
                        {w.hint}
                      </span>
                    </span>
                    {w.value !== undefined ? (
                      <span className="flex-none font-mono text-[13px] text-ink-3 tabular">
                        {w.value}
                      </span>
                    ) : (
                      <Icon name="chevron_right" size={18} className="row-arrow flex-none text-ink-5" />
                    )}
                  </span>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

/* ── Small pieces ─────────────────────────────────────────────────────────── */

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="shimmer flex flex-col gap-2 px-5 pb-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} h={44} radius={10} />
      ))}
    </div>
  );
}

function QuietEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="border-t border-line px-5 py-8 text-center">
      <Icon name={icon} size={24} className="text-ink-5" />
      <p className="mt-2 text-[13px] text-ink-3">{text}</p>
    </div>
  );
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="row-hover flex items-center justify-between border-t border-line px-5 py-3 text-[13px] font-semibold text-brand-ink hover:bg-surface-3"
    >
      {label}
      <Icon name="arrow_forward" size={17} className="row-arrow" />
    </Link>
  );
}
