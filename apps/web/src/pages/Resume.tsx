/**
 * The résumé, printed from the profile.
 *
 * A document, not a form. Everything on it comes from the profile record and
 * is changed there; this page arranges it the way a CV is read — name and
 * post at the head, then education, positions, research, and the rest in
 * the order the profile collects them — and offers it as a PDF through the
 * browser's own print, the way the project brief is.
 *
 * Empty sections are left out rather than printed as headings over nothing:
 * a CV with "Grants & funding — none" on it is worse than one without the
 * line.
 */
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/Layout';
import { Skeleton } from '../components/ui/Skeleton';
import type { Profile } from '../lib/api';
import { useProfile } from '../lib/queries';

/** "2018–2022", "2022–Present", or just the one year given. */
function span(from: string | null, to: string | null): string {
  const a = from?.trim() ?? '';
  const b = to?.trim() ?? '';
  if (a && b) return `${a}–${b}`;
  return a || b;
}

/** Comma-separated free text as a list, empties dropped. */
function commaList(text: string | null): string[] {
  return (text ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Free text as lines, empties dropped. */
function lines(text: string | null): string[] {
  return (text ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function Resume() {
  const { data, isPending } = useProfile();
  const profile = data?.profile ?? null;

  if (isPending) {
    return (
      <AppShell>
        <Skeleton h={600} radius={18} className="shimmer" />
      </AppShell>
    );
  }

  if (!profile || !profile.fullName) {
    return (
      <AppShell>
        <EmptyState
          icon="description"
          title="Nothing to print yet"
          action={
            <Link to="/profile">
              <Button variant="brand" icon="person">
                Fill in your profile
              </Button>
            </Link>
          }
        >
          The résumé is built from your profile. Start with the four basic details.
        </EmptyState>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="no-print">
        <PageHeader
          title="Résumé"
          description="Built from your profile. Change anything there and it changes here."
          crumbs={[{ label: 'Profile', to: '/profile' }, { label: 'Résumé' }]}
          icon="description"
          actions={
            <>
              <Link to="/profile" tabIndex={-1}>
                <Button variant="secondary" size="sm" icon="edit">
                  Edit profile
                </Button>
              </Link>
              <Button variant="brand" size="sm" icon="download" onClick={() => window.print()}>
                Download PDF
              </Button>
            </>
          }
        />
      </div>

      <ResumeDocument profile={profile} />
    </AppShell>
  );
}

/* ── The document ─────────────────────────────────────────────────────────── */

function ResumeDocument({ profile: p }: { profile: Profile }) {
  const contact = [
    p.officialEmail,
    p.alternateEmail,
    p.phone,
    p.website,
    p.scholarLink ? 'Google Scholar' : null,
  ].filter(Boolean);

  const keywords = commaList(p.researchKeywords);
  const skills = commaList(p.skills);
  const activities = lines(p.professionalActivities);
  const outreach = lines(p.outreach);

  return (
    <article className="print-document mx-auto w-full max-w-[820px] rounded-[18px] border border-line bg-surface px-5 py-8 sm:px-10 sm:py-12 print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0">
      {/* Head */}
      <header className="border-b-2 border-ink pb-5">
        <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.02em]">
          {p.fullName}
        </h1>
        <p className="mt-1 text-[15px] font-semibold text-ink-2">
          {[p.designation, p.department, p.institution].filter(Boolean).join(' · ')}
        </p>
        {contact.length > 0 ? (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
            {p.officialEmail ? <span>{p.officialEmail}</span> : null}
            {p.alternateEmail ? <span>{p.alternateEmail}</span> : null}
            {p.phone ? <span>{p.phone}</span> : null}
            {p.website ? (
              <a href={p.website} className="text-ink-3 underline">
                {p.website.replace(/^https?:\/\//, '')}
              </a>
            ) : null}
            {p.scholarLink ? (
              <a href={p.scholarLink} className="text-ink-3 underline">
                Google Scholar
              </a>
            ) : null}
          </p>
        ) : null}
        {p.officeAddress ? (
          <p className="mt-1 text-[12.5px] whitespace-pre-line text-ink-3">{p.officeAddress}</p>
        ) : null}
      </header>

      {p.researchDescription || keywords.length > 0 ? (
        <Part title="Research interests">
          {p.researchDescription ? (
            <p className="text-[13.5px] leading-relaxed text-ink-2">{p.researchDescription}</p>
          ) : null}
          {keywords.length > 0 ? (
            <p className="mt-1.5 text-[12.5px] text-ink-3">{keywords.join(' · ')}</p>
          ) : null}
        </Part>
      ) : null}

      {p.degrees.length > 0 ? (
        <Part title="Education">
          {p.degrees.map((d, i) => (
            <Entry
              key={i}
              when={span(d.startYear, d.endYear)}
              title={[d.degree, d.field].filter(Boolean).join(' in ')}
              where={d.institution}
            />
          ))}
        </Part>
      ) : null}

      {p.positions.length > 0 ? (
        <Part title="Positions held">
          {p.positions.map((e, i) => (
            <Entry
              key={i}
              when={span(e.startYear, e.endYear)}
              title={e.title}
              where={e.organisation}
              note={e.description}
            />
          ))}
        </Part>
      ) : null}

      {p.courses.length > 0 ? (
        <Part title="Teaching">
          {p.courses.map((c, i) => (
            <Entry
              key={i}
              when={c.years}
              title={[c.code, c.title].filter(Boolean).join(' · ')}
              where={[c.level, c.institution].filter(Boolean).join(', ')}
            />
          ))}
        </Part>
      ) : null}

      {p.grants.length > 0 ? (
        <Part title="Grants & funding">
          {p.grants.map((g, i) => (
            <Entry
              key={i}
              when={g.year}
              title={g.title}
              where={[g.funder, g.amount, g.role].filter(Boolean).join(' · ')}
            />
          ))}
        </Part>
      ) : null}

      {p.awards.length > 0 ? (
        <Part title="Awards & achievements">
          {p.awards.map((a, i) => (
            <Entry key={i} when={a.year} title={a.title} where={a.issuer} />
          ))}
        </Part>
      ) : null}

      {activities.length > 0 ? (
        <Part title="Professional activities">
          <Bullets items={activities} />
        </Part>
      ) : null}

      {skills.length > 0 ? (
        <Part title="Skills & tools">
          <p className="text-[13.5px] leading-relaxed text-ink-2">{skills.join(' · ')}</p>
        </Part>
      ) : null}

      {outreach.length > 0 ? (
        <Part title="Outreach & service">
          <Bullets items={outreach} />
        </Part>
      ) : null}
    </article>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2.5 text-[11.5px] font-bold tracking-[0.12em] text-ink-3 uppercase">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** One dated line: the years in a narrow column, the substance beside. */
function Entry({
  when,
  title,
  where,
  note,
}: {
  when: string | null | undefined;
  title: string;
  where?: string | null | undefined;
  note?: string | null | undefined;
}) {
  return (
    <div className="grid gap-x-5 sm:grid-cols-[110px_1fr]">
      <p className="text-[12.5px] text-ink-4 tabular">{when?.trim() || ''}</p>
      <div>
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        {where ? <p className="text-[13px] text-ink-3">{where}</p> : null}
        {note ? <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{note}</p> : null}
      </div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 text-[13.5px] leading-relaxed text-ink-2">
      {items.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}
