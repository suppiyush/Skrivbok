/**
 * The seven single-owner resources, as configuration.
 *
 * Each is a `ResourceConfig`: how to load it, how a row reads, what the form
 * contains, and how that form becomes a request body. The screen itself lives
 * in `ResourceScreen.tsx` and is shared.
 *
 * `toInput` is the only place that translates between the DOM and the API. It
 * sends `null` rather than `''` for cleared optional text, because the backend
 * treats an empty string as a value and `null` as "unset".
 */
import { useId, useState, type FormEvent } from 'react';
import { AudioPlayer } from '../components/ui/AudioPlayer';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Checkbox, FieldRow, Select, TagInput, Textarea } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { Icon } from '../components/ui/Icon';
import {
  ApiError,
  literature as literatureApi,
  type CareerGoal,
  type Deadline,
  type FutureWork as FutureWorkItem,
  type Idea,
  type Literature as LiteratureEntry,
  type Note,
} from '../lib/api';
import { clock, dateInputValue, dueLabel, humanise, shortAge, timeInputValue } from '../lib/format';
import {
  careerGoalHooks,
  deadlineHooks,
  futureWorkHooks,
  ideaHooks,
  literatureHooks,
  noteHooks,
  useCareerGoalEdit,
  useCareerQuota,
  useCareerSummary,
  useGoalHistory,
  useLiteratureTags,
  useRecordStage,
} from '../lib/queries';
import { MetricCard, Pill } from '../components/ui/Layout';
import { ResourceScreen, RowAction, useFieldError, type ResourceConfig } from './ResourceScreen';
import { VoiceNoteButton } from './VoiceNote';

/* ── Shared option lists ──────────────────────────────────────────────────── */

/** Names for the swatches. A lookup, not a list of options — nothing selects
 *  from it now that colour is chosen by clicking a circle. */
const COLOUR_LABEL: Record<string, string> = {
  YELLOW: 'Yellow',
  BLUE: 'Blue',
  GREEN: 'Green',
  PINK: 'Pink',
  PURPLE: 'Purple',
  ORANGE: 'Orange',
  GRAY: 'Grey',
};

/**
 * Sticky-note tints.
 *
 * Set as alpha over the card rather than as flat hex, so a note picks up the
 * warm paper behind it instead of sitting on it as a separate sheet — and so
 * one set of values works if the canvas ever changes.
 *
 * Deliberately pale. Ink at full strength has to stay legible on every one of
 * them: a note you cannot read is worse than a white one.
 */
const NOTE_TINT: Record<string, string> = {
  YELLOW: 'rgb(255 214 10 / 0.20)',
  GREEN: 'rgb(6 214 160 / 0.18)',
  PINK: 'rgb(255 105 160 / 0.16)',
  PURPLE: 'rgb(150 100 220 / 0.16)',
  BLUE: 'rgb(17 138 178 / 0.15)',
  // Not offered when choosing, but records written before the palette was
  // settled still carry them and still have to draw.
  ORANGE: 'rgb(255 127 80 / 0.18)',
  GRAY: 'rgb(11 15 25 / 0.06)',
};

/** The five offered when picking. `NOTE_TINT` renders more than this. */
const NOTE_COLOURS = ['YELLOW', 'GREEN', 'PINK', 'PURPLE', 'BLUE'];

/** Shared by ideas and notes — the two resources that are filed by subject. */
const CATEGORIES = ['business', 'creative', 'general', 'personal', 'research', 'technology'];

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

/** The time a new deadline opens on, when the user has not said otherwise. */
const DEFAULT_DUE_TIME = '17:00';

const DEADLINE_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** Priority as a pill tone. Urgent is the only one that gets to shout. */
const PRIORITY_TONE = {
  URGENT: 'danger',
  HIGH: 'warning',
  MEDIUM: 'neutral',
  LOW: 'neutral',
} as const;

/* ── Form helpers ─────────────────────────────────────────────────────────── */

/** Trimmed string, or null when the user cleared the field. */
function text(form: FormData, name: string): string | null {
  const value = String(form.get(name) ?? '').trim();
  return value === '' ? null : value;
}

