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
import { AudioPlayer } from '../components/ui/AudioPlayer';
import { Field } from '../components/ui/Field';
import { Checkbox, FieldRow, Select, Textarea } from '../components/ui/Form';
import { Icon } from '../components/ui/Icon';
import type {
  CareerGoal,
  Deadline,
  FutureWork as FutureWorkItem,
  Idea,
  Literature as LiteratureEntry,
  Note,
} from '../lib/api';
import { clock, dateInputValue, dueLabel, humanise, shortAge, timeInputValue } from '../lib/format';
import {
  careerGoalHooks,
  deadlineHooks,
  futureWorkHooks,
  ideaHooks,
  literatureHooks,
  noteHooks,
  useCareerQuota,
  useLiteratureTags,
} from '../lib/queries';
import { ResourceScreen, useFieldError, type ResourceConfig } from './ResourceScreen';
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

/* ── Ideas ────────────────────────────────────────────────────────────────── */

const ideasConfig: ResourceConfig<Idea> = {
  title: 'Ideas',
  icon: 'lightbulb',
  noun: 'idea',
  blurb:
    'Anything worth keeping, recorded before it goes. Categorise and colour them, then search across everything you have written.',
  createLabel: 'New idea',
  hooks: ideaHooks as never,
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
  // "Text note", because it is no longer the only kind. The voice button sits
  // beside it and owns its own recorder and dialog.
  createLabel: 'Text note',
  extraAction: () => <VoiceNoteButton />,
  hooks: noteHooks as never,
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
  createLabel: 'New deadline',
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
  createLabel: 'New item',
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
      <Field
        label="Tags"
        name="tags"
        defaultValue={entry?.tags.join(', ') ?? ''}
        placeholder="consensus, raft"
        hint="Comma separated. Tags are lowercased so they group properly."
        error={Err('tags')}
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
  aside: ({ filters, setFilter }) => (
    <TagSidebar active={filters['tag'] ?? ''} onPick={(t) => setFilter('tag', t)} />
  ),
  emptyTitle: 'The library is empty',
  emptyBody:
    'Add the paper you read most recently. Tags are what make it findable at three hundred.',
};

/** The literature tag filter. Counts come from the backend, not the loaded page. */
function TagSidebar({ active, onPick }: { active: string; onPick: (tag: string) => void }) {
  const { data, isPending } = useLiteratureTags();
  const tags = data?.tags ?? [];

  return (
    <div className="rounded-[18px] border border-line bg-surface p-4">
      <h2 className="text-[12.5px] font-bold tracking-[0.06em] text-ink-4 uppercase">Tags</h2>

      {isPending ? (
        <p className="mt-3 text-[13px] text-ink-4">Loading…</p>
      ) : tags.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
          Tags appear here once entries have them.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-0.5">
          {tags.map(({ tag, count }) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onPick(active === tag ? '' : tag)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition ${
                  active === tag
                    ? 'bg-brand-tint font-semibold text-brand-deep'
                    : 'text-ink-2 hover:bg-surface-2'
                }`}
              >
                <Icon name="label" size={15} className="flex-none text-ink-4" />
                <span className="min-w-0 flex-1 truncate">{tag}</span>
                <span className="flex-none font-mono text-[11.5px] text-ink-4 tabular">
                  {count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Career goals ─────────────────────────────────────────────────────────── */

const careerGoalsConfig: ResourceConfig<CareerGoal> = {
  title: 'Career goals',
  icon: 'trending_up',
  noun: 'goal',
  blurb:
    'Longer-running goals broken into stages, so progress is something you can point at rather than estimate.',
  createLabel: 'New goal',
  hooks: careerGoalHooks as never,
  useQuota: useCareerQuota,
  filters: [
    {
      name: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'achieved', label: 'Achieved' },
      ],
    },
  ],
  sorts: [
    { value: 'newest', label: 'Newest' },
    { value: 'progress', label: 'Progress' },
    { value: 'target', label: 'Target date' },
    { value: 'title', label: 'Title' },
  ],
  row: (goal) => {
    const pct = Math.round((goal.currentStage / Math.max(1, goal.totalStages)) * 100);
    return {
      primary: goal.title,
      secondary: goal.stageDescription ?? goal.description,
      tag: goal.achievedAt ? 'Achieved' : goal.goalType,
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
      <Textarea
        label="Description"
        name="description"
        rows={3}
        defaultValue={goal?.description ?? ''}
        error={Err('description')}
      />
      <FieldRow>
        <Field
          label="Type"
          name="goalType"
          defaultValue={goal?.goalType ?? 'general'}
          placeholder="Publication"
          error={Err('goalType')}
        />
        <Field
          label="Total stages"
          name="totalStages"
          type="number"
          min={2}
          max={50}
          defaultValue={goal?.totalStages ?? 5}
          error={Err('totalStages')}
        />
      </FieldRow>
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
        label="Current stage description"
        name="stageDescription"
        defaultValue={goal?.stageDescription ?? ''}
        placeholder="What is happening right now"
        error={Err('stageDescription')}
      />
    </>
  ),
  toInput: (form) => ({
    title: required(form, 'title'),
    description: text(form, 'description'),
    goalType: text(form, 'goalType') ?? 'general',
    totalStages: Number(form.get('totalStages') ?? 5),
    stageDescription: text(form, 'stageDescription'),
    startAt: text(form, 'startAt'),
    targetAt: text(form, 'targetAt'),
  }),
  emptyTitle: 'No goals set',
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
