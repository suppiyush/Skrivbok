/**
 * Projects.
 *
 * The one collaborative resource: a project has members with roles, so the
 * screen has to make two things obvious at a glance — what your own role is,
 * and whether an invitation is still waiting on you.
 *
 * Cards rather than rows, because a project carries a progress bar and a member
 * strip that a single line cannot hold.
 */
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { Select, Textarea } from '../components/ui/Form';
import { Icon } from '../components/ui/Icon';
import { PersonAvatar } from '../components/ui/Person';
import { Card, PageHeader, Pagination, Pill, SearchInput, Toolbar } from '../components/ui/Layout';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { Reveal } from '../components/ui/Motion';
import { Skeleton, useSlowLoad } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { ApiError, type Project } from '../lib/api';
import { humanise, relative } from '../lib/format';
import {
  projectHooks,
  useAcceptInvite,
  useProjectMemberActions,
  useProjectMembers,
  useProjectQuota,
} from '../lib/queries';

const SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'owned', label: 'Owned' },
  { value: 'shared', label: 'Shared with me' },
];

export default function Projects() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [scope, setScope] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  /**
   * A link into this page (the dashboard's "New" menu) can ask for the create
   * dialog to be open on arrival, through router state rather than a query
   * string. Read during the first render rather than in an effect: an effect
   * runs after the browser paints, so the bare list would appear for a frame
   * before the dialog arrived over it.
   */
  const openOnArrival = (location.state as { openCreate?: boolean } | null)?.openCreate === true;

  const [editing, setEditing] = useState<Project | null | undefined>(
    openOnArrival ? null : undefined,
  );
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [managing, setManaging] = useState<Project | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Invitations typed on the create form. Held here rather than read out of
  // FormData on submit, because the rows are added and removed as you go.
  const [members, setMembers] = useState<MemberDraft[]>([BLANK_MEMBER]);

  // Acted on, so the flag is dropped from history: left in place, a refresh or
  // a back navigation would reopen the dialog.
  useEffect(() => {
    if (openOnArrival) navigate(location.pathname, { replace: true, state: null });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(
    () => ({
      page,
      limit: 12,
      scope,
      ...(search ? { search } : {}),
    }),
    [page, scope, search],
  );

  const list = projectHooks.useList(query);
  const create = projectHooks.useCreate();
  const update = projectHooks.useUpdate();
  const remove = projectHooks.useRemove();
  const quota = useProjectQuota();
  const acceptInvite = useAcceptInvite();

  const projects = (list.data?.data ?? []) as Project[];
  const meta = list.data?.pagination;
  const limit = quota.data;
  const atLimit = limit?.limited === true && limit.remaining === 0;
  const saving = create.isPending || update.isPending;

  // Only the list gates the body now. The quota used to as well, because the
  // usage meter it fed sat in the header and would drop in late, shoving
  // everything below it down the page — with the meter gone it decides nothing
  // but whether the New button is disabled, which displaces nothing.
  const loading = list.isPending;
  // Nothing is drawn for a wait too short to read — see `useSlowLoad`.
  const showSkeleton = useSlowLoad(loading);

  // A search that finds nothing is still a search, not an empty inbox: the
  // "nothing shared yet" wording only holds when nothing is filtering it out.
  const sharedAndEmpty = scope === 'shared' && search === '';

  /**
   * Close, and forget.
   *
   * The invitee rows are state on this screen rather than fields in the form,
   * so unmounting the dialog does not clear them — abandoning a half-typed
   * invitation would otherwise leave it waiting in the next project's form.
   */
  function closeDialog() {
    setEditing(undefined);
    setMembers([BLANK_MEMBER]);
    setFieldErrors({});
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim() || null,
      progress: Number(form.get('progress') ?? 0),
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input });
      } else {
        // A row with no email is an empty row the user never filled in, not an
        // invitation — the name alone is not something the server can invite.
        const invites = members
          .filter((m) => m.email.trim() !== '')
          .map((m) => ({ email: m.email.trim(), name: m.name.trim() || null, role: m.role }));
        await create.mutateAsync({ ...input, members: invites });
      }
      toast.success(editing ? 'Project updated' : 'Project created');
      setEditing(undefined);
      setMembers([BLANK_MEMBER]);
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) setFieldErrors(error.fieldErrors);
      else toast.error(error instanceof ApiError ? error.message : 'Could not save that project.');
    }
  }

  async function onDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Project deleted');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete that project.');
    }
    setDeleting(null);
  }

  return (
    <AppShell>
      <PageHeader
        title="Projects"
        crumbs={[{ label: 'Projects' }]}
        icon="folder_open"
        description="Manage all your projects, track progress, and collaborate with your team"
        actions={
          <Button
            variant="brand"
            size="sm"
            icon="add"
            disabled={atLimit}
            onClick={() => setEditing(null)}
          >
            Add project
          </Button>
        }
      />

      {/* Search first, so it takes the free space on the left and pushes the
          scope filter to the right edge. */}
      <Toolbar>
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search projects" />

        <div className="flex flex-none rounded-xl border border-line bg-surface p-1">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setScope(s.value);
                setPage(1);
              }}
              className={`press rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                scope === s.value ? 'bg-brand-tint text-brand-deep' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Toolbar>

      {loading ? (
        showSkeleton ? (
          <div className="shimmer grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} h={168} radius={18} />
            ))}
          </div>
        ) : null
      ) : list.isError ? (
        <Card className="grid place-items-center gap-3 py-14 text-center">
          <Icon name="cloud_off" size={30} className="text-danger" />
          <h2 className="text-[17px] font-bold">Projects could not be loaded</h2>
          <Button variant="brand" size="sm" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </Card>
      ) : projects.length === 0 ? (
        /* "Shared with me" is the one empty view where creating a project is
           no answer: anything you make is owned by you, so it would never
           appear here. The offer is dropped rather than left to disappoint. */
        sharedAndEmpty ? (
          <EmptyState icon="group" title="Nothing shared with you yet">
            Projects a colleague invites you to will appear here.
          </EmptyState>
        ) : (
          <EmptyState
            icon="folder_open"
            title={search || scope !== 'all' ? 'Nothing matches' : 'No projects yet'}
            action={
              <Button variant="brand" icon="add" onClick={() => setEditing(null)}>
                Add project
              </Button>
            }
          >
            {search || scope !== 'all'
              ? 'Try a different search, or switch back to All.'
              : 'A project holds the members, progress and brief for one piece of work.'}
          </EmptyState>
        )
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {projects.map((project, i) => (
              <Reveal key={project.id} delay={i * 45}>
                <ProjectCard
                  project={project}
                  accepting={acceptInvite.isPending}
                  onAccept={() =>
                    void acceptInvite
                      .mutateAsync(project.id)
                      .then(() => toast.success(`You have joined ${project.name}`))
                      .catch((error: unknown) =>
                        toast.error(
                          error instanceof ApiError
                            ? error.message
                            : 'Could not accept that invitation.',
                        ),
                      )
                  }
                  onEdit={() => setEditing(project)}
                  onDelete={() => setDeleting(project)}
                  onMembers={() => setManaging(project)}
                  onMeetings={() => navigate(`/projects/${project.id}/meetings`)}
                />
              </Reveal>
            ))}
          </div>

          {meta ? (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              shown={projects.length}
              onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          ) : null}
        </>
      )}

      {/* ── Create / edit ──────────────────────────────────────────────────── */}
      <Modal
        open={editing !== undefined}
        onClose={closeDialog}
        title={editing ? 'Edit project' : 'Add project'}
        onSubmit={onSubmit}
        busy={saving}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" size="sm" loading={saving}>
              {editing ? 'Save changes' : 'Create project'}
            </Button>
          </>
        }
      >
        {/* Rendered only while open, so every opening builds fresh fields.

            The dialog element stays mounted and these inputs are uncontrolled,
            so `defaultValue` applies once and never again. A key on the project
            id fixed editing two projects in a row, but not creating two: the
            key was "new" both times, so the second dialog still held the first
            one's answers. Unmounting on close covers both. */}
        {editing !== undefined ? (
          <div className="flex flex-col gap-4">
            <Field
              label="Name"
              name="name"
              defaultValue={editing?.name ?? ''}
              required
              error={fieldErrors['name']}
            />
            <Textarea
              label="Description"
              name="description"
              rows={2}
              defaultValue={editing?.description ?? ''}
              error={fieldErrors['description']}
            />
            <ProgressSlider name="progress" defaultValue={editing?.progress ?? 0} />

            {/* Invitations are part of creating a project, not of editing one:
              the update endpoint takes no members, and an existing project has
              the members dialog, which can also change roles and remove people. */}
            {!editing ? <TeamMembersField members={members} onChange={setMembers} /> : null}
          </div>
        ) : null}
      </Modal>

      <MembersDialog project={managing} onClose={() => setManaging(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void onDelete()}
        title="Delete this project?"
        what={deleting?.name ?? ''}
        busy={remove.isPending}
      />
    </AppShell>
  );
}

/* ── Create-dialog fields ─────────────────────────────────────────────────── */

type AssignableRole = 'EDITOR' | 'VIEWER';

interface MemberDraft {
  name: string;
  email: string;
  role: AssignableRole;
}

const BLANK_MEMBER: MemberDraft = { name: '', email: '', role: 'VIEWER' };

/**
 * The access a colleague gets.
 *
 * These are real: every project endpoint routes through `requireProjectRole`,
 * and an editor may change the project where a viewer is refused. OWNER is not
 * offered — it follows creation and transfer, and is not something to hand out
 * from an invite form.
 */
function RoleSelect({
  name,
  value,
  defaultValue,
  onChange,
}: {
  name: string;
  value?: AssignableRole;
  defaultValue?: AssignableRole;
  onChange?: (role: AssignableRole) => void;
}) {
  return (
    <Select
      label="Access"
      name={name}
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      {...(onChange ? { onChange: (e) => onChange(e.target.value as AssignableRole) } : {})}
      options={[
        { value: 'VIEWER', label: 'Viewer' },
        { value: 'EDITOR', label: 'Editor' },
      ]}
    />
  );
}

/**
 * Progress, as something you drag.
 *
 * A native range input rather than a built one: it already handles the pointer
 * leaving the element mid-drag, arrow keys, Home/End and touch. What it does
 * not do is colour the filled part of its own track, so that is painted here
 * as a gradient that stops at the current value.
 *
 * The input keeps its `name`, so the surrounding form still reads it out of
 * `FormData` exactly as the number box did.
 */
function ProgressSlider({ name, defaultValue }: { name: string; defaultValue: number }) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
          Progress
        </label>
        <span className="text-[13px] font-bold text-brand-deep tabular">{value}%</span>
      </div>
      <input
        id={id}
        name={name}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="range mt-1"
        style={{
          background: `linear-gradient(to right, var(--color-brand) ${value}%, var(--color-surface-2) ${value}%)`,
        }}
      />
    </div>
  );
}

/**
 * The people invited along with the project.
 *
 * One row per colleague, starting with a single empty one so the fields are
 * visible without having to ask for them. Rows are kept in state rather than
 * read from `FormData`, because they are added and removed as the form is
 * filled in.
 */
function TeamMembersField({
  members,
  onChange,
}: {
  members: MemberDraft[];
  onChange: (next: MemberDraft[]) => void;
}) {
  const set = (index: number, patch: Partial<MemberDraft>) =>
    onChange(members.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  return (
    <div className="border-t border-line pt-4">
      <h3 className="text-[13px] font-semibold text-ink-2">Team members</h3>

      <div className="mt-3 flex flex-col gap-2.5">
        {members.map((member, i) => (
          <div
            key={i}
            className="flex items-end gap-2 rounded-xl border border-line bg-surface-5 p-3"
          >
            <div className="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-2">
              <Field
                label="Colleague name"
                value={member.name}
                onChange={(e) => set(i, { name: e.target.value })}
                placeholder="Name"
              />
              <Field
                label="Email"
                type="email"
                value={member.email}
                onChange={(e) => set(i, { email: e.target.value })}
                placeholder="name@university.edu"
              />
              <div className="sm:col-span-2">
                <RoleSelect
                  name={`role-${i}`}
                  value={member.role}
                  onChange={(role) => set(i, { role })}
                />
              </div>
            </div>
            {members.length > 1 ? (
              <IconAction
                icon="close"
                label={`Remove member ${i + 1}`}
                onClick={() => onChange(members.filter((_, index) => index !== i))}
              />
            ) : null}
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        icon="add"
        className="mt-2.5"
        onClick={() => onChange([...members, BLANK_MEMBER])}
      >
        Add another member
      </Button>
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

function ProjectCard({
  project,
  accepting,
  onAccept,
  onEdit,
  onDelete,
  onMembers,
  onMeetings,
}: {
  project: Project;
  accepting: boolean;
  onAccept: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMembers: () => void;
  onMeetings: () => void;
}) {
  const owner = project.myRole === 'OWNER';

  return (
    <Card className="h-full">
      <div className="flex items-start gap-3">
        {/* The title is the way in. Only the title, not the whole card: the
            card carries its own buttons, and nesting them inside a link is
            both invalid and a source of accidental navigation. */}
        <h2 className="min-w-0 flex-1 text-[15.5px] leading-snug font-bold">
          <Link
            to={`/projects/${project.id}`}
            className="transition hover:text-brand-ink hover:underline"
          >
            {project.name}
          </Link>
        </h2>
        <Pill tone={owner ? 'brand' : 'neutral'}>{humanise(project.myRole ?? 'VIEWER')}</Pill>
      </div>

      {project.description ? (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-3">
          {project.description}
        </p>
      ) : null}

      {/* An invitation is not information, it is a decision. The banner that
          announced it previously had no way to answer it. */}
      {project.invitePending ? (
        <div className="animate-fade-in mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-brand-tint px-3 py-2">
          <Icon name="mail" size={16} className="flex-none text-brand-deep" />
          <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-brand-deep">
            {project.owner?.name ?? project.owner?.email ?? 'Someone'} invited you as{' '}
            {(project.myRole ?? 'VIEWER').toLowerCase()}
          </span>
          <Button
            variant="brand"
            size="sm"
            icon="check"
            loading={accepting}
            onClick={onAccept}
            className="flex-none"
          >
            Accept
          </Button>
        </div>
      ) : null}

      {/* Progress is the one number the card exists to report, so it is set to
          be read at a glance rather than squinted at: the figure carries the
          brand colour and the track is thick enough to judge by shape alone. */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold text-ink-3">Progress</span>
          <span className="text-[16px] leading-none font-extrabold text-brand-deep tabular">
            {project.progress}%
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-700"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5">
        <button
          type="button"
          onClick={onMembers}
          className="press flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 transition hover:text-ink"
        >
          {project.owner ? (
            <PersonAvatar name={project.owner.name} email={project.owner.email} size={24} />
          ) : null}
          {project.memberCount ?? 0} {project.memberCount === 1 ? 'member' : 'members'}
        </button>

        <span className="ml-auto text-[11.5px] text-ink-4">{relative(project.updatedAt)}</span>

        {/* Meetings for everyone on the project — a viewer can read the log —
            and the two that change the project itself for its owner only. */}
        <IconAction icon="groups" label="Meetings" onClick={onMeetings} />
        {owner ? (
          <>
            <IconAction icon="edit" label="Edit project" onClick={onEdit} />
            <IconAction icon="delete" label="Delete project" onClick={onDelete} danger />
          </>
        ) : null}
      </div>
    </Card>
  );
}

function IconAction({
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
      className={`press grid size-8 flex-none place-items-center rounded-lg transition hover:bg-surface-2 ${
        danger ? 'text-ink-4 hover:text-danger' : 'text-ink-4 hover:text-ink'
      }`}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

/* ── Members ──────────────────────────────────────────────────────────────── */

/**
 * A member's access, changeable in place.
 *
 * Compact and label-less beside the name — the row already says whose it is,
 * and a full `Select` with its own label would double the row's height. The
 * accessible name comes from `label` instead.
 */
function MemberRoleSelect({
  role,
  label,
  disabled,
  onChange,
}: {
  role: AssignableRole;
  label: string;
  disabled: boolean;
  onChange: (role: AssignableRole) => void;
}) {
  return (
    <div className="relative flex-none">
      <select
        aria-label={label}
        value={role}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as AssignableRole)}
        className="h-8 cursor-pointer appearance-none rounded-lg border border-line-2 bg-surface py-0 pr-7 pl-2.5 text-[12.5px] font-semibold text-ink-2 outline-none transition hover:bg-surface-2 focus:border-brand disabled:opacity-50"
      >
        <option value="EDITOR">Editor</option>
        <option value="VIEWER">Viewer</option>
      </select>
      <Icon
        name="expand_more"
        size={15}
        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-ink-4"
      />
    </div>
  );
}

function MembersDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const toast = useToast();
  const { data, isPending } = useProjectMembers(project?.id ?? null);
  const { add, remove, updateRole } = useProjectMemberActions(project?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const members = data?.members ?? [];
  const canManage = project?.myRole === 'OWNER';

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Both read before the first `await`. React clears `currentTarget` once the
    // handler yields, so reaching for it afterwards threw — and the throw was
    // caught by the same `catch` as a failed request, so a member who had in
    // fact been invited was reported as "Could not add that member".
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    try {
      await add.mutateAsync({
        email: String(form.get('email') ?? '').trim(),
        name: String(form.get('name') ?? '').trim() || null,
        role: String(form.get('role') ?? 'VIEWER') as 'EDITOR' | 'VIEWER',
      });
      formEl.reset();
      toast.success('Invitation sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that member.');
    }
  }

  return (
    <Modal
      open={project !== null}
      onClose={onClose}
      title={project ? `Members of ${project.name}` : 'Members'}
      description="Editors can change the project. Viewers can read it."
    >
      {isPending ? (
        <div className="shimmer flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} h={52} radius={12} />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
            >
              <PersonAvatar name={member.name} email={member.email} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">
                  {member.name ?? member.email}
                </span>
                <span className="block truncate text-[12px] text-ink-3">{member.email}</span>
              </span>
              {/* The owner can move anyone else between editor and viewer at
                  any time — including while the invitation is still pending.
                  Everyone else, and the owner's own row, sees the badge. */}
              {canManage && member.role !== 'OWNER' ? (
                <MemberRoleSelect
                  role={member.role as AssignableRole}
                  label={`Access for ${member.name ?? member.email}`}
                  disabled={updateRole.isPending && updateRole.variables?.memberId === member.id}
                  onChange={(role) =>
                    void updateRole
                      .mutateAsync({ memberId: member.id, role })
                      .then(() =>
                        toast.success(
                          `${member.name ?? member.email} is now ${role === 'EDITOR' ? 'an editor' : 'a viewer'}`,
                        ),
                      )
                      .catch((err: unknown) =>
                        toast.error(
                          err instanceof ApiError ? err.message : 'Could not change that access.',
                        ),
                      )
                  }
                />
              ) : (
                <Pill tone={member.role === 'OWNER' ? 'brand' : 'neutral'}>
                  {humanise(member.role)}
                </Pill>
              )}
              {member.acceptedAt === null ? <Pill tone="warning">Pending</Pill> : null}
              {canManage && member.role !== 'OWNER' ? (
                <IconAction
                  icon="close"
                  label={`Remove ${member.email}`}
                  danger
                  onClick={() =>
                    void remove
                      .mutateAsync(member.id)
                      .then(() => toast.success('Member removed'))
                      .catch(() => toast.error('Could not remove that member.'))
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form onSubmit={onAdd} className="mt-5 border-t border-line pt-5" noValidate>
          <p className="text-[13px] font-semibold text-ink-2">Invite someone</p>
          {error ? <p className="mt-1.5 text-[12.5px] text-danger-ink">{error}</p> : null}

          {/* The same three fields as the create dialog, in the same order, so
              inviting someone is one thing to learn rather than two. */}
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <Field label="Colleague name" name="name" placeholder="Name" />
            <Field
              label="Email"
              name="email"
              type="email"
              required
              placeholder="name@university.edu"
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-end gap-2.5">
            <div className="min-w-[150px] flex-1">
              <RoleSelect name="role" defaultValue="VIEWER" />
            </div>
            <Button type="submit" variant="brand" size="sm" loading={add.isPending}>
              Invite
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
