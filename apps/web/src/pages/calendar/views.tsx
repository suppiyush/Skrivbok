/**
 * The five ways of drawing the calendar.
 *
 * Each takes the same merged list of `DisplayEvent`s and an `onOpen` for when
 * one is clicked; none of them fetches anything or knows whether an event is
 * the user's own or a teammate's beyond what `coloursFor` says about it.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { timeOnly } from '../../lib/format';
import {
  CHIP,
  HATCH,
  HOUR_PX,
  VIEWS,
  coloursFor,
  isAllDayLike,
  overlapsDay,
  placeTimed,
  sameDay,
  shortName,
  startOfDay,
  type CalendarView,
  type ChipKind,
  type DisplayEvent,
  type Placed,
  type Teammate,
} from './model';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Open = (event: DisplayEvent) => void;

/** What a block says about itself on hover. */
function tooltip(event: DisplayEvent): string {
  const who = event.teammate ? `${event.teammate.name ?? event.teammate.email} · ` : '';
  if (event.redacted) return `${who}Busy`;
  const own = event.own;
  const where = own?.project ? `${own.project.name} · ` : own?.deadline ? 'Deadline · ' : '';
  return `${who}${where}${event.title}`;
}

/** The words on a block. A teammate's busy slot says whose it is. */
function label(event: DisplayEvent): string {
  if (event.redacted) return event.teammate ? `Busy · ${shortName(event.teammate)}` : 'Busy';
  return event.title;
}

function blockColours(event: DisplayEvent): CSSProperties {
  const colours = coloursFor(event);
  return event.redacted
    ? {
        borderLeftColor: event.teammate?.colour ?? 'var(--color-ink-5)',
        background: 'var(--color-surface-2)',
        backgroundImage: HATCH,
        color: 'var(--color-ink-4)',
      }
    : { borderLeftColor: colours.brand, background: colours.tint, color: colours.deep };
}

/* ── Controls ─────────────────────────────────────────────────────────────── */

