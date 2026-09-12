/**
 * Calendar and Meetings.
 *
 * The month grid is built from the *expanded* range endpoint, so a weekly
 * event appears on every week it occurs rather than only on the day the series
 * was created. The grid itself is derived from the real month — the first
 * column is Monday, and the leading blanks come from the actual weekday of the
 * 1st, not from a hard-coded offset.
 *
 * A redacted occurrence — one the viewer may see the existence of but not the
 * detail of — has to look deliberate: muted, hatched and padlocked, never like
 * something that failed to load.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { FieldRow, Select, Textarea } from '../components/ui/Form';
import { Icon } from '../components/ui/Icon';
import { Card, PageHeader, Pill, Toolbar } from '../components/ui/Layout';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { Reveal } from '../components/ui/Motion';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import {
  ApiError,
  type CalendarEvent,
  type EventVisibility,
  type MeetingRequest,
  type Recurrence,
} from '../lib/api';
import { paletteFor } from '../lib/features';
import { RequestMeetButton } from './RequestMeet';
import { dateTime, dateTimeInputValue, humanise, timeOnly } from '../lib/format';
import { eventHooks, useEventRange, useMeetingActions, useMeetings } from '../lib/queries';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const REMINDER_OPTIONS = [
  { value: '', label: 'Never' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
];

const VISIBILITIES = [
  { value: 'PRIVATE', label: 'Private — nobody else sees it' },
  { value: 'BUSY', label: 'Busy — others see the slot only' },
  { value: 'PUBLIC', label: 'Public — others see the details' },
];

const RECURRENCES = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Every two weeks' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

/** Local midnight of the 1st of `date`'s month. */
function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Monday-first weekday index, 0–6. `getDay()` is Sunday-first. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function sameLocalDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

