/**
 * The profile, as one long form.
 *
 * Eleven sections, from who you are to what you do outside the department,
 * edited together and saved with one button. It is one document because the
 * résumé is printed from it whole, and a record you fill in section by
 * section in separate dialogs is a record you never quite finish.
 *
 * Saving is explicit. The header says whether what is on screen matches what
 * is stored, and a reload with unsaved edits asks first. The five repeating
 * sections — degrees, positions, courses, grants, awards — are lists you add
 * rows to; a row with its first field empty is dropped on save rather than
 * refused, since an empty row is a row you stopped filling in, not a mistake.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { FieldRow, Textarea } from '../components/ui/Form';
import { Icon } from '../components/ui/Icon';
import { Card, PageHeader } from '../components/ui/Layout';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import {
  ApiError,
  type Award,
  type Course,
  type Degree,
  type Grant,
  type Position,
  type Profile as ProfileRecord,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { useProfile, useProfileActions } from '../lib/queries';

/* ── The draft ────────────────────────────────────────────────────────────── */

/** Every field the form holds, as strings; the lists as they are. */
interface Draft {
  fullName: string;
  designation: string;
  department: string;
  institution: string;
  officialEmail: string;
  alternateEmail: string;
  phone: string;
  website: string;
  officeAddress: string;
  degrees: Degree[];
  positions: Position[];
  researchKeywords: string;
  researchDescription: string;
  scholarLink: string;
  courses: Course[];
  grants: Grant[];
  professionalActivities: string;
  awards: Award[];
  skills: string;
  outreach: string;
}

type TextKey = {
  [K in keyof Draft]: Draft[K] extends string ? K : never;
}[keyof Draft];

const TEXT_KEYS: TextKey[] = [
  'fullName',
  'designation',
  'department',
  'institution',
  'officialEmail',
  'alternateEmail',
  'phone',
  'website',
  'officeAddress',
  'researchKeywords',
  'researchDescription',
  'scholarLink',
  'professionalActivities',
  'skills',
  'outreach',
];

function draftOf(p: ProfileRecord | null): Draft {
  const s = (v: string | null | undefined) => v ?? '';
  return {
    fullName: s(p?.fullName),
    designation: s(p?.designation),
    department: s(p?.department),
    institution: s(p?.institution),
    officialEmail: s(p?.officialEmail),
    alternateEmail: s(p?.alternateEmail),
    phone: s(p?.phone),
    website: s(p?.website),
    officeAddress: s(p?.officeAddress),
    degrees: p?.degrees ?? [],
    positions: p?.positions ?? [],
    researchKeywords: s(p?.researchKeywords),
    researchDescription: s(p?.researchDescription),
    scholarLink: s(p?.scholarLink),
    courses: p?.courses ?? [],
    grants: p?.grants ?? [],
    professionalActivities: s(p?.professionalActivities),
    awards: p?.awards ?? [],
    skills: s(p?.skills),
    outreach: s(p?.outreach),
  };
}

/** What is sent: text trimmed and blanks as null; lists without empty rows. */
function payloadOf(d: Draft) {
  const t = (v: string) => v.trim() || null;
  const rows = <T extends object>(list: T[], first: keyof T) =>
    list.filter((row) => String(row[first] ?? '').trim() !== '');

  const text = Object.fromEntries(TEXT_KEYS.map((k) => [k, t(d[k])])) as Record<
    TextKey,
    string | null
  >;

  return {
    ...text,
    degrees: rows(d.degrees, 'degree'),
    positions: rows(d.positions, 'title'),
    courses: rows(d.courses, 'title'),
    grants: rows(d.grants, 'title'),
    awards: rows(d.awards, 'title'),
  };
}

const same = (a: Draft, b: Draft) => JSON.stringify(payloadOf(a)) === JSON.stringify(payloadOf(b));

/** The four fields the résumé cannot be printed without. */
const REQUIRED: TextKey[] = ['fullName', 'designation', 'department', 'institution'];

/* ── The page ─────────────────────────────────────────────────────────────── */

