/**
 * Asking several teammates to a meet.
 *
 * The button and its dialog together, so the Calendar and the Meetings page
 * can each offer it with one line. Attendees are picked from the people who
 * share a project with the user — the server will not accept anyone else —
 * and the time is chosen as a date, a start, an end and a zone, sent as
 * written: turning "10:00 in Stockholm" into an instant is the server's job.
 *
 * Nothing is emailed. Each attendee gets an in-app notification and answers
 * in Meetings; the requester's own calendar has it from the moment it is sent.
 */
import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { FieldRow, Select, Textarea } from '../components/ui/Form';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateInputValue, initials } from '../lib/format';
import { useMeetContacts, useMeetingActions } from '../lib/queries';

/** Every zone the browser knows, so the list is correct rather than a guess. */
function zoneOptions(fallback: string) {
  return typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone').map((z) => ({ value: z, label: z }))
    : [{ value: fallback, label: fallback }];
}

/** Next hour on the hour, and the hour after it. */
function defaultTimes(): { date: string; start: string; end: string } {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${pad(d.getHours())}:00`;
  const end = `${pad((d.getHours() + 1) % 24)}:00`;
  return { date: dateInputValue(d), start, end };
}

export function RequestMeetButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size={size} icon="group_add" onClick={() => setOpen(true)}>
        Request a meet
      </Button>
      {open ? <RequestMeetDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function RequestMeetDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const contacts = useMeetContacts();
  const { createGroup } = useMeetingActions();

  const defaults = useMemo(defaultTimes, []);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaults.date);
  const [startTime, setStartTime] = useState(defaults.start);
  const [endTime, setEndTime] = useState(defaults.end);
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const zones = useMemo(() => zoneOptions(user?.timezone ?? 'UTC'), [user?.timezone]);
  const people = contacts.data?.contacts ?? [];

  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? people.filter(
        (p) =>
          (p.name ?? '').toLowerCase().includes(needle) ||
          p.email.toLowerCase().includes(needle) ||
          p.projects.some((n) => n.toLowerCase().includes(needle)),
      )
    : people;

  const chosen = people.filter((p) => attendeeIds.includes(p.id));
  const valid = attendeeIds.length > 0 && title.trim() !== '' && date && startTime && endTime;

  function toggle(id: string) {
    setAttendeeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function submit() {
    if (!valid) {
      setError('Pick at least one person, and give the meet a title.');
      return;
    }
    if (endTime <= startTime) {
      setError('The meet has to end after it starts.');
      return;
    }
    setError(null);

    try {
      await createGroup.mutateAsync({
        attendeeIds,
        title: title.trim(),
        description: description.trim() || null,
        date,
        startTime,
        endTime,
        timezone,
      });
      toast.success(
        `Meet requested — ${chosen.length} ${chosen.length === 1 ? 'person' : 'people'} asked`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send that request.');
    }
  }

  const busy = createGroup.isPending;

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title="Request a meet"
      description="Ask people from your projects. It goes on your calendar now, and on theirs when they accept."
      busy={busy}
      size="lg"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" size="sm" icon="send" loading={busy}>
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[13px] font-semibold text-ink-2">Attendees</legend>

          {chosen.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {chosen.map((p) => (
                <li
                  key={p.id}
                  className="flex h-7 items-center gap-1.5 rounded-full bg-brand-tint pr-2 pl-2.5 text-[12px] font-semibold text-brand-ink"
                >
                  {p.name ?? p.email}
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-label={`Remove ${p.name ?? p.email}`}
                    className="transition hover:text-ink"
                  >
                    <Icon name="close" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <label className="flex h-10 items-center gap-2 rounded-[11px] border border-line-2 bg-surface px-3 focus-within:border-brand">
            <Icon name="search" size={16} className="flex-none text-ink-4" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find a teammate by name, email or project…"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-5"
            />
          </label>

          {contacts.isPending ? (
            <p className="px-1 text-[13px] text-ink-4">Loading your teammates…</p>
          ) : people.length === 0 ? (
            <p className="px-1 text-[13px] leading-relaxed text-ink-4">
              Nobody yet. A meet is with people who share a project with you — invite someone to a
              project first, and they will appear here once they have signed up.
            </p>
          ) : shown.length === 0 ? (
            <p className="px-1 text-[13px] text-ink-4">Nobody matches “{filter.trim()}”.</p>
          ) : (
            <ul className="flex max-h-[220px] flex-col divide-y divide-line overflow-y-auto rounded-[11px] border border-line-2 bg-surface">
              {shown.map((p) => {
                const on = attendeeIds.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(p.id)}
                        className="size-4 flex-none accent-[var(--color-brand)]"
                      />
                      <span className="grid size-7 flex-none place-items-center rounded-full bg-brand-tint text-[10.5px] font-bold text-brand-ink">
                        {initials(p.name ?? p.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {p.name ?? p.email}
                        </span>
                        <span className="block truncate text-[12px] text-ink-4">
                          {p.name ? `${p.email} · ` : ''}
                          {p.projects.join(', ')}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <Field
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sprint planning, thesis check-in…"
          required
        />

        <FieldRow>
          <Field
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Select
            label="Time zone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            options={zones}
          />
        </FieldRow>

        <FieldRow>
          <Field
            label="Start time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <Field
            label="End time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </FieldRow>

        <Textarea
          label="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What it is about, and anything to prepare."
        />

        {error ? (
          <p role="alert" className="text-[13px] text-danger-ink">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
