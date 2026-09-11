/**
 * A project's meetings, as a timeline — a page of its own, beside the brief.
 *
 * One list serves both halves of the job. A meeting entered with a date ahead
 * is scheduled; the same meeting, once the date has passed and the notes are
 * written, is the record of it. Nothing moves between two lists — the line
 * between "coming up" and "held" is simply where today falls on the timeline.
 *
 * This is the project's own record. It puts nothing on anyone's calendar and
 * sends nothing on its own. The one outward action — writing to the people
 * who are meeting — opens the user's own mail with the addresses, subject and
 * details already filled in, so the message is theirs and comes from them.
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { FieldRow, Textarea } from '../components/ui/Form';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/Layout';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { Skeleton, useSlowLoad } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import {
  ApiError,
  type MeetingInput,
  type Project,
  type ProjectMeeting,
  type ProjectMember,
} from '../lib/api';
import { dateInputValue, dateTime, initials, timeInputValue } from '../lib/format';
import {
  projectHooks,
  useProjectMeetingActions,
  useProjectMeetings,
  useProjectMembers,
} from '../lib/queries';

/* ── Mail ─────────────────────────────────────────────────────────────────── */

/**
 * A Gmail compose window with everything filled in.
 *
 * Gmail specifically, as asked, rather than `mailto:` — which would hand the
 * message to whatever the operating system thinks the mail client is, and on
 * most machines that is nothing useful. The user's own account sends it.
 */
