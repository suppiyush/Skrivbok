/**
 * One project, and its brief.
 *
 * The brief is a document the team writes themselves: an ordered set of
 * headings and prose. It replaced 25 fixed fields — Objectives, Timeline,
 * Primary audience and so on — which decided in advance what a project was
 * allowed to say about itself. A literature review and a grant application are
 * not the same document, and neither fitted.
 *
 * Two modes on one page rather than a separate editor screen: reading and
 * writing a document are the same activity a minute apart, and a round trip
 * through another route loses your place in it.
 *
 * Printing is the export. The browser's own "Save as PDF" paginates properly,
 * embeds the fonts and needs no dependency — `@media print` in `index.css`
 * hides the chrome so what prints is the document and nothing else.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { Textarea } from '../components/ui/Form';
import { Icon } from '../components/ui/Icon';
import { Card, PageHeader, Pill } from '../components/ui/Layout';
import { ConfirmDialog } from '../components/ui/Modal';
import { Skeleton, useSlowLoad } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { ApiError, type Project } from '../lib/api';
import { humanise, longDate, relative } from '../lib/format';
import { projectHooks, useProjectBrief, useSaveBrief } from '../lib/queries';
import { ProjectMeetings } from './ProjectMeetings';

/** A section being edited. `key` is local and exists only to keep React rows
 *  stable while they are reordered — a new section has no id yet. */
interface DraftSection {
  key: string;
  heading: string;
  body: string;
}

let nextKey = 0;
const newSection = (heading = '', body = ''): DraftSection => ({
  key: `s${(nextKey += 1)}`,
  heading,
  body,
});

/**
 * Headings offered when the brief is empty.
 *
 * A blank page is the hardest thing to start, and these are the sections most
 * research projects turn out to want. They are a starting point, not a
 * template: every one can be renamed or deleted.
 */
const SUGGESTED = [
  'Project overview',
  'Objectives',
  'Background',
  'Method',
  'Timeline',
  'Expected outcomes',
];

export default function ProjectDetail() {
  const { id = null } = useParams<{ id: string }>();
  const toast = useToast();

  const list = projectHooks.useList({ limit: 100 });
  const briefQuery = useProjectBrief(id);
  const save = useSaveBrief(id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftSection[]>([]);
  const [discarding, setDiscarding] = useState(false);

  const project = ((list.data?.data ?? []) as Project[]).find((p) => p.id === id) ?? null;
  const brief = briefQuery.data?.brief ?? null;
  const sections = useMemo(() => brief?.sections ?? [], [brief]);

  const loading = list.isPending || briefQuery.isPending;
  const showSkeleton = useSlowLoad(loading);
  const canEdit = project?.myRole === 'OWNER' || project?.myRole === 'EDITOR';

  // Leaving the page mid-edit should not leave the draft behind for the next
  // project opened in the same session.
  useEffect(() => {
    setEditing(false);
    setDraft([]);
  }, [id]);

  function startEditing() {
    setDraft(
      sections.length > 0
        ? sections.map((s) => newSection(s.heading, s.body))
        : SUGGESTED.map((heading) => newSection(heading)),
    );
    setEditing(true);
  }

  /** True when the draft says something different from what is saved. */
  const dirty =
    editing &&
    (draft.length !== sections.length ||
      draft.some(
        (d, i) => d.heading !== sections[i]?.heading || d.body !== (sections[i]?.body ?? ''),
      ));

  async function onSave() {
    // A heading is what makes a section findable, so one without it is not
    // saved. An empty body is fine — a heading you have not written under yet
    // is a normal state in a draft.
    const payload = draft
      .filter((s) => s.heading.trim() !== '')
      .map((s) => ({ heading: s.heading.trim(), body: s.body }));

    try {
      await save.mutateAsync(payload);
      setEditing(false);
      setDraft([]);
      toast.success('Brief saved');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the brief.');
    }
  }

  const update = (index: number, patch: Partial<DraftSection>) =>
    setDraft((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const move = (index: number, by: -1 | 1) =>
    setDraft((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved as DraftSection);
      return next;
    });

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

  return (
    <AppShell>
      {/* `print-document` marks the one subtree that survives printing. */}
      <div className="no-print">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 transition hover:text-ink"
        >
          <Icon name="arrow_back" size={16} />
          All projects
        </Link>
      </div>

      <div className="no-print">
        <PageHeader
          title={project.name}
          crumbs={[{ label: 'Projects', to: '/projects' }, { label: project.name }]}
          icon="folder_open"
          {...(project.description ? { description: project.description } : {})}
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={project.myRole === 'OWNER' ? 'brand' : 'neutral'}>
                {humanise(project.myRole ?? 'VIEWER')}
              </Pill>
              <span className="text-[12.5px] text-ink-3">
                {project.progress}% complete · edited {relative(project.updatedAt)}
              </span>
            </div>
          }
          actions={
            editing ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => (dirty ? setDiscarding(true) : setEditing(false))}
                >
                  Cancel
                </Button>
                <Button
                  variant="brand"
                  size="sm"
                  icon="check"
                  loading={save.isPending}
                  onClick={() => void onSave()}
                >
                  Save brief
                </Button>
              </>
            ) : /* Both of these are about a brief that exists. While there is
                   none, the empty state below makes the only offer worth
                   making — "Write the brief" — and repeating it up here as
                   "Edit brief" would be the same button twice, under two
                   names, for a document with nothing in it. */
            sections.length > 0 ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="download"
                  onClick={() => window.print()}
                >
                  Download PDF
                </Button>
                {canEdit ? (
                  <Button variant="brand" size="sm" icon="edit_note" onClick={startEditing}>
                    Edit brief
                  </Button>
                ) : null}
              </>
            ) : null
          }
        />
      </div>

      {editing ? (
        <SectionEditor
          draft={draft}
          onChange={update}
          onMove={move}
          onRemove={(i) => setDraft((c) => c.filter((_, index) => index !== i))}
          onAdd={() => setDraft((c) => [...c, newSection()])}
        />
      ) : sections.length === 0 ? (
        <div className="no-print">
          <EmptyState
            icon="description"
            title="No brief yet"
            {...(canEdit
              ? {
                  action: (
                    <Button variant="brand" icon="edit_note" onClick={startEditing}>
                      Write the brief
                    </Button>
                  ),
                }
              : {})}
          >
            {canEdit
              ? 'Set out what this project is: its aims, its method, whatever the work needs recording. You choose the sections.'
              : 'Nobody has written this project’s brief yet.'}
          </EmptyState>
        </div>
      ) : (
        /* The printed document. The heading block only appears on paper, where
           there is no page around it to say which project this belongs to. */
        <article className="print-document">
          <header className="hidden print:mb-8 print:block">
            <h1 className="text-[26px] font-extrabold">{project.name}</h1>
            <p className="mt-1 text-[13px] text-ink-3">
              {project.description ? `${project.description} · ` : ''}
              {longDate(new Date())}
            </p>
          </header>

          <Card className="print:border-0 print:p-0">
            {sections.map((section, i) => (
              <section key={section.id} className={i > 0 ? 'mt-7' : ''}>
                <h2 className="text-[17px] font-bold tracking-[-0.01em]">{section.heading}</h2>
                {section.body.trim() === '' ? (
                  <p className="mt-1.5 text-[14px] text-ink-5 italic no-print">
                    Nothing written yet
                  </p>
                ) : (
                  /* `whitespace-pre-wrap` keeps the author's paragraphs without
                     interpreting their text as markup. */
                  <p className="mt-1.5 text-[14.5px] leading-[1.75] whitespace-pre-wrap text-ink-2">
                    {section.body}
                  </p>
                )}
              </section>
            ))}
          </Card>

          {brief ? (
            <p className="mt-3 text-[12px] text-ink-4 no-print">
              Brief last edited {relative(brief.updatedAt)}
            </p>
          ) : null}
        </article>
      )}

      {/* Below the brief, and out of the way while the brief is being written:
          the editor is a document to concentrate on, and a second section
          under it would only be somewhere to lose the scroll position. */}
      {!editing ? (
        <ProjectMeetings projectId={project.id} projectName={project.name} canEdit={canEdit} />
      ) : null}

      <ConfirmDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        onConfirm={() => {
          setDiscarding(false);
          setEditing(false);
          setDraft([]);
        }}
        title="Discard your changes?"
        what={`Unsaved edits to ${project.name}`}
        confirmLabel="Discard"
      />
    </AppShell>
  );
}