export default function Calendar() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // The header's search can send someone here for one event; it says when the
  // event is, so the grid opens on that month rather than this one.
  const arrivalAt = (location.state as { at?: string } | null)?.at;
  const [cursor, setCursor] = useState(() =>
    monthStart(arrivalAt ? new Date(arrivalAt) : new Date()),
  );
  useEffect(() => {
    if (arrivalAt) navigate(location.pathname, { replace: true, state: null });
    // Once, on arrival.
  }, []);
  const [editing, setEditing] = useState<CalendarEvent | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // The grid always shows whole weeks, so the fetched range starts on the
  // Monday before the 1st and ends after the last visible cell.
  const { cells, rangeFrom, rangeTo } = useMemo(() => {
    const first = monthStart(cursor);
    const start = new Date(first);
    start.setDate(1 - mondayIndex(first));

    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil((mondayIndex(first) + daysInMonth) / 7);
    const total = weeks * 7;

    const end = new Date(start);
    end.setDate(start.getDate() + total);

    return {
      cells: Array.from({ length: total }, (_, i) => {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        return day;
      }),
      rangeFrom: start.toISOString(),
      rangeTo: end.toISOString(),
    };
  }, [cursor]);

  const range = useEventRange(rangeFrom, rangeTo);
  const create = eventHooks.useCreate();
  const update = eventHooks.useUpdate();
  const remove = eventHooks.useRemove();

  const events = range.data?.events ?? [];
  const saving = create.isPending || update.isPending;
  const today = new Date();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    const form = new FormData(event.currentTarget);

    const toInstant = (name: string) => {
      const value = String(form.get(name) ?? '');
      return value ? new Date(value).toISOString() : '';
    };

    const input = {
      title: String(form.get('title') ?? '').trim(),
      description: String(form.get('description') ?? '').trim() || null,
      location: String(form.get('location') ?? '').trim() || null,
      startAt: toInstant('startAt'),
      endAt: toInstant('endAt'),
      // The browser's zone is the one the local times were typed in; the
      // backend needs it to keep recurrence correct across a DST change.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      category: String(form.get('category') ?? '').trim() || 'Work',
      visibility: String(form.get('visibility') ?? 'PRIVATE') as EventVisibility,
      recurrence: String(form.get('recurrence') ?? 'NONE') as Recurrence,
      // "" is "no reminder"; anything else is minutes before the start.
      reminderMinutes: form.get('reminderMinutes') ? Number(form.get('reminderMinutes')) : null,
    };

    try {
      // An expanded occurrence carries the series id, so editing one edits the
      // series — which is what the backend supports today.
      if (editing) await update.mutateAsync({ id: editing.id, input });
      else await create.mutateAsync(input);
      toast.success(editing ? 'Event updated' : 'Event created');
      setEditing(undefined);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) setFieldErrors(error.fieldErrors);
      else toast.error(error instanceof ApiError ? error.message : 'Could not save that event.');
    }
  }

  async function onDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Event deleted');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete that event.');
    }
    setDeleting(null);
  }

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(cursor);

  return (
    <AppShell>
      <PageHeader
        title="Calendar"
        crumbs={[{ label: 'Calendar' }]}
        icon="calendar_month"
        description="Events, recurring commitments and meetings. Recurring events stay correct across daylight-saving changes."
        actions={
          <>
            <RequestMeetButton />
            <Button variant="brand" size="sm" icon="add" onClick={() => setEditing(null)}>
              Add event
            </Button>
          </>
        }
      />

      <Toolbar>
        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="press grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition hover:bg-surface-2"
          >
            <Icon name="chevron_left" size={19} />
          </button>
          <span className="min-w-[150px] px-2 text-center text-[14.5px] font-bold">
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="press grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition hover:bg-surface-2"
          >
            <Icon name="chevron_right" size={19} />
          </button>
        </div>

        <Button variant="secondary" size="sm" onClick={() => setCursor(monthStart(new Date()))}>
          Today
        </Button>

        <span className="flex-1" />

        {/* One entry per kind on the grid, in the colour the grid uses. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
          {(Object.keys(CHIP) as ChipKind[]).map((kind) => (
            <Legend key={kind} colour={CHIP[kind].palette().brand} label={CHIP[kind].label} />
          ))}
          <Legend colour="var(--color-ink-5)" label="Busy — details private" />
          <span className="flex items-center gap-1.5">
            <Icon name="repeat" size={14} /> Recurring
          </span>
        </div>
      </Toolbar>

      {range.isPending ? (
        <Skeleton h={620} radius={18} className="shimmer" />
      ) : range.isError ? (
        <Card className="grid place-items-center gap-3 py-14 text-center">
          <Icon name="cloud_off" size={30} className="text-danger" />
          <h2 className="text-[17px] font-bold">The calendar could not be loaded</h2>
          <Button variant="brand" size="sm" onClick={() => void range.refetch()}>
            Try again
          </Button>
        </Card>
      ) : (
        <Reveal>
          <Card padded={false} className="overflow-hidden">
            {/* Seven columns cannot be squeezed into a phone: at 390px a day
                cell is under 40px of usable width, which is narrower than the
                time on the chip inside it. So the month keeps its real width
                and the grid scrolls sideways, the same bargain the wide tables
                in the admin panel make. `min-w-0` on the wrapper keeps the
                card from being stretched by it. */}
            <div className="min-w-0 overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-7 border-b border-line bg-surface-5">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="px-2 py-2.5 text-center text-[11.5px] font-bold tracking-[0.06em] text-ink-4 uppercase"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {cells.map((day) => {
                    const inMonth = day.getMonth() === cursor.getMonth();
                    const isToday = sameLocalDay(today.toISOString(), day);
                    const dayEvents = events.filter((e) => sameLocalDay(e.startAt, day));

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[104px] border-r border-b border-line p-1.5 last:border-r-0 ${
                          inMonth ? '' : 'bg-surface-5'
                        }`}
                      >
                        <span
                          className={`ml-1 inline-grid size-6 place-items-center rounded-full text-[12px] tabular ${
                            isToday
                              ? 'bg-ink font-bold text-white'
                              : inMonth
                                ? 'font-medium text-ink-3'
                                : 'text-ink-5'
                          }`}
                        >
                          {day.getDate()}
                        </span>

                        <div className="mt-1 flex flex-col gap-1">
                          {dayEvents.slice(0, 3).map((event, n) => (
                            <EventChip
                              key={`${event.id}-${n}`}
                              event={event}
                              // A project meeting is changed in its project's log,
                              // so opening it goes there rather than to the editor.
                              // What came from another section is changed there:
                              // a team meeting in its project's log, a deadline in
                              // Deadlines — opened searching for it by name.
                              onOpen={() =>
                                event.redacted
                                  ? undefined
                                  : event.project
                                    ? navigate(`/projects/${event.project.id}/meetings`)
                                    : event.deadline
                                      ? navigate('/deadlines', { state: { search: event.title } })
                                      : setEditing(event)
                              }
                            />
                          ))}
                          {dayEvents.length > 3 ? (
                            <span className="px-1 text-[10.5px] font-semibold text-ink-4">
                              +{dayEvents.length - 3} more
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </Reveal>
      )}

      {!range.isPending && !range.isError && events.length === 0 ? (
        <EmptyState
          icon="calendar_month"
          title="Nothing scheduled this month"
          action={
            <Button variant="brand" icon="add" onClick={() => setEditing(null)}>
              Add event
            </Button>
          }
        >
          Events you create appear here, and deadlines with a due date show up alongside them.
        </EmptyState>
      ) : null}

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? 'Edit event' : 'Add event'}
        onSubmit={onSubmit}
        busy={saving}
        size="lg"
        footer={
          <>
            {editing ? (
              <Button
                variant="ghost"
                size="sm"
                icon="delete"
                className="mr-auto text-danger-ink"
                onClick={() => {
                  setDeleting(editing);
                  setEditing(undefined);
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(undefined)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" size="sm" loading={saving}>
              {editing ? 'Save changes' : 'Create event'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Title"
            name="title"
            defaultValue={editing?.title ?? ''}
            required
            error={fieldErrors['title']}
          />
          <FieldRow>
            <Field
              label="Starts"
              name="startAt"
              type="datetime-local"
              defaultValue={dateTimeInputValue(editing?.startAt ?? defaultStart())}
              required
              error={fieldErrors['startAt']}
            />
            <Field
              label="Ends"
              name="endAt"
              type="datetime-local"
              defaultValue={dateTimeInputValue(editing?.endAt ?? defaultEnd())}
              required
              error={fieldErrors['endAt']}
            />
          </FieldRow>
          <FieldRow>
            <Field
              label="Location"
              name="location"
              defaultValue={editing?.location ?? ''}
              placeholder="Room B412, or a link"
              error={fieldErrors['location']}
            />
            <Field
              label="Category"
              name="category"
              defaultValue={editing?.category ?? 'Work'}
              error={fieldErrors['category']}
            />
          </FieldRow>
          <FieldRow>
            <Select
              label="Visible to people with calendar access"
              name="visibility"
              defaultValue={editing?.visibility ?? 'PRIVATE'}
              options={VISIBILITIES}
            />
            <Select
              label="Repeats"
              name="recurrence"
              defaultValue={editing?.recurrence ?? 'NONE'}
              options={RECURRENCES}
            />
          </FieldRow>
          <Select
            label="Remind me"
            name="reminderMinutes"
            defaultValue={editing ? String(editing.reminderMinutes ?? '') : '15'}
            options={REMINDER_OPTIONS}
            hint="A notification in Skrivbok before it starts. All-day events are not reminded."
          />
          <Textarea
            label="Description"
            name="description"
            rows={3}
            defaultValue={editing?.description ?? ''}
            error={fieldErrors['description']}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void onDelete()}
        title="Delete this event?"
        what={deleting?.title ?? ''}
        busy={remove.isPending}
      />
    </AppShell>
  );
}

/** Next full hour, as a sensible default start for a new event. */
function defaultStart(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function defaultEnd(): Date {
  const d = defaultStart();
  d.setHours(d.getHours() + 1);
  return d;
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: colour }} />
      {label}
    </span>
  );
}

/**
 * What kind of thing a chip is, and how it is drawn.
 *
 * Four kinds share the grid and each wears the colour of the section it came
 * from, so the calendar reads as a view over the workspace rather than a
 * section of its own: a deadline is red because Deadlines is red, a team
 * meeting amber because Projects is. The legend above the grid lists the
 * same four in the same colours.
 */
type ChipKind = 'event' | 'deadline' | 'team' | 'meeting';

function chipKind(event: CalendarEvent): ChipKind {
  if (event.deadline) return 'deadline';
  if (event.project) return 'team';
  if (event.meetingRequestId) return 'meeting';
  return 'event';
}

const CHIP: Record<
  ChipKind,
  {
    label: string;
    icon: string | null;
    palette: () => { tint: string; deep: string; brand: string };
  }
> = {
  event: {
    label: 'Event',
    icon: null,
    palette: () => ({
      tint: 'var(--color-brand-tint)',
      deep: 'var(--color-brand-deep)',
      brand: 'var(--color-brand)',
    }),
  },
  deadline: { label: 'Deadline', icon: 'flag', palette: () => paletteFor('/deadlines')! },
  team: { label: 'Team meeting', icon: 'groups', palette: () => paletteFor('/projects')! },
  meeting: { label: 'Meeting', icon: 'handshake', palette: () => paletteFor('/meetings')! },
};

function EventChip({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  if (event.redacted) {
    return (
      <span
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-5 italic"
        style={{
          background: 'var(--color-surface-2)',
          backgroundImage:
            'repeating-linear-gradient(45deg, rgb(11 15 25 / 0.05) 0 5px, transparent 5px 10px)',
        }}
      >
        <Icon name="lock" size={11} />
        Busy
      </span>
    );
  }

  const kind = chipKind(event);
  const { icon, palette } = CHIP[kind];
  const colours = palette();
  const done = event.deadline?.status === 'COMPLETED';

  const title = event.project
    ? `${event.project.name} · ${event.title}`
    : event.deadline
      ? `Deadline · ${event.title}${done ? ' (completed)' : ''}`
      : event.title;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      className={`press flex w-full items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[11px] font-medium transition hover:brightness-95 ${
        done ? 'line-through opacity-60' : ''
      }`}
      style={{ background: colours.tint, color: colours.deep }}
    >
      {icon ? <Icon name={icon} size={11} className="flex-none" /> : null}
      {!event.isAllDay ? (
        <span className="flex-none font-mono text-[10px]">{timeOnly(event.startAt)}</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {event.recurrence !== 'NONE' ? <Icon name="repeat" size={11} className="flex-none" /> : null}
    </button>
  );
}

/* ── Meetings ─────────────────────────────────────────────────────────────── */

const STATUS_TONE = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'neutral',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
} as const;

export function Meetings() {
  const toast = useToast();
  const [box, setBox] = useState<'incoming' | 'outgoing'>('incoming');
  const [proposing, setProposing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const list = useMeetings({ box, limit: 25, sort: 'soonest' });
  const { accept, decline, cancel, create, cancelGroup } = useMeetingActions();
  const incoming = useMeetings({ box: 'incoming', status: 'PENDING', limit: 1 });

  const requests = list.data?.data ?? [];
  const pendingCount = incoming.data?.pagination.total ?? 0;

  const act = (
    action: { mutateAsync: (id: string) => Promise<unknown>; isPending: boolean },
    id: string,
    message: string,
  ) =>
    void action
      .mutateAsync(id)
      .then(() => toast.success(message))
      .catch((error: unknown) =>
        toast.error(error instanceof ApiError ? error.message : 'That did not work. Try again.'),
      );

  async function onPropose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const toInstant = (name: string) => {
      const value = String(form.get(name) ?? '');
      return value ? new Date(value).toISOString() : '';
    };

    try {
      await create.mutateAsync({
        receiverEmail: String(form.get('receiverEmail') ?? '').trim(),
        title: String(form.get('title') ?? '').trim(),
        description: String(form.get('description') ?? '').trim() || null,
        startAt: toInstant('startAt'),
        endAt: toInstant('endAt'),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      toast.success('Meeting proposed');
      setProposing(false);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) setFieldErrors(error.fieldErrors);
      else toast.error(error instanceof ApiError ? error.message : 'Could not send that proposal.');
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Meetings"
        crumbs={[{ label: 'Calendar', to: '/calendar' }, { label: 'Meetings' }]}
        icon="groups"
        description="Propose a time and see it accepted or declined. Accepting puts the event on both calendars at once; cancelling removes it from both."
        actions={
          <>
            <RequestMeetButton />
            <Button variant="brand" size="sm" icon="add" onClick={() => setProposing(true)}>
              Propose a meeting
            </Button>
          </>
        }
      />

      <Toolbar>
        <div className="flex flex-none rounded-xl border border-line bg-surface p-1">
          {(['incoming', 'outgoing'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBox(b)}
              className={`press flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold capitalize transition ${
                box === b ? 'bg-brand-tint text-brand-deep' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {b}
              {b === 'incoming' && pendingCount > 0 ? (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-danger-strong px-1 text-[10px] font-bold text-white tabular">
                  {pendingCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </Toolbar>

      {list.isPending ? (
        <div className="shimmer flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} h={128} radius={18} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon="groups"
          title={box === 'incoming' ? 'No incoming requests' : 'You have not proposed anything'}
          action={
            box === 'outgoing' ? (
              <Button variant="brand" icon="add" onClick={() => setProposing(true)}>
                Propose a meeting
              </Button>
            ) : undefined
          }
        >
          {box === 'incoming'
            ? 'When somebody proposes a time, it appears here with your calendar clashes marked.'
            : 'Propose a time by email address. The other person accepts or declines, and the event lands on both calendars.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {groupOutgoing(requests, box).map((item, i) => (
            <Reveal key={item.kind === 'group' ? item.groupId : item.request.id} delay={i * 45}>
              {item.kind === 'group' ? (
                <GroupMeetCard
                  requests={item.requests}
                  onCancel={() => act(cancelGroup, item.groupId, 'Meet cancelled for everyone')}
                  busy={cancelGroup.isPending}
                />
              ) : (
                <MeetingCard
                  request={item.request}
                  box={box}
                  onAccept={() =>
                    act(
                      accept,
                      item.request.id,
                      item.request.groupId
                        ? 'Accepted — it is on your calendar'
                        : 'Meeting accepted — it is on both calendars',
                    )
                  }
                  onDecline={() => act(decline, item.request.id, 'Meeting declined')}
                  onCancel={() => act(cancel, item.request.id, 'Meeting cancelled')}
                  busy={accept.isPending || decline.isPending || cancel.isPending}
                />
              )}
            </Reveal>
          ))}
        </div>
      )}

      <Modal
        open={proposing}
        onClose={() => setProposing(false)}
        title="Propose a meeting"
        description="They receive a notification and can accept, decline or suggest another time."
        onSubmit={onPropose}
        busy={create.isPending}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setProposing(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" size="sm" loading={create.isPending}>
              Send proposal
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Their email address"
            name="receiverEmail"
            type="email"
            required
            placeholder="colleague@university.edu"
            error={fieldErrors['receiverEmail']}
          />
          <Field label="Title" name="title" required error={fieldErrors['title']} />
          <FieldRow>
            <Field
              label="Starts"
              name="startAt"
              type="datetime-local"
              defaultValue={dateTimeInputValue(defaultStart())}
              required
              error={fieldErrors['startAt']}
            />
            <Field
              label="Ends"
              name="endAt"
              type="datetime-local"
              defaultValue={dateTimeInputValue(defaultEnd())}
              required
              error={fieldErrors['endAt']}
            />
          </FieldRow>
          <Textarea
            label="What is it about?"
            name="description"
            rows={3}
            error={fieldErrors['description']}
          />
        </div>
      </Modal>
    </AppShell>
  );
}

/**
 * Outgoing requests that were sent together are shown together.
 *
 * The server keeps one request per attendee — that is what each person
 * answers — but the sender arranged one meet, and reading three cards for it
 * would be reading the same meeting three times. Incoming requests stay one
 * per card: each is addressed to this user and is theirs alone to answer.
 */
type ListItem =
  | { kind: 'one'; request: MeetingRequest }
  | { kind: 'group'; groupId: string; requests: MeetingRequest[] };

function groupOutgoing(requests: MeetingRequest[], box: 'incoming' | 'outgoing'): ListItem[] {
  if (box === 'incoming') return requests.map((request) => ({ kind: 'one', request }));

  const items: ListItem[] = [];
  const groups = new Map<string, ListItem & { kind: 'group' }>();

  for (const request of requests) {
    if (!request.groupId) {
      items.push({ kind: 'one', request });
      continue;
    }
    const existing = groups.get(request.groupId);
    if (existing) {
      existing.requests.push(request);
    } else {
      const group = { kind: 'group' as const, groupId: request.groupId, requests: [request] };
      groups.set(request.groupId, group);
      items.push(group);
    }
  }
  return items;
}

function GroupMeetCard({
  requests,
  onCancel,
  busy,
}: {
  requests: MeetingRequest[];
  onCancel: () => void;
  busy: boolean;
}) {
  const first = requests[0]!;
  const live = requests.some((r) => r.status === 'PENDING' || r.status === 'ACCEPTED');
  const accepted = requests.filter((r) => r.status === 'ACCEPTED').length;

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15.5px] font-bold">{first.title}</h2>
            <Pill tone={live ? (accepted > 0 ? 'success' : 'warning') : 'neutral'}>
              {live ? `${accepted} of ${requests.length} accepted` : 'Cancelled'}
            </Pill>
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <Icon name="schedule" size={16} className="text-ink-4" />
              {dateTime(first.startAt)} – {timeOnly(first.endAt)}
            </span>
            <span className="flex items-center gap-1.5 text-ink-3">
              <Icon name="public" size={15} className="text-ink-4" />
              {first.timezone}
            </span>
          </p>

          {/* One line per person, with where they stand. */}
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex h-7 items-center gap-1.5 rounded-full border border-line-2 bg-surface-2 pr-1.5 pl-2.5 text-[12px] font-semibold text-ink-2"
              >
                {r.receiver?.name ?? r.receiver?.email ?? 'Someone'}
                <Pill tone={STATUS_TONE[r.status]}>{humanise(r.status)}</Pill>
              </li>
            ))}
          </ul>

          {first.description ? (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3 italic">
              “{first.description}”
            </p>
          ) : null}
        </div>

        {live ? (
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            Cancel meet
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function MeetingCard({
  request,
  box,
  onAccept,
  onDecline,
  onCancel,
  busy,
}: {
  request: MeetingRequest;
  box: 'incoming' | 'outgoing';
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const other = box === 'incoming' ? request.sender : request.receiver;
  const pending = request.status === 'PENDING';

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15.5px] font-bold">{request.title}</h2>
            <Pill tone={STATUS_TONE[request.status]}>{humanise(request.status)}</Pill>
          </div>

          <p className="mt-1 text-[13px] text-ink-3">
            {box === 'incoming' ? 'From' : 'To'}{' '}
            <span className="font-semibold text-ink-2">
              {other?.name ?? other?.email ?? 'someone'}
            </span>
          </p>

          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <Icon name="schedule" size={16} className="text-ink-4" />
              {dateTime(request.startAt)} – {timeOnly(request.endAt)}
            </span>
            <span className="flex items-center gap-1.5 text-ink-3">
              <Icon name="public" size={15} className="text-ink-4" />
              {request.timezone}
            </span>
          </p>

          {request.description ? (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3 italic">
              “{request.description}”
            </p>
          ) : null}
        </div>

        {pending ? (
          <div className="flex flex-none gap-2">
            {box === 'incoming' ? (
              <>
                <Button variant="secondary" size="sm" onClick={onDecline} disabled={busy}>
                  Decline
                </Button>
                <Button variant="brand" size="sm" icon="check" onClick={onAccept} disabled={busy}>
                  Accept
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
                Cancel request
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