function gmailComposeUrl(to: string[], subject: string, body: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: to.join(','),
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function meetingMailBody(projectName: string, m: { heldAt: string; location: string | null }) {
  const lines = [
    'Hi,',
    '',
    `A meeting for ${projectName}:`,
    `When: ${dateTime(m.heldAt)}`,
    ...(m.location ? [`Where: ${m.location}`] : []),
    '',
    'Please let me know if the time does not work for you.',
  ];
  return lines.join('\n');
}

function openMail(to: string[], subject: string, body: string) {
  window.open(gmailComposeUrl(to, subject, body), '_blank', 'noopener,noreferrer');
}

/* ── The page ─────────────────────────────────────────────────────────────── */

export default function ProjectMeetingsPage() {
  const { id = null } = useParams<{ id: string }>();
  const toast = useToast();

  // Resolved the same way the brief page resolves it: from the list the user
  // can already see, which carries their role on it.
  const list = projectHooks.useList({ limit: 100 });
  const project = ((list.data?.data ?? []) as Project[]).find((p) => p.id === id) ?? null;
  const canEdit = project?.myRole === 'OWNER' || project?.myRole === 'EDITOR';

  const meetingsQuery = useProjectMeetings(id);
  const membersQuery = useProjectMembers(id);
  const actions = useProjectMeetingActions(id);

  const loading = list.isPending || meetingsQuery.isPending;
  const showSkeleton = useSlowLoad(loading);

  /** `null` = adding, a meeting = editing, `undefined` = closed. */
  const [editing, setEditing] = useState<ProjectMeeting | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<ProjectMeeting | null>(null);

  const meetings = useMemo(() => meetingsQuery.data?.meetings ?? [], [meetingsQuery.data]);
  const members = membersQuery.data?.members ?? [];

  // Split at now. The server sends newest first, which is right for what has
  // been held — the latest at the top, the past receding — and backwards for
  // what is coming, where the next one belongs at the top. So that half is
  // turned round.
  const now = Date.now();
  const upcoming = meetings.filter((m) => new Date(m.heldAt).getTime() >= now).reverse();
  const held = meetings.filter((m) => new Date(m.heldAt).getTime() < now);

  async function save(input: MeetingInput) {
    try {
      if (editing) {
        await actions.update.mutateAsync({ meetingId: editing.id, input });
        toast.success('Meeting updated');
      } else {
        await actions.create.mutateAsync(input);
        toast.success('Meeting added');
      }
      setEditing(undefined);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save that meeting.');
    }
  }

  async function destroy() {
    if (!deleting) return;
    try {
      await actions.remove.mutateAsync(deleting.id);
      setDeleting(null);
      toast.success('Meeting deleted');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete that meeting.');
    }
  }

  if (loading) {
    return (
      <AppShell>
        {showSkeleton ? (
          <div className="shimmer flex flex-col gap-4">
            <Skeleton h={72} radius={14} />
            <Skeleton h={320} radius={18} />
          </div>
        ) : null}
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <EmptyState
          icon="folder_off"
          title="Project not found"
          action={
            <Link to="/projects">
              <Button variant="brand" icon="arrow_back">
                Back to projects
              </Button>
            </Link>
          }
        >
          It may have been deleted, or you may no longer be a member of it.
        </EmptyState>
      </AppShell>
    );
  }

  const projectName = project.name;

  return (
    <AppShell>
      <PageHeader
        title="Meetings"
        description={`Who met about ${projectName}, when, and what was said.`}
        crumbs={[
          { label: 'Projects', to: '/projects' },
          { label: projectName, to: `/projects/${project.id}` },
          { label: 'Meetings' },
        ]}
        icon="groups"
        actions={
          canEdit ? (
            <Button variant="brand" size="sm" icon="add" onClick={() => setEditing(null)}>
              Add meeting
            </Button>
          ) : undefined
        }
      />

      {meetings.length === 0 ? (
        <EmptyState
          icon="groups"
          title="No meetings yet"
          {...(canEdit
            ? {
                action: (
                  <Button variant="brand" icon="add" onClick={() => setEditing(null)}>
                    Add meeting
                  </Button>
                ),
              }
            : {})}
        >
          {canEdit
            ? 'Schedule one ahead, or write up one that has already happened — who was there, and what was said.'
            : 'Nothing has been scheduled or written up for this project.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {upcoming.length > 0 ? (
            <Timeline
              heading="Coming up"
              meetings={upcoming}
              projectName={projectName}
              canEdit={canEdit}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ) : null}
          {held.length > 0 ? (
            <Timeline
              heading="Held"
              meetings={held}
              projectName={projectName}
              canEdit={canEdit}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ) : null}
        </div>
      )}

      {editing !== undefined ? (
        <MeetingDialog
          meeting={editing}
          members={members}
          projectName={projectName}
          saving={actions.create.isPending || actions.update.isPending}
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void destroy()}
        title="Delete this meeting?"
        what={deleting?.title ?? ''}
        busy={actions.remove.isPending}
      />
    </AppShell>
  );
}

/* ── Timeline ─────────────────────────────────────────────────────────────── */

function Timeline({
  heading,
  meetings,
  projectName,
  canEdit,
  onEdit,
  onDelete,
}: {
  heading: string;
  meetings: ProjectMeeting[];
  projectName: string;
  canEdit: boolean;
  onEdit: (m: ProjectMeeting) => void;
  onDelete: (m: ProjectMeeting) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[12.5px] font-bold text-ink-3">{heading}</h3>
      {/* The line runs down the left; each meeting is a dot on it with its
          card beside. Absolute so the line is continuous through the gaps. */}
      <ol className="relative flex flex-col gap-4 pl-7">
        <span className="absolute top-2 bottom-2 left-[9px] w-px bg-line-2" aria-hidden="true" />
        {meetings.map((meeting) => (
          <MeetingEntry
            key={meeting.id}
            meeting={meeting}
            projectName={projectName}
            canEdit={canEdit}
            onEdit={() => onEdit(meeting)}
            onDelete={() => onDelete(meeting)}
          />
        ))}
      </ol>
    </div>
  );
}

function MeetingEntry({
  meeting,
  projectName,
  canEdit,
  onEdit,
  onDelete,
}: {
  meeting: ProjectMeeting;
  projectName: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const past = new Date(meeting.heldAt).getTime() < Date.now();
  const notes = meeting.notes?.trim() ?? '';
  const long = notes.length > 240;

  return (
    <li className="relative">
      <span
        className={`absolute top-4 -left-7 grid size-[19px] place-items-center rounded-full border-2 bg-canvas ${
          past ? 'border-line-2' : 'border-brand'
        }`}
        aria-hidden="true"
      >
        <span className={`size-2 rounded-full ${past ? 'bg-ink-5' : 'bg-brand'}`} />
      </span>

      <div className="rounded-[16px] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-brand-ink tabular">
              {dateTime(meeting.heldAt)}
              {meeting.location ? (
                <span className="font-normal text-ink-3"> · {meeting.location}</span>
              ) : null}
            </p>
            <h4 className="mt-0.5 text-[15px] leading-snug font-bold text-ink">{meeting.title}</h4>
          </div>

          <div className="flex flex-none items-center gap-0.5">
            {meeting.attendees.length > 0 ? (
              <IconButton
                icon="mail"
                label="Email the attendees"
                onClick={() =>
                  openMail(
                    meeting.attendees.map((a) => a.email),
                    `${projectName}: ${meeting.title}`,
                    meetingMailBody(projectName, meeting),
                  )
                }
              />
            ) : null}
            {canEdit ? (
              <>
                <IconButton icon="edit" label="Edit meeting" onClick={onEdit} />
                <IconButton icon="delete" label="Delete meeting" onClick={onDelete} danger />
              </>
            ) : null}
          </div>
        </div>

        {meeting.attendees.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {meeting.attendees.map((a) => (
              <li
                key={a.id}
                title={a.email}
                className="flex h-7 items-center gap-1.5 rounded-full border border-line-2 bg-surface-2 pr-2.5 pl-1 text-[12px] font-semibold text-ink-2"
              >
                <span className="grid size-5 place-items-center rounded-full bg-brand-tint text-[9.5px] font-bold text-brand-ink">
                  {initials(a.name ?? a.email)}
                </span>
                {a.name ?? a.email}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink-4">No attendees listed</p>
        )}

        {notes ? (
          <div className="mt-3 border-t border-line pt-3">
            <p
              className={`text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-2 ${
                expanded || !long ? '' : 'line-clamp-3'
              }`}
            >
              {notes}
            </p>
            {long ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 text-[12.5px] font-semibold text-brand-ink transition hover:text-ink"
              >
                {expanded ? 'Show less' : 'Read the notes'}
              </button>
            ) : null}
          </div>
        ) : past && canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 text-[12.5px] font-semibold text-ink-4 transition hover:text-ink"
          >
            + Write up what was discussed
          </button>
        ) : null}
      </div>
    </li>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`press grid size-8 place-items-center rounded-lg text-ink-4 transition ${
        danger ? 'hover:bg-danger-tint hover:text-danger-ink' : 'hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

/* ── Dialog ───────────────────────────────────────────────────────────────── */

/** Next hour on the hour, for a meeting being scheduled right now. */
function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function MeetingDialog({
  meeting,
  members,
  projectName,
  saving,
  onClose,
  onSave,
}: {
  meeting: ProjectMeeting | null;
  members: ProjectMember[];
  projectName: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: MeetingInput) => Promise<void>;
}) {
  const initial = meeting ? new Date(meeting.heldAt) : nextHour();

  const [title, setTitle] = useState(meeting?.title ?? '');
  const [date, setDate] = useState(dateInputValue(initial));
  const [time, setTime] = useState(timeInputValue(initial));
  const [location, setLocation] = useState(meeting?.location ?? '');
  const [notes, setNotes] = useState(meeting?.notes ?? '');
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    () => meeting?.attendees.map((a) => a.id) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const heldAt = new Date(`${date}T${time || '00:00'}`);
  const valid = title.trim() !== '' && date !== '' && !Number.isNaN(heldAt.getTime());

  const chosen = members.filter((m) => attendeeIds.includes(m.id));

  function toggle(id: string) {
    setAttendeeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={meeting ? 'Edit meeting' : 'Add meeting'}
      description="Schedule one ahead, or write up one that has already happened."
      busy={saving}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) {
          setError('A title and a date are needed.');
          return;
        }
        setError(null);
        void onSave({
          title: title.trim(),
          heldAt: heldAt.toISOString(),
          location: location.trim() || null,
          notes: notes.trim() || null,
          attendeeIds,
        });
      }}
      footer={
        <>
          {/* Available before saving, because the natural moment to write to
              people is while deciding the time — not after it is on record. */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon="mail"
            disabled={chosen.length === 0 || !valid}
            onClick={() =>
              openMail(
                chosen.map((m) => m.email),
                `${projectName}: ${title.trim()}`,
                meetingMailBody(projectName, {
                  heldAt: heldAt.toISOString(),
                  location: location.trim() || null,
                }),
              )
            }
            className="mr-auto"
          >
            Email attendees
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" size="sm" icon="check" loading={saving}>
            {meeting ? 'Save changes' : 'Add meeting'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Weekly sync, supervisor check-in…"
          required
          autoFocus
        />

        <FieldRow>
          <Field
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Field label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </FieldRow>

        <Field
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Room, link, or 'call'"
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[13px] font-semibold text-ink-2">Attendees</legend>
          {members.length === 0 ? (
            <p className="text-[13px] text-ink-4">
              Nobody is on this project yet. Invite people from the project card first.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-[11px] border border-line-2 bg-surface">
              {members.map((m) => {
                const on = attendeeIds.includes(m.id);
                return (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(m.id)}
                        className="size-4 flex-none accent-[var(--color-brand)]"
                      />
                      <span className="grid size-7 flex-none place-items-center rounded-full bg-brand-tint text-[10.5px] font-bold text-brand-ink">
                        {initials(m.name ?? m.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {m.name ?? m.email}
                        </span>
                        {m.name ? (
                          <span className="block truncate text-[12px] text-ink-4">{m.email}</span>
                        ) : null}
                      </span>
                      {m.acceptedAt === null && m.role !== 'OWNER' ? (
                        <span className="flex-none text-[11px] font-semibold text-ink-4">
                          Invited
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <Textarea
          label="Discussion / notes"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What was discussed, decided, or left open. Fill in after the meeting if it has not happened yet."
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