export function ViewSwitcher({
  value,
  onChange,
}: {
  value: CalendarView;
  onChange: (view: CalendarView) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Calendar view"
      className="flex max-w-full flex-none overflow-x-auto rounded-xl border border-line bg-surface p-1"
    >
      {VIEWS.map((view) => (
        <button
          key={view.value}
          type="button"
          role="radio"
          aria-checked={value === view.value}
          onClick={() => onChange(view.value)}
          className={`press flex-none rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
            value === view.value ? 'bg-brand text-white' : 'text-ink-3 hover:text-ink'
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

function Legend({ colour, label: text }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: colour }} />
      {text}
    </span>
  );
}

/** One entry per kind on the grid, in the colour the grid uses, then each shown teammate. */
export function CalendarLegend({ teammates }: { teammates: Teammate[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
      {(Object.keys(CHIP) as ChipKind[]).map((kind) => (
        <Legend key={kind} colour={CHIP[kind].palette().brand} label={CHIP[kind].label} />
      ))}
      {teammates.map((t) => (
        <Legend key={t.email} colour={t.colour} label={t.name ?? t.email} />
      ))}
      <Legend colour="var(--color-ink-5)" label="Busy — details private" />
      <span className="flex items-center gap-1.5">
        <Icon name="repeat" size={14} /> Recurring
      </span>
    </div>
  );
}

/* ── Month ────────────────────────────────────────────────────────────────── */

function EventChip({ event, onOpen }: { event: DisplayEvent; onOpen: Open }) {
  const colours = coloursFor(event);
  const done = event.own?.deadline?.status === 'COMPLETED';

  if (event.redacted) {
    return (
      <button
        type="button"
        onClick={() => onOpen(event)}
        title={tooltip(event)}
        className="flex w-full items-center gap-1 truncate rounded-md border-l-2 px-1.5 py-1 text-left text-[11px] font-medium italic"
        style={blockColours(event)}
      >
        <Icon name="lock" size={11} className="flex-none" />
        {!event.isAllDay ? (
          <span className="flex-none font-mono text-[10px] not-italic">
            {timeOnly(event.start)}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{label(event)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      title={tooltip(event)}
      className={`press flex w-full items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[11px] font-medium transition hover:brightness-95 ${
        done ? 'line-through opacity-60' : ''
      }`}
      style={{ background: colours.tint, color: colours.deep }}
    >
      {colours.icon ? <Icon name={colours.icon} size={11} className="flex-none" /> : null}
      {event.teammate ? (
        <span
          className="size-1.5 flex-none rounded-full"
          style={{ background: event.teammate.colour }}
        />
      ) : null}
      {!event.isAllDay ? (
        <span className="flex-none font-mono text-[10px]">{timeOnly(event.start)}</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {event.recurring ? <Icon name="repeat" size={11} className="flex-none" /> : null}
    </button>
  );
}

export function MonthView({
  days,
  cursor,
  events,
  onOpen,
}: {
  days: Date[];
  cursor: Date;
  events: DisplayEvent[];
  onOpen: Open;
}) {
  const today = new Date();

  return (
    // Seven columns cannot be squeezed into a phone, so the month keeps its
    // width and scrolls sideways, as the wide admin tables do.
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
          {days.map((day) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = sameDay(day, today);
            const dayEvents = events.filter((e) => sameDay(e.start, day));

            return (
              <div
                key={day.getTime()}
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
                  {dayEvents.slice(0, 3).map((event) => (
                    <EventChip key={event.key} event={event} onOpen={onOpen} />
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
  );
}

/* ── Day, workweek and week ───────────────────────────────────────────────── */

const HOUR_LABEL = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
const WEEKDAY_SHORT = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

function TimedBlock({ placed, onOpen }: { placed: Placed; onOpen: Open }) {
  const { event, top, height, column, columns } = placed;
  const colours = coloursFor(event);
  const px = (minutes: number) => (minutes / 60) * HOUR_PX;
  const width = 100 / columns;
  const tall = px(height) >= 40;
  const done = event.own?.deadline?.status === 'COMPLETED';

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      title={tooltip(event)}
      className={`press absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11.5px] leading-tight font-semibold transition hover:brightness-95 ${
        done ? 'line-through opacity-60' : ''
      } ${event.redacted ? 'italic' : ''}`}
      style={{
        ...blockColours(event),
        top: px(top),
        height: Math.max(px(height) - 2, 18),
        left: `calc(${column * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
      }}
    >
      <span className="flex items-center gap-1 truncate">
        {event.redacted ? (
          <Icon name="lock" size={12} className="flex-none" />
        ) : colours.icon ? (
          <Icon name={colours.icon} size={12} className="flex-none" />
        ) : null}
        <span className="truncate">{label(event)}</span>
      </span>
      {tall ? (
        <span className="mt-0.5 block truncate text-[10.5px] font-medium not-italic opacity-80">
          {event.start.getTime() === event.end.getTime()
            ? timeOnly(event.start)
            : `${timeOnly(event.start)} – ${timeOnly(event.end)}`}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Hours down the side, one column per day.
 *
 * Opens scrolled to the working day — 7 AM, or earlier when something starts
 * earlier — rather than at midnight, which is where an unscrolled grid sits and
 * where nobody's first event is. Today's column is tinted, and carries a line
 * at the current time.
 */
export function TimeGridView({
  days,
  events,
  onOpen,
}: {
  days: Date[];
  events: DisplayEvent[];
  onOpen: Open;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const firstDay = days[0]?.getTime() ?? 0;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const earliest = events
      .filter((e) => !isAllDayLike(e) && days.some((d) => overlapsDay(e, d)))
      .reduce((hour, e) => Math.min(hour, e.start.getHours()), 7);
    el.scrollTop = Math.max(0, earliest - 0.5) * HOUR_PX;
    // When the days change, not on every refetch of the events.
  }, [firstDay, days.length]);

  const columns: CSSProperties = {
    gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`,
  };
  const allDay = days.map((day) => events.filter((e) => isAllDayLike(e) && overlapsDay(e, day)));
  const hasAllDay = allDay.some((list) => list.length > 0);
  // Five or seven columns need room to be read; on a phone they scroll sideways.
  const minWidth = days.length >= 7 ? 'min-w-[760px]' : days.length >= 5 ? 'min-w-[600px]' : '';

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className={minWidth}>
        <div className="grid border-b border-line" style={columns}>
          <div />
          {days.map((day) => {
            const isToday = sameDay(day, now);
            return (
              <div
                key={day.getTime()}
                className={`border-l border-line px-2 py-2.5 text-center ${isToday ? 'bg-brand-tint' : ''}`}
              >
                <div
                  className={`text-[11px] font-bold tracking-[0.08em] uppercase ${
                    isToday ? 'text-brand-deep' : 'text-ink-4'
                  }`}
                >
                  {WEEKDAY_SHORT.format(day)}
                </div>
                <div
                  className={`mt-0.5 text-[19px] leading-none font-semibold tabular ${
                    isToday ? 'text-brand-deep' : 'text-ink'
                  }`}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {hasAllDay ? (
          <div className="grid border-b border-line bg-surface-5" style={columns}>
            <div className="px-1.5 py-2 text-right text-[10.5px] font-semibold text-ink-4">
              All day
            </div>
            {allDay.map((list, i) => (
              <div key={i} className="flex min-w-0 flex-col gap-1 border-l border-line p-1">
                {list.map((event) => (
                  <EventChip key={event.key} event={event} onOpen={onOpen} />
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <div
          ref={scroller}
          className="relative h-[min(640px,calc(100dvh-300px))] min-h-[420px] overflow-y-auto"
        >
          <div className="grid" style={{ ...columns, height: 24 * HOUR_PX }}>
            <div className="relative">
              {Array.from({ length: 24 }, (_, hour) =>
                hour === 0 ? null : (
                  <span
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-[10.5px] whitespace-nowrap text-ink-4 tabular"
                    style={{ top: hour * HOUR_PX }}
                  >
                    {HOUR_LABEL.format(new Date(2000, 0, 1, hour))}
                  </span>
                ),
              )}
            </div>

            {days.map((day) => {
              const timed = events.filter((e) => !isAllDayLike(e) && overlapsDay(e, day));
              const isToday = sameDay(day, now);
              const nowTop = ((now.getTime() - day.getTime()) / 3_600_000) * HOUR_PX;

              return (
                <div
                  key={day.getTime()}
                  className={`relative border-l border-line ${isToday ? 'bg-brand-tint-2' : ''}`}
                  style={{
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${
                      HOUR_PX - 1
                    }px, var(--color-line) ${HOUR_PX - 1}px ${HOUR_PX}px)`,
                  }}
                >
                  {placeTimed(timed, day).map((placed) => (
                    <TimedBlock key={placed.event.key} placed={placed} onOpen={onOpen} />
                  ))}
                  {isToday ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger-strong"
                      style={{ top: nowTop }}
                    >
                      <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-danger-strong" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Agenda ───────────────────────────────────────────────────────────────── */

const AGENDA_DAY = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

function AgendaItem({ event, onOpen }: { event: DisplayEvent; onOpen: Open }) {
  const colours = coloursFor(event);
  const when = event.isAllDay
    ? 'All day'
    : event.start.getTime() === event.end.getTime()
      ? timeOnly(event.start)
      : `${timeOnly(event.start)} – ${timeOnly(event.end)}`;
  const meta = [
    when,
    event.redacted ? null : event.location,
    event.own?.project?.name ?? null,
    event.teammate ? (event.teammate.name ?? event.teammate.email) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className="w-full rounded-[14px] border border-l-[3px] border-line bg-surface px-5 py-3.5 text-left transition hover:bg-surface-3"
      style={{
        borderLeftColor: event.redacted
          ? (event.teammate?.colour ?? 'var(--color-ink-5)')
          : colours.brand,
      }}
    >
      <span
        className={`flex items-center gap-2 text-[14.5px] font-semibold ${
          event.redacted ? 'text-ink-4 italic' : 'text-ink'
        }`}
      >
        {event.redacted ? (
          <Icon name="lock" size={16} className="flex-none" />
        ) : colours.icon ? (
          <Icon
            name={colours.icon}
            size={16}
            className="flex-none"
            style={{ color: colours.brand }}
          />
        ) : null}
        <span className="min-w-0 truncate">{label(event)}</span>
      </span>
      <span className="mt-1 block text-[12.5px] text-ink-3">{meta}</span>
      {!event.redacted && event.description ? (
        <span className="mt-1.5 line-clamp-2 block text-[13px] leading-relaxed text-ink-3">
          {event.description}
        </span>
      ) : null}
    </button>
  );
}

/** The month, in the order things happen, under a heading per day. */
export function AgendaView({ events, onOpen }: { events: DisplayEvent[]; onOpen: Open }) {
  if (events.length === 0) {
    return (
      <EmptyState icon="event_note" title="Nothing this month">
        Events, deadlines and meetings in the month appear here in the order they happen.
      </EmptyState>
    );
  }

  const groups: { day: Date; items: DisplayEvent[] }[] = [];
  for (const event of events) {
    const day = startOfDay(event.start);
    const last = groups[groups.length - 1];
    if (last && sameDay(last.day, day)) last.items.push(event);
    else groups.push({ day, items: [event] });
  }

  const today = new Date();

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const isToday = sameDay(group.day, today);
        return (
          <section key={group.day.getTime()}>
            <h3
              className={`mb-2 text-[12px] font-bold tracking-[0.08em] uppercase ${
                isToday ? 'text-brand-deep' : 'text-ink-4'
              }`}
            >
              {isToday ? 'Today · ' : ''}
              {AGENDA_DAY.format(group.day)}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {group.items.map((event) => (
                <li key={event.key}>
                  <AgendaItem event={event} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
