/**
 * Calendar and Meetings.
 *
 * Five views over the same data — a day, the working week, the seven days from
 * the cursor, the month, and the month as an agenda — all drawn from the
 * *expanded* range endpoint, so a weekly event appears on every week it occurs
 * rather than only on the day the series was created. The arithmetic is in
 * `calendar/model.ts`, the drawing in `calendar/views.tsx`.
 *
 * Teammates who have shared their calendar can be laid over any view, each in
 * their own colour, from the Team dialog. What of theirs is visible is decided
 * by the server: what involves the user in full, everything else as Busy.
 *
 * A redacted occurrence — one the viewer may see the existence of but not the
 * detail of — has to look deliberate: muted, hatched and padlocked, never like
 * something that failed to load.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
import { RequestMeetButton } from './RequestMeet';
import { dateTime, dateTimeInputValue, humanise, longDate, timeOnly } from '../lib/format';
import {
  eventHooks,
  useEventRange,
  useHeldCalendars,
  useMeetingActions,
  useMeetings,
  useSharedCalendars,
} from '../lib/queries';
import {
  isView,
  mergeCalendars,
  shift,
  startOfDay,
  teamColour,
  viewTitle,
  viewWindow,
  type CalendarView,
  type DisplayEvent,
  type Teammate,
} from './calendar/model';
import { TeamButton, TeamDialog, TeammateChips } from './calendar/TeamCalendars';
import {
  AgendaView,
  CalendarLegend,
  MonthView,
  TimeGridView,
  ViewSwitcher,
} from './calendar/views';

const REMINDER_OPTIONS = [
  { value: '', label: 'Never' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
];

/**
 * What a teammate who can see the calendar sees of this event.
 *
 * Two choices now, because two outcomes are possible: busy, or the details
 * for someone given full access. BUSY behaves exactly like PRIVATE, so it is
 * offered only to an event that already has it (group meets are created so).
 */
function visibilityOptions(current: EventVisibility | undefined) {
  const options = [
    { value: 'PRIVATE', label: 'Private — teammates see only that you are busy' },
    { value: 'PUBLIC', label: 'Public — teammates you allow details see what it is' },
  ];
  return current === 'BUSY'
    ? [...options, { value: 'BUSY', label: 'Busy — teammates see only that you are busy' }]
    : options;
}

const RECURRENCES = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Every two weeks' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

/* ── Remembered choices ───────────────────────────────────────────────────── */

const VIEW_KEY = 'skrivbok.calendar.view';
const TEAM_KEY = 'skrivbok.calendar.team';

function readView(): CalendarView {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    return isView(stored) ? stored : 'month';
  } catch {
    return 'month';
  }
}

function readTeam(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(TEAM_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* A private window: the choice lasts the visit. */
  }
}

const UNIT: Record<CalendarView, string> = {
  day: 'day',
  workweek: 'week',
  week: 'week',
  month: 'month',
  agenda: 'month',
};