/** Required string. Left as-is so the server does the validating and reporting. */
function required(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

/**
 * A date box and a time box, back into the one instant the API takes.
 *
 * Both halves are wall-clock with no zone, and the browser's zone is the one
 * the user typed them in — so they are resolved here and sent as an instant.
 * A missing time means midnight; the server requires the date, so that is the
 * half worth reporting an error against.
 */
function instantFrom(form: FormData, dateName: string, timeName: string): string {
  const date = String(form.get(dateName) ?? '').trim();
  if (!date) return '';

  const time = String(form.get(timeName) ?? '').trim() || '00:00';
  const at = new Date(`${date}T${time}`);
  return Number.isNaN(at.getTime()) ? '' : at.toISOString();
}

/** Errors are reported by the server against the field name. */
function Err(name: string) {
  return useFieldError(name);
}

/**
 * The colour of a note, as swatches.
 *
 * Radio inputs rather than buttons with state: the dialog reads its values out
 * of `FormData` on submit, so the native control is what makes this work
 * without lifting any state into the screen. A radio also gets arrow-key
 * movement and a group role for free.
 *
 * A record whose colour is not one of the five still gets a swatch, appended.
 * Dropping it would leave nothing selected, and saving would then rewrite a
 * colour the author had chosen.
 */
function ColourSwatches({ selected }: { selected: string }) {
  const offered = NOTE_COLOURS.includes(selected) ? NOTE_COLOURS : [...NOTE_COLOURS, selected];

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[13px] font-semibold text-ink-2">Colour</legend>
      {/* `h-11` matches the control height of the field beside it, so the
          swatches sit on the same centre line rather than at the top of a row
          sized by a taller neighbour. */}
      <div className="flex h-11 flex-wrap items-center gap-2">
        {offered.map((colour) => (
          <label
            key={colour}
            title={COLOUR_LABEL[colour] ?? colour}
            className="group relative cursor-pointer"
          >
            <input
              type="radio"
              name="color"
              value={colour}
              defaultChecked={colour === selected}
              className="peer sr-only"
            />
            <span
              className="block size-7 rounded-full border border-line-2 transition peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2"
              style={{ background: NOTE_TINT[colour] ?? NOTE_TINT['GRAY'] }}
            />
            <span className="sr-only">{COLOUR_LABEL[colour] ?? colour}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The category list, plus whatever this record already says.
 *
 * The six are fixed, but the field has always accepted free text and older
 * records carry values outside the list. A select that silently drops one
 * would rewrite it to the first option the moment that record was edited for
 * any other reason.
 */
function categoryOptions(current: string | undefined) {
  const values = current && !CATEGORIES.includes(current) ? [...CATEGORIES, current] : CATEGORIES;

  return values.map((value) => ({ value, label: humanise(value) }));
}

/**
 * The category filter shared by ideas and notes.
 *
 * The six fixed categories, not the ones in use: the API filters on an exact
 * value, and the select's own first option ("Category") is what clears it.
 */
const CATEGORY_FILTER = {
  name: 'category',
  label: 'Category',
  options: CATEGORIES.map((value) => ({ value, label: humanise(value) })),
};

/* ── Ideas ────────────────────────────────────────────────────────────────── */

const ideasConfig: ResourceConfig<Idea> = {
  title: 'Ideas',
  icon: 'lightbulb',
  noun: 'idea',
  blurb:
    'Anything worth keeping, recorded before it goes. Categorise and colour them, then search across everything you have written.',
  createLabel: 'Add idea',
  hooks: ideaHooks as never,
  filters: [CATEGORY_FILTER],
  sorts: [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'title', label: 'Title' },
  ],
  row: (idea) => ({
    primary: idea.title,
    secondary: idea.content,
    tag: idea.category,
    meta: shortAge(idea.createdAt),
  }),
  // Ideas are the one resource drawn as cards. Choosing a colour only ever
  // meant anything if the colour is what you see.
  card: (idea) => ({
    tint: NOTE_TINT[idea.color] ?? NOTE_TINT['YELLOW'] ?? 'transparent',
    primary: idea.title,
    secondary: idea.content,
    badge: idea.category,
    meta: shortAge(idea.createdAt),
  }),
  form: (idea) => (
    <>
      <Field
        label="Title"
        name="title"
        defaultValue={idea?.title ?? ''}
        required
        error={Err('title')}
      />
      {/* Category and colour above the details: both are one decision each,
          and putting them after a six-line textarea buries them under the
          part that takes the longest to write. */}
      <FieldRow>
        <Select
          label="Category"
          name="category"
          defaultValue={idea?.category ?? 'general'}
          options={categoryOptions(idea?.category)}
          error={Err('category')}
        />
        <ColourSwatches selected={idea?.color ?? 'YELLOW'} />
      </FieldRow>
      <Textarea
        label="Details"
        name="content"
        rows={5}
        defaultValue={idea?.content ?? ''}
        placeholder="What is the idea, and what would it take?"
        error={Err('content')}
      />
    </>
  ),
  toInput: (form) => ({
    title: required(form, 'title'),
    content: text(form, 'content'),
    category: text(form, 'category') ?? 'general',
    color: form.get('color') ?? 'YELLOW',
  }),
  emptyTitle: 'No ideas yet',
  emptyBody:
    'The first one is usually the hardest. Write down the next thing you would work on if you had a free week.',
};

/* ── Notes ────────────────────────────────────────────────────────────────── */

const notesConfig: ResourceConfig<Note> = {
  title: 'Notes',
  icon: 'sticky_note_2',
  noun: 'note',
  blurb: 'Longer working notes — a method, a summary, a half-finished argument.',
  // "Add text note", because it is no longer the only kind. The voice button sits
  // beside it and owns its own recorder and dialog.
  createLabel: 'Add text note',
  extraAction: () => <VoiceNoteButton />,
  hooks: noteHooks as never,
  filters: [CATEGORY_FILTER],
  sorts: [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'title', label: 'Title' },
  ],
  row: (note) => ({
    primary: note.title,
    secondary: note.audioUrl ? `Recording · ${clock(note.audioSeconds ?? 0)}` : note.content,
    // A voice note is not filed under anything — see the card below.
    ...(note.audioUrl ? {} : { tag: note.category }),
    meta: shortAge(note.updatedAt),
  }),
  // Plain cards, not sticky notes: a note is filed and found by its title and
  // category, not recognised by colour across a wall. No `tint`, so the card
  // stays a panel — shorter, and no fold.
  card: (note) => ({
    primary: note.title,
    // A voice note carries no category and shows no body: the player below is
    // the content, and it already says how long the recording runs.
    ...(note.audioUrl
      ? { audioUrl: note.audioUrl, audioSeconds: note.audioSeconds }
      : { secondary: note.content, badge: note.category }),
    meta: shortAge(note.updatedAt),
  }),
  form: (note) => (
    <>
      <Field
        label="Title"
        name="title"
        defaultValue={note?.title ?? ''}
        required
        error={Err('title')}
      />
      {note?.audioUrl ? (
        // Editing a recording means retitling it, so the clip is here to be
        // heard while you do. There is nothing else about it to change.
        <AudioPlayer
          src={note.audioUrl}
          seconds={note.audioSeconds}
          className="rounded-xl border border-line bg-surface-5 px-3 py-2.5"
        />
      ) : (
        <>
          {/* Category before the body, as on an idea: it is one decision, and a
              seven-row textarea buries anything under it. */}
          <Select
            label="Category"
            name="category"
            defaultValue={note?.category ?? 'general'}
            options={categoryOptions(note?.category)}
            error={Err('category')}
          />
          <Textarea
            label="Note"
            name="content"
            rows={7}
            defaultValue={note?.content ?? ''}
            error={Err('content')}
          />
        </>
      )}
    </>
  ),
  // No `color`. The column still exists and still defaults to YELLOW on the
  // server, but a note does not ask for one, so nothing is sent: create takes
  // the default, and update leaves whatever is stored alone.
  //
  // Only the fields the form actually offered are sent. A voice note's form has
  // neither a category nor a body, and `text()` reads a missing field as null —
  // so sending them unconditionally would blank both on every save.
  toInput: (form) => ({
    title: required(form, 'title'),
    ...(form.has('content') ? { content: text(form, 'content') } : {}),
    ...(form.has('category') ? { category: text(form, 'category') ?? 'general' } : {}),
  }),
  emptyTitle: 'No notes yet',
  emptyBody: 'Notes hold the longer writing — a method, a summary, a half-finished argument.',
};

/* ── Deadlines ────────────────────────────────────────────────────────────── */

const deadlinesConfig: ResourceConfig<Deadline> = {
  title: 'Deadlines',
  icon: 'flag',
  noun: 'deadline',
  blurb:
    'Everything with a date attached. Reminders arrive at the hour you chose, in the timezone you set.',
  createLabel: 'Add deadline',
  hooks: deadlineHooks as never,
  filters: [
    { name: 'status', label: 'Status', options: DEADLINE_STATUSES },
    { name: 'priority', label: 'Priority', options: PRIORITIES },
    { name: 'overdue', label: 'Overdue', options: [{ value: 'true', label: 'Overdue only' }] },
  ],
  sorts: [
    { value: 'dueSoonest', label: 'Due soonest' },
    { value: 'dueLatest', label: 'Due latest' },
    { value: 'priority', label: 'Priority' },
    { value: 'newest', label: 'Newest' },
  ],
  row: (deadline) => {
    const due = dueLabel(deadline.dueAt);
    const done = deadline.status === 'COMPLETED';
    return {
      primary: deadline.title,
      secondary: done ? 'Completed' : (due?.text ?? null),
      tag: humanise(deadline.priority),
      tone: done ? 'success' : (due?.tone ?? PRIORITY_TONE[deadline.priority]),
      meta: humanise(deadline.status),
    };
  },
  form: (deadline) => (
    <>
      <Field
        label="Title"
        name="title"
        defaultValue={deadline?.title ?? ''}
        required
        error={Err('title')}
      />
      <Textarea
        label="Description"
        name="description"
        rows={3}
        defaultValue={deadline?.description ?? ''}
        error={Err('description')}
      />
      {/* Two boxes rather than one `datetime-local`. The combined control is a
          single tab stop the browser splits into segments in its own order, and
          it is the one field people most often leave half-filled. The date is
          also the half that carries the server's error, since a deadline
          without one cannot be saved at all. */}
      <FieldRow>
        <Field
          label="Due date"
          name="dueDate"
          type="date"
          defaultValue={dateInputValue(deadline?.dueAt)}
          required
          error={Err('dueAt')}
        />
        <Field
          label="Due time"
          name="dueTime"
          type="time"
          // End of the working day, for a new one. A deadline almost always
          // means "by the end of that day", and a time box that opens empty is
          // one more decision for the commonest answer.
          defaultValue={timeInputValue(deadline?.dueAt) || DEFAULT_DUE_TIME}
          required
        />
      </FieldRow>
      <FieldRow>
        <Select
          label="Priority"
          name="priority"
          defaultValue={deadline?.priority ?? 'MEDIUM'}
          options={PRIORITIES}
        />
        <Select
          label="Status"
          name="status"
          defaultValue={deadline?.status ?? 'PENDING'}
          options={DEADLINE_STATUSES}
        />
      </FieldRow>
      <Checkbox
        name="reminderEnabled"
        label="Email me a reminder"
        hint="Sent at the notification time and days you set under Settings."
        defaultChecked={deadline?.reminderEnabled ?? true}
      />
    </>
  ),
  toInput: (form) => ({
    title: required(form, 'title'),
    description: text(form, 'description'),
    dueAt: instantFrom(form, 'dueDate', 'dueTime'),
    // The browser's zone is the one the user typed the local time in.
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    priority: form.get('priority'),
    status: form.get('status'),
    reminderEnabled: form.get('reminderEnabled') === 'on',
  }),
  emptyTitle: 'Nothing is due',
  emptyBody: 'Add the next submission, review or report and it will appear on your calendar too.',
};

/* ── Future work ──────────────────────────────────────────────────────────── */

const futureWorkConfig: ResourceConfig<FutureWorkItem> = {
  title: 'Future work',
  icon: 'rocket_launch',
  noun: 'item',
  blurb:
    'The work you intend to do but have not scheduled. Timelines here are deliberately loose — "next semester" is a valid answer.',
  createLabel: 'Add item',
  hooks: futureWorkHooks as never,
  filters: [{ name: 'priority', label: 'Priority', options: PRIORITIES }],
  sorts: [
    { value: 'newest', label: 'Newest' },
    { value: 'priority', label: 'Priority' },
    { value: 'title', label: 'Title' },
  ],
  row: (item) => ({
    primary: item.title,
    secondary: item.description,
    tag: humanise(item.priority),
    tone: PRIORITY_TONE[item.priority],
    meta: item.timeline ?? shortAge(item.createdAt),
  }),
  form: (item) => (
    <>
      <Field
        label="Title"
        name="title"
        defaultValue={item?.title ?? ''}
        required
        error={Err('title')}
      />
      <Textarea
        label="Description"
        name="description"
        rows={4}
        defaultValue={item?.description ?? ''}
        error={Err('description')}
      />
      <FieldRow>
        <Select
          label="Priority"
          name="priority"
          defaultValue={item?.priority ?? 'MEDIUM'}
          options={PRIORITIES}
        />
        <Field
          label="Timeline"
          name="timeline"
          defaultValue={item?.timeline ?? ''}
          placeholder="Next semester"
          error={Err('timeline')}
        />
      </FieldRow>
    </>
  ),
  toInput: (form) => ({
    title: required(form, 'title'),
    description: text(form, 'description'),
    priority: form.get('priority'),
    timeline: text(form, 'timeline'),
  }),
  emptyTitle: 'Nothing planned yet',
  emptyBody:
    'Park the things you want to come back to. They stay out of the way until they matter.',
};

/* ── Literature ───────────────────────────────────────────────────────────── */

const literatureConfig: ResourceConfig<LiteratureEntry> = {
  title: 'Literature',
  icon: 'auto_stories',
  noun: 'entry',
  blurb:
    'Your reading, with authors, year, links, tags and your own summary. Filter by any combination of tags.',
  createLabel: 'Add entry',
  // The whole library, whatever the list is filtered to. A plain navigation:
  // the response is an attachment, so the browser saves it and stays put.
  extraAction: () => (
    <Button
      variant="secondary"
      size="sm"
      icon="download"
      onClick={() => window.location.assign(literatureApi.exportUrl)}
    >
      Download CSV
    </Button>
  ),
  hooks: literatureHooks as never,
  sorts: [
    { value: 'newest', label: 'Newest' },
    { value: 'year', label: 'Year' },
    { value: 'title', label: 'Title' },
  ],
  row: (entry) => ({
    primary: entry.title,
    secondary: [entry.authors, entry.year].filter(Boolean).join(' · ') || entry.summary,
    tag: entry.tags[0],
    tone: 'brand',
    meta: entry.links.length
      ? `${entry.links.length} link${entry.links.length > 1 ? 's' : ''}`
      : '',
  }),
  // The register from design/literature-1: the fields you scan a reading list
  // by, side by side, instead of a title with the rest folded under it.
  table: [
    {
      header: 'Title',
      className: 'w-[26%]',
      cell: (entry, open) => (
        <button
          type="button"
          onClick={open}
          className="text-left text-[14px] leading-snug font-semibold text-brand-ink transition hover:underline"
        >
          {entry.title}
        </button>
      ),
    },
    {
      header: 'Links',
      className: 'w-[13%]',
      cell: (entry) =>
        entry.links.length === 0 ? (
          <span className="text-[13px] text-ink-5">—</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.links.slice(0, 3).map((href, i) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={href}
                aria-label={`Open link ${i + 1} for ${entry.title}`}
                className="press grid size-8 place-items-center rounded-lg bg-brand-tint text-brand-ink transition hover:brightness-95"
              >
                <Icon name="link" size={17} />
              </a>
            ))}
            {entry.links.length > 3 ? (
              <span className="text-[12px] font-semibold text-ink-4">
                +{entry.links.length - 3}
              </span>
            ) : null}
          </div>
        ),
    },
    {
      header: 'Tags',
      className: 'w-[22%]',
      cell: (entry) =>
        entry.tags.length === 0 ? (
          <span className="text-[13px] text-ink-5">—</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>
        ),
    },
    {
      header: 'Summary',
      cell: (entry) =>
        entry.summary ? (
          <p className="line-clamp-2 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-3">
            {entry.summary}
          </p>
        ) : (
          <span className="text-[13px] text-ink-5">—</span>
        ),
    },
  ],
  form: (entry) => (
    <>
      <Field
        label="Title"
        name="title"
        defaultValue={entry?.title ?? ''}
        required
        error={Err('title')}
      />
      <FieldRow>
        <Field
          label="Authors"
          name="authors"
          defaultValue={entry?.authors ?? ''}
          placeholder="Ongaro, Ousterhout"
          error={Err('authors')}
        />
        <Field
          label="Year"
          name="year"
          type="number"
          defaultValue={entry?.year ?? ''}
          error={Err('year')}
        />
      </FieldRow>
      <TagInput
        label="Tags"
        name="tags"
        defaultValue={entry?.tags ?? []}
        placeholder="consensus, raft"
        hint="A comma or Enter makes a tag. Tags are lowercased so they group properly."
        error={Err('tags')}
        lowercase
      />
      <Field
        label="Links"
        name="links"
        defaultValue={entry?.links.join(', ') ?? ''}
        placeholder="https://…"
        hint="Comma separated. Full URLs only."
        error={Err('links')}
      />
      <Textarea
        label="Your summary"
        name="summary"
        rows={5}
        defaultValue={entry?.summary ?? ''}
        placeholder="What it argues, and why it matters to your work."
        error={Err('summary')}
      />
    </>
  ),
  toInput: (form) => {
    const split = (name: string) =>
      String(form.get(name) ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const year = String(form.get('year') ?? '').trim();

    return {
      title: required(form, 'title'),
      authors: text(form, 'authors'),
      year: year ? Number(year) : null,
      tags: split('tags'),
      links: split('links'),
      summary: text(form, 'summary'),
    };
  },
  aside: ({ filters, setFilter }) => {
    const raw = filters['tag'];
    const active = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return (
      <TagSidebar
        active={active}
        match={filters['tagMatch'] === 'all' ? 'all' : 'any'}
        onChange={(tags) => {
          setFilter('tag', tags);
          // "Match all" means nothing with fewer than two tags; left behind it
          // would count as an active filter over an unfiltered list.
          if (tags.length < 2) setFilter('tagMatch', '');
        }}
        // `any` is the API's default, so it is sent as nothing.
        onMatch={(match) => setFilter('tagMatch', match === 'all' ? 'all' : '')}
      />
    );
  },
  emptyTitle: 'The library is empty',
  emptyBody:
    'Add the paper you read most recently. Tags are what make it findable at three hundred.',
};

/**
 * The literature tag filter. Counts come from the backend, not the loaded page.
 *
 * Tags toggle independently, so several can be on at once. With two or more
 * selected a switch appears for whether an entry needs any of them or all of
 * them — the two readings of "these tags" are both useful, and guessing one
 * would be wrong half the time.
 */
function TagSidebar({
  active,
  match,
  onChange,
  onMatch,
}: {
  active: string[];
  match: 'any' | 'all';
  onChange: (tags: string[]) => void;
  onMatch: (match: 'any' | 'all') => void;
}) {
  const { data, isPending } = useLiteratureTags();
  const tags = data?.tags ?? [];

  const toggle = (tag: string) =>
    onChange(active.includes(tag) ? active.filter((t) => t !== tag) : [...active, tag]);

  return (
    <div className="rounded-[18px] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[12.5px] font-bold tracking-[0.06em] text-ink-4 uppercase">Tags</h2>
        {active.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[12px] font-semibold text-brand-ink transition hover:underline"
          >
            Clear{active.length > 1 ? ` (${active.length})` : ''}
          </button>
        ) : null}
      </div>

      {active.length > 1 ? (
        <div
          role="radiogroup"
          aria-label="Entries must have"
          className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1"
        >
          {(['any', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={match === value}
              onClick={() => onMatch(value)}
              className={`rounded-md px-2 py-1 text-[12px] font-semibold transition ${
                match === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {value === 'any' ? 'Any tag' : 'All tags'}
            </button>
          ))}
        </div>
      ) : null}

      {isPending ? (
        <p className="mt-3 text-[13px] text-ink-4">Loading…</p>
      ) : tags.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
          Tags appear here once entries have them.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-0.5">
          {tags.map(({ tag, count }) => {
            const on = active.includes(tag);
            return (
              <li key={tag}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(tag)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition ${
                    on
                      ? 'bg-brand-tint font-semibold text-brand-deep'
                      : 'text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  <Icon
                    name={on ? 'check_box' : 'check_box_outline_blank'}
                    size={16}
                    className={`flex-none ${on ? 'text-brand-deep' : 'text-ink-4'}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{tag}</span>
                  <span className="flex-none font-mono text-[11.5px] text-ink-4 tabular">
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Career goals ─────────────────────────────────────────────────────────── */

/**
 * The kinds of goal offered when creating one.
 *
 * The column is free text and always has been, so a goal may carry a type
 * outside this list; `goalTypeOptions` appends it rather than letting a select
 * silently rewrite it on the next edit.
 */
const GOAL_TYPES = ['publication', 'grant', 'teaching', 'skill', 'career', 'personal', 'general'];

function goalTypeOptions(current: string | undefined) {
  const values = current && !GOAL_TYPES.includes(current) ? [...GOAL_TYPES, current] : GOAL_TYPES;
  return values.map((value) => ({ value, label: humanise(value) }));
}

/**
 * Stages: how many there are, and how many are done.
 *
 * The two are one control because one bounds the other — the slider's maximum
 * is whatever the number box says, and lowering the total below the current
 * stage clamps the stage back down rather than leaving it past the end.
 *
 * Both inputs keep their `name`, so the dialog reads them out of `FormData`
 * as it reads everything else. `previousStage` rides along as a hidden field:
 * on edit the stage is moved through its own endpoint, and only if it changed.
 */
function StageFields({ goal }: { goal: CareerGoal | null }) {
  const totalId = useId();
  const stageId = useId();
  const [total, setTotal] = useState(goal?.totalStages ?? 5);
  const [stage, setStage] = useState(goal?.currentStage ?? 0);

  const bounded = Math.min(stage, total);
  const pct = total > 0 ? Math.round((bounded / total) * 100) : 0;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={totalId} className="text-[13px] font-semibold text-ink-2">
          Total stages
        </label>
        <input
          id={totalId}
          name="totalStages"
          type="number"
          min={2}
          max={50}
          value={total}
          onChange={(e) => {
            const next = Math.max(2, Math.min(50, Number(e.target.value) || 2));
            setTotal(next);
            setStage((s) => Math.min(s, next));
          }}
          className="h-11 rounded-[11px] border border-line-2 bg-surface px-3.5 text-[14.5px] text-ink outline-none transition focus:border-brand"
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor={stageId} className="text-[13px] font-semibold text-ink-2">
            Stages completed
          </label>
          <span className="text-[13px] font-bold text-brand-deep tabular">
            {bounded} of {total} · {pct}%
          </span>
        </div>
        <input
          id={stageId}
          name="currentStage"
          type="range"
          min={0}
          max={total}
          step={1}
          value={bounded}
          onChange={(e) => setStage(Number(e.target.value))}
          className="range mt-1"
          style={{
            background: `linear-gradient(to right, var(--color-brand) ${pct}%, var(--color-surface-2) ${pct}%)`,
          }}
        />
        {goal ? <input type="hidden" name="previousStage" value={goal.currentStage} /> : null}
      </div>
    </>
  );
}

/* ── A goal's timeline ─────────────────────────────────────────────────── */

const WHEN = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** The stage a "record progress" form should offer first: the next one, or the
 *  one before the last when there is no next. The server refuses the current one. */
function nextStage(current: number, total: number): number {
  return current < total ? current + 1 : Math.max(1, total - 1);
}

/** The row's button, and the dialog it opens. */
function GoalTimeline({ goal }: { goal: CareerGoal }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowAction
        icon="timeline"
        label={`Timeline for ${goal.title}`}
        onClick={() => setOpen(true)}
      />
      {open ? <GoalTimelineDialog goal={goal} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * Every stage a goal has reached, oldest first, and the place to add the next.
 *
 * Recording goes through the stage endpoint, which moves the goal and writes
 * the entry in one transaction — so the timeline and the goal's progress bar
 * cannot disagree. The dialog reads the goal from the list, which refreshes
 * after each entry, so "stage 2 of 5" above the log is always current.
 */
function GoalTimelineDialog({ goal, onClose }: { goal: CareerGoal; onClose: () => void }) {
  const toast = useToast();
  const history = useGoalHistory(goal.id);
  const record = useRecordStage();

  const [stage, setStage] = useState(() => nextStage(goal.currentStage, goal.totalStages));
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The API returns newest first; a timeline reads the way it happened.
  const entries = [...(history.data?.history ?? [])].reverse();
  const choices = Array.from({ length: goal.totalStages }, (_, i) => i + 1).filter(
    (s) => s !== goal.currentStage,
  );
  const pct = Math.round((goal.currentStage / Math.max(1, goal.totalStages)) * 100);

  async function onRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await record.mutateAsync({ id: goal.id, stage, description: description.trim() || null });
      toast.success(`Stage ${stage} recorded`);
      setDescription('');
      setStage(nextStage(stage, goal.totalStages));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record that stage.');
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={goal.title}
      description={`Stage ${goal.currentStage} of ${goal.totalStages} · ${pct}%${
        goal.achievedAt ? ' · Achieved' : ''
      }`}
      busy={record.isPending}
    >
      {history.isPending ? (
        <div className="shimmer flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} h={48} radius={12} />
          ))}
        </div>
      ) : history.isError ? (
        <p className="text-[13.5px] text-danger-ink">The timeline could not be loaded.</p>
      ) : (
        <ol className="ml-2 flex flex-col gap-5 border-l-2 border-line pl-6">
          <li className="relative">
            <span
              aria-hidden="true"
              className="absolute top-1 -left-[32px] size-3.5 rounded-full border-2 border-surface bg-line-2"
            />
            <p className="text-[13px] font-semibold text-ink-3">Goal created</p>
            <p className="text-[12px] text-ink-4">{WHEN.format(new Date(goal.createdAt))}</p>
          </li>

          {entries.map((entry, i) => {
            const latest = i === entries.length - 1;
            return (
              <li key={entry.id} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute top-1 -left-[32px] size-3.5 rounded-full border-2 border-surface ${
                    latest ? 'bg-brand' : 'bg-brand-tint'
                  }`}
                />
                <p className="text-[14px] font-bold text-ink">
                  Stage {entry.stage} of {goal.totalStages}
                  {entry.stage >= goal.totalStages ? ' · Final' : ''}
                </p>
                <p className="text-[12px] text-ink-4">{WHEN.format(new Date(entry.recordedAt))}</p>
                {entry.description ? (
                  <p className="mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-line text-ink-2">
                    {entry.description}
                  </p>
                ) : null}
              </li>
            );
          })}

          {entries.length === 0 ? (
            <li className="text-[13px] leading-relaxed text-ink-3">
              No stages recorded yet. Record the first one below.
            </li>
          ) : null}
        </ol>
      )}

      <form
        onSubmit={(e) => void onRecord(e)}
        className="mt-6 flex flex-col gap-3 border-t border-line pt-5"
        noValidate
      >
        <p className="text-[13px] font-semibold text-ink-2">Record progress</p>
        {error ? <p className="text-[12.5px] text-danger-ink">{error}</p> : null}
        <Select
          label="Stage reached"
          value={String(stage)}
          onChange={(e) => setStage(Number(e.target.value))}
          options={choices.map((s) => ({
            value: String(s),
            label: `Stage ${s}${s === goal.totalStages ? ' (final)' : ''}${
              s < goal.currentStage ? ' — moving back' : ''
            }`,
          }))}
        />
        <Textarea
          label="What happened"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Submitted the first draft to the journal"
        />
        <div className="flex justify-end">
          <Button type="submit" variant="brand" size="sm" icon="add" loading={record.isPending}>
            Add to timeline
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** The four figures over the list. All four come from one summary request. */
function CareerStats() {
  const { data, isPending } = useCareerSummary();
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total goals" value={data?.total ?? 0} loading={isPending} />
      <MetricCard label="Completed" value={data?.achieved ?? 0} loading={isPending} />
      <MetricCard
        label="Avg progress"
        value={`${data?.averageProgress ?? 0}%`}
        loading={isPending}
      />
      <MetricCard label="Active goals" value={data?.active ?? 0} loading={isPending} />
    </div>
  );
}

const careerGoalsConfig: ResourceConfig<CareerGoal> = {
  title: 'Career goals',
  icon: 'stairs',
  noun: 'goal',
  blurb: 'Set, track, and achieve your career aspirations and personal goals.',
  createLabel: 'Add goal',
  hooks: { ...careerGoalHooks, useUpdate: useCareerGoalEdit } as never,
  useQuota: useCareerQuota,
  stats: () => <CareerStats />,
  listLabel: 'Your goals',
  rowActions: (goal) => <GoalTimeline goal={goal} />,
  filters: [
    {
      name: 'goalType',
      label: 'Type',
      options: GOAL_TYPES.map((value) => ({ value, label: humanise(value) })),
    },
    {
      name: 'status',
      label: 'Progress',
      options: [
        { value: 'not_started', label: 'Not started' },
        { value: 'in_progress', label: 'In progress' },
        { value: 'achieved', label: 'Completed' },
      ],
    },
  ],
  sorts: [
    { value: 'newest', label: 'Date added' },
    { value: 'progress', label: 'Progress' },
    { value: 'target', label: 'Target date' },
    { value: 'title', label: 'Title' },
  ],
  row: (goal) => {
    const pct = Math.round((goal.currentStage / Math.max(1, goal.totalStages)) * 100);
    return {
      primary: goal.title,
      secondary: goal.stageDescription ?? goal.description,
      tag: goal.achievedAt ? 'Achieved' : humanise(goal.goalType),
      tone: goal.achievedAt ? 'success' : 'brand',
      meta: `${goal.currentStage}/${goal.totalStages}`,
      extra: (
        <span className="mt-2 flex items-center gap-2.5">
          <span className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-brand transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="text-[11.5px] text-ink-4 tabular">{pct}%</span>
        </span>
      ),
    };
  },
  form: (goal) => (
    <>
      <Field
        label="Title"
        name="title"
        defaultValue={goal?.title ?? ''}
        required
        error={Err('title')}
      />
      {/* Type and stages before the body: they are the shape of the goal, and
          a three-row textarea buries anything under it. The slider spans the
          row beneath, since a bar that short says nothing. */}
      <FieldRow>
        <Select
          label="Type"
          name="goalType"
          defaultValue={goal?.goalType ?? 'general'}
          options={goalTypeOptions(goal?.goalType)}
          error={Err('goalType')}
        />
        <StageFields goal={goal} />
      </FieldRow>
      <Textarea
        label="Description"
        name="description"
        rows={3}
        defaultValue={goal?.description ?? ''}
        error={Err('description')}
      />
      <FieldRow>
        <Field
          label="Start"
          name="startAt"
          type="date"
          defaultValue={dateInputValue(goal?.startAt)}
          error={Err('startAt')}
        />
        <Field
          label="Target"
          name="targetAt"
          type="date"
          defaultValue={dateInputValue(goal?.targetAt)}
          error={Err('targetAt')}
        />
      </FieldRow>
      <Field
        label="Stage description"
        name="stageDescription"
        defaultValue={goal?.stageDescription ?? ''}
        placeholder="What is happening right now"
        hint="Saved to the goal's timeline with the stage. Later stages are added from the timeline button on the goal."
        error={Err('stageDescription')}
      />
    </>
  ),
  toInput: (form) => ({
    title: required(form, 'title'),
    description: text(form, 'description'),
    goalType: text(form, 'goalType') ?? 'general',
    totalStages: Number(form.get('totalStages') ?? 5),
    currentStage: Number(form.get('currentStage') ?? 0),
    // Only present on edit; `useCareerGoalEdit` compares the two and strips both.
    ...(form.has('previousStage') ? { previousStage: Number(form.get('previousStage')) } : {}),
    stageDescription: text(form, 'stageDescription'),
    startAt: text(form, 'startAt'),
    targetAt: text(form, 'targetAt'),
  }),
  emptyTitle: 'No goals yet',
  emptyBody:
    'Break something long-running into stages — a paper, a grant, a course rebuild — and track it here.',
};

/* ── Exports ──────────────────────────────────────────────────────────────── */

export const Ideas = () => <ResourceScreen config={ideasConfig} />;
export const Notes = () => <ResourceScreen config={notesConfig} />;
export const Deadlines = () => <ResourceScreen config={deadlinesConfig} />;
export const FutureWork = () => <ResourceScreen config={futureWorkConfig} />;
export const Literature = () => <ResourceScreen config={literatureConfig} />;
export const CareerGoals = () => <ResourceScreen config={careerGoalsConfig} />;