/* ── Editor ───────────────────────────────────────────────────────────────── */

function SectionEditor({
  draft,
  onChange,
  onMove,
  onRemove,
  onAdd,
}: {
  draft: DraftSection[];
  onChange: (index: number, patch: Partial<DraftSection>) => void;
  onMove: (index: number, by: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="no-print flex flex-col gap-3">
      {draft.map((section, i) => (
        <Card key={section.key} className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field
                label={`Section ${i + 1}`}
                value={section.heading}
                onChange={(e) => onChange(i, { heading: e.target.value })}
                placeholder="Heading"
              />
            </div>

            {/* Buttons rather than drag: a keyboard can press these, and a
                long document is easier to reorder a step at a time than to
                drag past a scrolling edge. */}
            <div className="flex flex-none items-center gap-1">
              <IconButton
                icon="arrow_upward"
                label={`Move “${section.heading || `section ${i + 1}`}” up`}
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
              />
              <IconButton
                icon="arrow_downward"
                label={`Move “${section.heading || `section ${i + 1}`}” down`}
                disabled={i === draft.length - 1}
                onClick={() => onMove(i, 1)}
              />
              <IconButton
                icon="delete"
                label={`Remove “${section.heading || `section ${i + 1}`}”`}
                danger
                onClick={() => onRemove(i)}
              />
            </div>
          </div>

          <Textarea
            label="Content"
            rows={6}
            value={section.body}
            onChange={(e) => onChange(i, { body: e.target.value })}
            placeholder="Write this section."
          />
        </Card>
      ))}

      <Button variant="secondary" icon="add" className="self-start" onClick={onAdd}>
        Add section
      </Button>

      {draft.length === 0 ? (
        <p className="text-[13px] text-ink-3">
          The brief is empty. Add a section, or save to leave it blank.
        </p>
      ) : null}
    </div>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`press grid size-9 place-items-center rounded-lg text-ink-4 transition hover:bg-surface-2 disabled:opacity-35 disabled:hover:bg-transparent ${
        danger ? 'hover:text-danger' : 'hover:text-ink'
      }`}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