export default function Profile() {
  const toast = useToast();
  const { user } = useAuth();
  const { data, isPending } = useProfile();
  const { save, uploadAvatar, clearAvatar } = useProfileActions();

  const stored = useMemo(() => draftOf(data?.profile ?? null), [data]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  // The draft starts from what is stored, once it has arrived, and is not
  // overwritten by a later refetch while the user is typing.
  useEffect(() => {
    if (data && draft === null) setDraft(stored);
  }, [data, draft, stored]);

  const profile = data?.profile ?? null;
  const uploadsEnabled = data?.uploadsEnabled ?? false;
  const dirty = draft !== null && !same(draft, stored);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function onSave() {
    if (!draft) return;
    const missing = REQUIRED.filter((k) => draft[k].trim() === '');
    if (missing.length > 0) {
      setFieldErrors(Object.fromEntries(missing.map((k) => [k, 'Needed for the résumé'])));
      toast.error('Fill in the four basic details marked with a star.');
      return;
    }

    setFieldErrors({});
    try {
      const saved = await save.mutateAsync(payloadOf(draft));
      setDraft(draftOf(saved.profile));
      toast.success('Profile saved');
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        setFieldErrors(error.fieldErrors);
        toast.error('Some details need correcting — see the fields marked.');
      } else {
        toast.error(error instanceof ApiError ? error.message : 'Could not save your profile.');
      }
    }
  }

  function onPickAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately: without this, picking the same file twice in a row
    // fires no change event the second time.
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('That image is larger than 8MB. Choose a smaller one.');
      return;
    }
    void uploadAvatar
      .mutateAsync(file)
      .then(() => toast.success('Photo updated'))
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Could not upload that photo.'),
      );
  }

  if (isPending || draft === null) {
    return (
      <AppShell>
        <PageHeader title="Profile" description="Your details, and the résumé built from them." />
        <Skeleton h={420} radius={18} className="shimmer" />
      </AppShell>
    );
  }

  const displayName = draft.fullName.trim() || user?.name || user?.email || 'Your profile';
  const err = (k: string) => fieldErrors[k];

  return (
    <AppShell>
      <PageHeader
        title="Profile"
        description="Your details, and the résumé built from them."
        icon="person"
        actions={
          <>
            {/* Reads what is stored, so it is offered once there is a record
                and disabled while the draft has moved on from it. */}
            <Link to="/profile/resume" tabIndex={-1}>
              <Button
                variant="secondary"
                size="sm"
                icon="description"
                disabled={!profile || dirty}
                title={dirty ? 'Save first, so the résumé matches' : undefined}
              >
                View résumé
              </Button>
            </Link>
            <Button
              variant="brand"
              size="sm"
              icon="save"
              loading={save.isPending}
              disabled={!dirty}
              onClick={() => void onSave()}
            >
              {dirty ? 'Save profile' : 'Saved'}
            </Button>
          </>
        }
      />

      {/* ── Photo and name ─────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="size-20 flex-none rounded-full object-cover"
            />
          ) : (
            <span className="grid size-20 flex-none place-items-center rounded-full bg-brand-avatar text-[22px] font-bold text-brand-avatar-ink">
              {initials(displayName)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[20px] leading-tight font-extrabold tracking-[-0.02em]">
              {displayName}
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-ink-3">{user?.email}</p>
          </div>
          {uploadsEnabled ? (
            <div className="flex flex-none gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickAvatar}
              />
              <Button
                variant="secondary"
                size="sm"
                icon="photo_camera"
                loading={uploadAvatar.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {profile?.avatarUrl ? 'Change photo' : 'Add photo'}
              </Button>
              {profile?.avatarUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={clearAvatar.isPending}
                  onClick={() =>
                    void clearAvatar
                      .mutateAsync()
                      .then(() => toast.success('Photo removed'))
                      .catch(() => toast.error('Could not remove the photo.'))
                  }
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {/* ── 1. Basic information ───────────────────────────────────────── */}
      <Section
        n={1}
        title="Basic information"
        blurb="The four starred fields are what the résumé is headed with."
      >
        <FieldRow>
          <Field
            label="Full name *"
            value={draft.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            error={err('fullName')}
          />
          <Field
            label="Designation *"
            value={draft.designation}
            onChange={(e) => set('designation', e.target.value)}
            placeholder="Assistant Professor, PhD candidate…"
            error={err('designation')}
          />
        </FieldRow>
        <FieldRow>
          <Field
            label="Department *"
            value={draft.department}
            onChange={(e) => set('department', e.target.value)}
            error={err('department')}
          />
          <Field
            label="Institution name *"
            value={draft.institution}
            onChange={(e) => set('institution', e.target.value)}
            error={err('institution')}
          />
        </FieldRow>
        <FieldRow>
          <Field
            label="Official email *"
            type="email"
            value={draft.officialEmail}
            onChange={(e) => set('officialEmail', e.target.value)}
            error={err('officialEmail')}
          />
          <Field
            label="Alternate email"
            type="email"
            value={draft.alternateEmail}
            onChange={(e) => set('alternateEmail', e.target.value)}
            error={err('alternateEmail')}
          />
        </FieldRow>
        <FieldRow>
          <Field
            label="Phone"
            value={draft.phone}
            onChange={(e) => set('phone', e.target.value)}
            error={err('phone')}
          />
          <Field
            label="Website / portfolio"
            type="url"
            value={draft.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://"
            error={err('website')}
          />
        </FieldRow>
        <Textarea
          label="Office address"
          rows={2}
          value={draft.officeAddress}
          onChange={(e) => set('officeAddress', e.target.value)}
          error={err('officeAddress')}
        />
      </Section>

      {/* ── 2. Academic background ─────────────────────────────────────── */}
      <Section n={2} title="Academic background">
        <Rows
          items={draft.degrees}
          onChange={(v) => set('degrees', v)}
          blank={() => ({ degree: '', field: '', institution: '', startYear: '', endYear: '' })}
          addLabel="Add degree"
          render={(row, update) => (
            <>
              <FieldRow>
                <Field
                  label="Degree"
                  value={row.degree}
                  onChange={(e) => update({ degree: e.target.value })}
                  placeholder="PhD, MSc, BEng…"
                />
                <Field
                  label="Field of study"
                  value={row.field ?? ''}
                  onChange={(e) => update({ field: e.target.value })}
                />
              </FieldRow>
              <FieldRow>
                <Field
                  label="Institution"
                  value={row.institution ?? ''}
                  onChange={(e) => update({ institution: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="From"
                    value={row.startYear ?? ''}
                    onChange={(e) => update({ startYear: e.target.value })}
                    placeholder="2018"
                  />
                  <Field
                    label="To"
                    value={row.endYear ?? ''}
                    onChange={(e) => update({ endYear: e.target.value })}
                    placeholder="2022"
                  />
                </div>
              </FieldRow>
            </>
          )}
        />
      </Section>

      {/* ── 3. Employment history ──────────────────────────────────────── */}
      <Section n={3} title="Employment history">
        <Rows
          items={draft.positions}
          onChange={(v) => set('positions', v)}
          blank={() => ({
            title: '',
            organisation: '',
            startYear: '',
            endYear: '',
            description: '',
          })}
          addLabel="Add position"
          render={(row, update) => (
            <>
              <FieldRow>
                <Field
                  label="Position"
                  value={row.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
                <Field
                  label="Organisation"
                  value={row.organisation ?? ''}
                  onChange={(e) => update({ organisation: e.target.value })}
                />
              </FieldRow>
              <FieldRow>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="From"
                    value={row.startYear ?? ''}
                    onChange={(e) => update({ startYear: e.target.value })}
                    placeholder="2022"
                  />
                  <Field
                    label="To"
                    value={row.endYear ?? ''}
                    onChange={(e) => update({ endYear: e.target.value })}
                    placeholder="Present"
                  />
                </div>
                <Field
                  label="What it involved"
                  value={row.description ?? ''}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </FieldRow>
            </>
          )}
        />
      </Section>

      {/* ── 4. Research interests ──────────────────────────────────────── */}
      <Section n={4} title="Research interests">
        <Field
          label="Keywords (comma-separated)"
          value={draft.researchKeywords}
          onChange={(e) => set('researchKeywords', e.target.value)}
          placeholder="distributed systems, consensus, formal methods"
          error={err('researchKeywords')}
        />
        <Textarea
          label="Description (2–3 sentences)"
          rows={3}
          value={draft.researchDescription}
          onChange={(e) => set('researchDescription', e.target.value)}
          error={err('researchDescription')}
        />
      </Section>

      {/* ── 5. Publications ────────────────────────────────────────────── */}
      <Section n={5} title="Publications">
        <Field
          label="Google Scholar profile link"
          type="url"
          value={draft.scholarLink}
          onChange={(e) => set('scholarLink', e.target.value)}
          placeholder="https://scholar.google.com/citations?user=…"
          error={err('scholarLink')}
        />
      </Section>

      {/* ── 6. Teaching ────────────────────────────────────────────────── */}
      <Section n={6} title="Teaching">
        <Rows
          items={draft.courses}
          onChange={(v) => set('courses', v)}
          blank={() => ({ title: '', code: '', level: '', institution: '', years: '' })}
          addLabel="Add course"
          render={(row, update) => (
            <>
              <FieldRow>
                <Field
                  label="Course"
                  value={row.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Code"
                    value={row.code ?? ''}
                    onChange={(e) => update({ code: e.target.value })}
                    placeholder="CS 401"
                  />
                  <Field
                    label="Level"
                    value={row.level ?? ''}
                    onChange={(e) => update({ level: e.target.value })}
                    placeholder="Undergraduate"
                  />
                </div>
              </FieldRow>
              <FieldRow>
                <Field
                  label="Institution"
                  value={row.institution ?? ''}
                  onChange={(e) => update({ institution: e.target.value })}
                />
                <Field
                  label="Years taught"
                  value={row.years ?? ''}
                  onChange={(e) => update({ years: e.target.value })}
                  placeholder="2021–2024"
                />
              </FieldRow>
            </>
          )}
        />
      </Section>

      {/* ── 7. Grants & funding ────────────────────────────────────────── */}
      <Section n={7} title="Grants & funding">
        <Rows
          items={draft.grants}
          onChange={(v) => set('grants', v)}
          blank={() => ({ title: '', funder: '', amount: '', year: '', role: '' })}
          addLabel="Add grant"
          render={(row, update) => (
            <>
              <FieldRow>
                <Field
                  label="Grant"
                  value={row.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
                <Field
                  label="Funder"
                  value={row.funder ?? ''}
                  onChange={(e) => update({ funder: e.target.value })}
                />
              </FieldRow>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Amount"
                  value={row.amount ?? ''}
                  onChange={(e) => update({ amount: e.target.value })}
                  placeholder="₹12,00,000"
                />
                <Field
                  label="Year"
                  value={row.year ?? ''}
                  onChange={(e) => update({ year: e.target.value })}
                />
                <Field
                  label="Your role"
                  value={row.role ?? ''}
                  onChange={(e) => update({ role: e.target.value })}
                  placeholder="PI, Co-I…"
                />
              </div>
            </>
          )}
        />
      </Section>

      {/* ── 8. Professional activities ─────────────────────────────────── */}
      <Section n={8} title="Professional activities">
        <Textarea
          label="Professional activities (conferences, memberships, reviewer roles, etc.)"
          rows={5}
          value={draft.professionalActivities}
          onChange={(e) => set('professionalActivities', e.target.value)}
          hint="One per line reads best on the résumé."
          error={err('professionalActivities')}
        />
      </Section>

      {/* ── 9. Awards & achievements ───────────────────────────────────── */}
      <Section n={9} title="Awards & achievements">
        <Rows
          items={draft.awards}
          onChange={(v) => set('awards', v)}
          blank={() => ({ title: '', issuer: '', year: '' })}
          addLabel="Add award"
          render={(row, update) => (
            <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
              <Field
                label="Award"
                value={row.title}
                onChange={(e) => update({ title: e.target.value })}
              />
              <Field
                label="Issued by"
                value={row.issuer ?? ''}
                onChange={(e) => update({ issuer: e.target.value })}
              />
              <Field
                label="Year"
                value={row.year ?? ''}
                onChange={(e) => update({ year: e.target.value })}
              />
            </div>
          )}
        />
      </Section>

      {/* ── 10. Skills & tools ─────────────────────────────────────────── */}
      <Section n={10} title="Skills & tools">
        <Field
          label="Skills & tools (comma-separated)"
          value={draft.skills}
          onChange={(e) => set('skills', e.target.value)}
          placeholder="Python, TLA+, R, LaTeX"
          error={err('skills')}
        />
      </Section>

      {/* ── 11. Outreach & service ─────────────────────────────────────── */}
      <Section n={11} title="Outreach & service">
        <Textarea
          label="Outreach & service activities"
          rows={5}
          value={draft.outreach}
          onChange={(e) => set('outreach', e.target.value)}
          hint="One per line reads best on the résumé."
          error={err('outreach')}
        />
      </Section>

      {/* The same button again at the foot of a long page, so nobody has to
          scroll back up to save. */}
      <div className="flex justify-end">
        <Button
          variant="brand"
          icon="save"
          loading={save.isPending}
          disabled={!dirty}
          onClick={() => void onSave()}
        >
          {dirty ? 'Save profile' : 'Saved'}
        </Button>
      </div>
    </AppShell>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

function Section({
  n,
  title,
  blurb,
  children,
}: {
  n: number;
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-7 flex-none place-items-center rounded-[8px] bg-brand-tint text-[12.5px] font-bold text-brand-ink tabular">
          {n}
        </span>
        <div>
          <h2 className="text-[15px] leading-7 font-bold">{title}</h2>
          {blurb ? <p className="text-[12.5px] text-ink-3">{blurb}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

/**
 * A repeating section: rows you add, edit in place, and remove.
 *
 * Each row is its own bordered block with a delete in the corner; the add
 * button sits beneath the last. Order is the order added — a résumé section
 * is short enough that reordering is deleting and re-adding.
 */
function Rows<T extends object>({
  items,
  onChange,
  blank,
  addLabel,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: () => T;
  addLabel: string;
  render: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-4">Nothing added yet.</p>
      ) : (
        items.map((row, i) => (
          <div
            key={i}
            className="relative rounded-[14px] border border-line bg-surface-5 p-4 pr-12"
          >
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label="Remove"
              title="Remove"
              className="press absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-ink-4 transition hover:bg-danger-tint hover:text-danger-ink"
            >
              <Icon name="delete" size={17} />
            </button>
            <div className="flex flex-col gap-3">
              {render(row, (patch) =>
                onChange(items.map((r, j) => (j === i ? { ...r, ...patch } : r))),
              )}
            </div>
          </div>
        ))
      )}
      <div>
        <Button
          variant="secondary"
          size="sm"
          icon="add"
          onClick={() => onChange([...items, blank()])}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