export default function Calendar() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  // The header's search can send someone here for one event; it says when the
  // event is, so the view opens on that day rather than today.
  const arrivalAt = (location.state as { at?: string } | null)?.at;
  const [view, setView] = useState<CalendarView>(readView);
  const [cursor, setCursor] = useState(() =>
    startOfDay(arrivalAt ? new Date(arrivalAt) : new Date()),
  );
  useEffect(() => {
    if (arrivalAt)
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // Once, on arrival.
  }, []);
  useEffect(() => remember(VIEW_KEY, view), [view]);

  // Whose calendars are laid over this one. Remembered as emails; any that are
  // no longer shared simply stop matching a grant and are not drawn.
  const [team, setTeam] = useState<string[]>(readTeam);
  const [teamOpen, setTeamOpen] = useState(false);
  useEffect(() => remember(TEAM_KEY, JSON.stringify(team)), [team]);
  const toggleTeammate = (email: string) =>
    setTeam((current) =>
      current.includes(email) ? current.filter((e) => e !== email) : [...current, email],
    );

  // The access notifications link here: `?shared=` when someone has shared
  // their calendar (so it is switched on), `?accessRequest=` when someone is
  // asking for this one (so the dialog to answer is opened).
  useEffect(() => {
    const shared = params.get('shared');
    const accessRequest = params.get('accessRequest');
    if (!shared && !accessRequest) return;
    if (shared) setTeam((current) => (current.includes(shared) ? current : [...current, shared]));
    if (accessRequest) setTeamOpen(true);
    const next = new URLSearchParams(params);
    next.delete('shared');
    next.delete('accessRequest');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const [editing, setEditing] = useState<CalendarEvent | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const [viewing, setViewing] = useState<DisplayEvent | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const win = useMemo(() => viewWindow(view, cursor), [view, cursor]);
  const from = win.from.toISOString();
  const to = win.to.toISOString();

  const range = useEventRange(from, to);
  const held = useHeldCalendars();
  const teammates: Teammate[] = (held.data?.grants ?? []).map((grant, i) => ({
    email: grant.owner.email,
    name: grant.owner.name,
    colour: teamColour(i),
  }));
  const shown = teammates.filter((t) => team.includes(t.email));
  const sharedQueries = useSharedCalendars(
    shown.map((t) => t.email),
    from,
    to,
  );
  const sharedCalendars = shown.flatMap((teammate, i) => {
    const calendar = sharedQueries[i]?.data;
    return calendar ? [{ calendar, teammate }] : [];
  });
  const failed = shown.filter((_, i) => sharedQueries[i]?.isError);
  const display = mergeCalendars(range.data?.events ?? [], sharedCalendars);

  const create = eventHooks.useCreate();
  const update = eventHooks.useUpdate();
  const remove = eventHooks.useRemove();
  const saving = create.isPending || update.isPending;

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

  /**
   * What clicking something does.
   *
   * The user's own events open the editor. What came from another section is
   * changed there: a team meeting in its project's log, a deadline in
   * Deadlines, opened searching for it by name. A teammate's event, or any
   * Busy block, opens a read-only summary — there is nothing to edit.
   */
  function open(item: DisplayEvent) {
    const event = item.own;
    if (!event || item.redacted) {
      setViewing(item);
      return;
    }
    if (event.project) navigate(`/projects/${event.project.id}/meetings`);
    else if (event.deadline) navigate('/deadlines', { state: { search: event.title } });
    else setEditing(event);
  }

  return (
    <AppShell>
      <PageHeader
        title="Calendar"
        crumbs={[{ label: 'Calendar' }]}
        icon="calendar_month"
        description="Events, recurring commitments and meetings — and your teammates' calendars beside yours, once they share them."
        actions={
          <>
            <TeamButton onClick={() => setTeamOpen(true)} />
            <RequestMeetButton />
            <Button variant="brand" size="sm" icon="add" onClick={() => setEditing(null)}>
              Add event
            </Button>
          </>
        }
      />

      <Toolbar>
        <Button variant="secondary" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
          Today
        </Button>
        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            aria-label={`Previous ${UNIT[view]}`}
            onClick={() => setCursor((c) => shift(view, c, -1))}
            className="press grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition hover:bg-surface-2"
          >
            <Icon name="chevron_left" size={19} />
          </button>
          <button
            type="button"
            aria-label={`Next ${UNIT[view]}`}
            onClick={() => setCursor((c) => shift(view, c, 1))}
            className="press grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition hover:bg-surface-2"
          >
            <Icon name="chevron_right" size={19} />
          </button>
        </div>
        <h2
          aria-live="polite"
          className="min-w-0 px-1 font-serif text-[20px] leading-tight font-semibold"
        >
          {viewTitle(view, win, cursor)}
        </h2>
        <span className="flex-1" />
        <ViewSwitcher value={view} onChange={setView} />
      </Toolbar>

      <TeammateChips teammates={teammates} shown={team} onToggle={toggleTeammate} />

      <CalendarLegend teammates={shown} />

      {failed.length > 0 ? (
        <p role="status" className="text-[12.5px] text-danger-ink">
          Could not load the calendar of {failed.map((t) => t.name ?? t.email).join(', ')}.
        </p>
      ) : null}

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
      ) : view === 'agenda' ? (
        <AgendaView events={display} onOpen={open} />
      ) : (
        <Reveal>
          <Card padded={false} className="overflow-hidden">
            {view === 'month' ? (
              <MonthView days={win.days} cursor={cursor} events={display} onOpen={open} />
            ) : (
              <TimeGridView days={win.days} events={display} onOpen={open} />
            )}
          </Card>
        </Reveal>
      )}

      {view === 'month' && !range.isPending && !range.isError && display.length === 0 ? (
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
              label="What teammates who can see your calendar see"
              name="visibility"
              defaultValue={editing?.visibility ?? 'PRIVATE'}
              options={visibilityOptions(editing?.visibility)}
              hint="Anything that includes them — they are an attendee, or it is a meeting with them — they see in full."
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

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? (viewing.redacted ? 'Busy' : viewing.title) : ''}
        {...(viewing?.teammate
          ? { description: `On ${viewing.teammate.name ?? viewing.teammate.email}'s calendar` }
          : {})}
        size="sm"
      >
        {viewing ? (
          <div className="flex flex-col gap-2.5 text-[13.5px] text-ink-2">
            <p className="flex items-start gap-2">
              <Icon name="schedule" size={17} className="mt-px flex-none text-ink-4" />
              {viewing.isAllDay
                ? `${longDate(viewing.start)} · All day`
                : viewing.start.getTime() === viewing.end.getTime()
                  ? dateTime(viewing.start)
                  : `${dateTime(viewing.start)} – ${timeOnly(viewing.end)}`}
            </p>
            {!viewing.redacted && viewing.location ? (
              <p className="flex items-start gap-2">
                <Icon name="place" size={17} className="mt-px flex-none text-ink-4" />
                {viewing.location}
              </p>
            ) : null}
            {viewing.redacted ? (
              <p className="leading-relaxed text-ink-3">
                The details are private. You can see that this time is taken because the calendar is
                shared with you, but the event does not include you.
              </p>
            ) : viewing.description ? (
              <p className="leading-relaxed whitespace-pre-line text-ink-3">
                {viewing.description}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {teamOpen ? (
        <TeamDialog onClose={() => setTeamOpen(false)} shown={team} onToggle={toggleTeammate} />
      ) : null}
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
