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
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { Textarea } from '../components/ui/Form';
import { Icon } from '../components/ui/Icon';
import { Card, PageHeader, Pagination, Pill, SearchInput, Toolbar } from '../components/ui/Layout';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { Reveal } from '../components/ui/Motion';
import { Skeleton, useSlowLoad } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { ApiError, type Project } from '../lib/api';
import { initials, relative } from '../lib/format';
import {
  projectHooks,
  useAcceptInvite,
  useProjectMemberActions,
  useProjectMembers,
  useProjectQuota,
} from '../lib/queries';
import { QuotaMeter } from './ResourceScreen';

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
  const [archived, setArchived] = useState(false);
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
      ...(archived ? { archived: 'true' } : {}),
      ...(search ? { search } : {}),
    }),
    [page, scope, archived, search],
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

  /**
   * The quota is waited on as well as the list.
   *
   * It decides whether the header carries a usage meter, and it answers on its
   * own schedule — so showing the list first means the meter drops in
   * afterwards and shoves everything below it down the page. Holding the body
   * until both have answered lets the header reach its final height while
   * there is still nothing underneath to displace.
   */
  const loading = list.isPending || quota.isPending;
  // Nothing is drawn for a wait too short to read — see `useSlowLoad`.
  const showSkeleton = useSlowLoad(loading);

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
      if (editing) await update.mutateAsync({ id: editing.id, input });
      else await create.mutateAsync(input);
      toast.success(editing ? 'Project updated' : 'Project created');
      setEditing(undefined);
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
        description="Each project keeps its own members, progress and notes. Invite colleagues by email with view or edit access."
        meta={limit?.limited ? <QuotaMeter status={limit} /> : undefined}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="add"
            disabled={atLimit}
            onClick={() => setEditing(null)}
          >
            New project
          </Button>
        }
      />

      <Toolbar>
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

        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search projects" />

        <button
          type="button"
          onClick={() => {
            setArchived((v) => !v);
            setPage(1);
          }}
          className={`press flex h-10 flex-none items-center gap-1.5 rounded-xl border px-3.5 text-[13.5px] font-medium transition ${
            archived
              ? 'border-brand bg-brand-tint text-brand-deep'
              : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
          }`}
        >
          <Icon name="inventory_2" size={17} />
          Archived
        </button>
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
          <Button variant="primary" size="sm" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </Card>
      ) : projects.length === 0 ? (
        <EmptyState
          icon="folder_open"
          title={search || scope !== 'all' || archived ? 'Nothing matches' : 'No projects yet'}
          action={
            <Button variant="primary" icon="add" onClick={() => setEditing(null)}>
              New project
            </Button>
          }
        >
          {search || scope !== 'all' || archived
            ? 'Try a different search, or switch back to All.'
            : 'A project holds the members, progress and brief for one piece of work.'}
        </EmptyState>
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
                  onArchive={() =>
                    void update
                      .mutateAsync({
                        id: project.id,
                        input: { archived: project.archivedAt === null },
                      })
                      .then(() =>
                        toast.success(project.archivedAt ? 'Project restored' : 'Project archived'),
                      )
                      .catch(() => toast.error('Could not change that project.'))
                  }
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
        onClose={() => setEditing(undefined)}
        title={editing ? 'Edit project' : 'New project'}
        onSubmit={onSubmit}
        busy={saving}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(undefined)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              {editing ? 'Save changes' : 'Create project'}
            </Button>
          </>
        }
      >
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
            rows={4}
            defaultValue={editing?.description ?? ''}
            error={fieldErrors['description']}
          />
          <Field
            label="Progress"
            name="progress"
            type="number"
            min={0}
            max={100}
            defaultValue={editing?.progress ?? 0}
            hint="A whole percentage, 0 to 100."
            error={fieldErrors['progress']}
          />
        </div>
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

/* ── Card ─────────────────────────────────────────────────────────────────── */

function ProjectCard({
  project,
  accepting,
  onAccept,
  onEdit,
  onDelete,
  onMembers,
  onArchive,
}: {
  project: Project;
  accepting: boolean;
  onAccept: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMembers: () => void;
  onArchive: () => void;
}) {
  const owner = project.myRole === 'OWNER';
  const archived = project.archivedAt !== null;

  return (
    <Card className={`h-full ${archived ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 text-[15.5px] leading-snug font-bold">{project.name}</h2>
        <Pill tone={owner ? 'brand' : 'neutral'}>{(project.myRole ?? 'VIEWER').toLowerCase()}</Pill>
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
            variant="primary"
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

      <div className="mt-4">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-ink-3">Progress</span>
          <span className="font-mono text-ink-3 tabular">{project.progress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
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
          <span className="grid size-6 place-items-center rounded-full bg-brand-avatar text-[10px] font-bold text-brand-avatar-ink">
            {initials(project.owner?.name ?? project.owner?.email)}
          </span>
          {project.memberCount ?? 0} {project.memberCount === 1 ? 'member' : 'members'}
        </button>

        <span className="ml-auto text-[11.5px] text-ink-4">{relative(project.updatedAt)}</span>

        {owner ? (
          <>
            <IconAction icon="edit" label="Edit project" onClick={onEdit} />
            <IconAction
              icon={archived ? 'unarchive' : 'inventory_2'}
              label={archived ? 'Restore project' : 'Archive project'}
              onClick={onArchive}
            />
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

function MembersDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const toast = useToast();
  const { data, isPending } = useProjectMembers(project?.id ?? null);
  const { add, remove } = useProjectMemberActions(project?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const members = data?.members ?? [];
  const canManage = project?.myRole === 'OWNER';

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      await add.mutateAsync({
        email: String(form.get('email') ?? '').trim(),
        role: (String(form.get('role') ?? 'VIEWER') as 'EDITOR' | 'VIEWER') ?? 'VIEWER',
      });
      event.currentTarget.reset();
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
              <span className="grid size-8 flex-none place-items-center rounded-full bg-brand-avatar text-[11px] font-bold text-brand-avatar-ink">
                {initials(member.name ?? member.email)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">
                  {member.name ?? member.email}
                </span>
                <span className="block truncate text-[12px] text-ink-3">{member.email}</span>
              </span>
              <Pill tone={member.role === 'OWNER' ? 'brand' : 'neutral'}>
                {member.role.toLowerCase()}
              </Pill>
              {member.acceptedAt === null ? <Pill tone="warning">pending</Pill> : null}
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="colleague@university.edu"
              className="h-10 min-w-[200px] flex-1 rounded-xl border border-line-2 bg-surface px-3.5 text-[14px] outline-none focus:border-brand"
            />
            <select
              name="role"
              defaultValue="VIEWER"
              className="h-10 flex-none cursor-pointer rounded-xl border border-line-2 bg-surface px-3 text-[13.5px] outline-none focus:border-brand"
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
            </select>
            <Button type="submit" variant="primary" size="sm" loading={add.isPending}>
              Invite
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
