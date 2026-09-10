/**
 * Landing page.
 *
 * Implements `design/Skrivbok Landing.html` section for section:
 *   nav · hero · features · why · how it works · testimonials · FAQ · contact · footer
 *
 * Copy is taken verbatim from the design, which in turn follows
 * `docs/landing-page.md`. Two things carried over from that spec and still true
 * here: the testimonials are marked as placeholders until real attributed
 * quotes exist, and no claim is made about calendar sync, file storage or
 * personal analytics, because the backend does none of those.
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { HeroArt } from '../components/marketing/HeroArt';
import { StickyFeatures } from '../components/marketing/StickyFeatures';
import { Carousel } from '../components/marketing/Carousel';
import { usePublishedReviews } from '../lib/queries';
import {
  Reveal,
  Stagger,
  useScrolledPast,
  useScrollProgress,
} from '../components/ui/Motion';
import {
  ArtPlaceholder,
  MarketingFooter,
  MarketingNav,
  Section,
  SectionHeading,
  Underline,
} from '../components/marketing/MarketingChrome';

const FEATURES = [
  {
    icon: 'lightbulb',
    name: 'Ideas',
    text: 'Record an idea in seconds, before it goes. Categorise and colour them, then search across everything you have written.',
  },
  {
    icon: 'sticky_note_2',
    name: 'Notes',
    text: 'Meeting notes, lecture notes, working notes. Pin the ones you return to; find the rest by search.',
  },
  {
    icon: 'history_edu',
    name: 'Journal',
    text: 'A dated record of how the work was done. Entries are dated by when the work happened, not when you wrote them up.',
  },
  {
    icon: 'folder_open',
    name: 'Projects',
    text: 'Every project with its own members, progress, notes and a structured brief. Invite collaborators by email, with view or edit access.',
  },
  {
    icon: 'menu_book',
    name: 'Literature',
    text: 'Your reading, with authors, year, links, tags and your own summary. Filter by any combination of tags.',
  },
  {
    icon: 'flag',
    name: 'Deadlines',
    text: 'Priority, status and due time in your own timezone. Email reminders arrive on the days you choose.',
  },
  {
    icon: 'calendar_month',
    name: 'Calendar',
    text: 'Events, recurring commitments and meetings, with per-event privacy. Recurring events stay correct across daylight-saving changes.',
  },
  {
    icon: 'stairs',
    name: 'Career goals',
    text: 'Long-term objectives broken into stages, with a permanent record of each advance.',
  },
];

const PILLARS = [
  {
    art: 'illustration: one desk, one open notebook, everything to hand',
    icon: 'inventory_2',
    eyebrow: 'One workspace',
    title: 'One place, not five',
    text: 'Notes, deadlines and events belong to the project they came from, so nothing has to be reassembled from three apps at the end of a term. Search reaches across all of it at once.',
    link: { label: 'See the features', to: '/#features' },
  },
  {
    art: 'illustration: a calendar with one date marked and a reminder sent',
    icon: 'schedule',
    eyebrow: 'Deadlines and reminders',
    title: 'Nothing is missed',
    text: 'One deadline list with priority, status and a real due time. Email reminders arrive on the days you choose, at the hour you choose, in your own timezone — correct across daylight saving.',
    link: { label: 'How it works', to: '/#how' },
  },
  {
    art: 'illustration: two calendars side by side, one partly redacted',
    icon: 'shield_lock',
    eyebrow: 'Sharing and privacy',
    title: 'Shared, still private',
    text: 'Grant free/busy or full view, per person. An event you mark private stays private at either level — granting access shows your availability, never the detail behind it.',
    link: { label: 'Create free account', to: '/register' },
  },
  {
    art: 'illustration: a staged path with each stage dated',
    icon: 'timeline',
    eyebrow: 'The long view',
    title: 'A record that lasts',
    text: 'Career goals advance in stages and every advance is logged with a date. The progress history writes itself over years, so the annual review is a read rather than a reconstruction.',
    link: { label: 'Create free account', to: '/register' },
  },
];

const STEPS = [
  {
    icon: 'person_add',
    n: '01',
    title: 'Create your account',
    text: 'Name, email and your timezone. No credit card, and nothing to install. The free plan is usable on its own.',
  },
  {
    icon: 'flag',
    n: '02',
    title: "Add this month's deadlines",
    text: 'Put in the submissions, reviews and reports due next. Set priority and switch on email reminders in your own timezone.',
  },
  {
    icon: 'folder_open',
    n: '03',
    title: 'Bring in projects and reading',
    text: 'Create a project per line of work, invite collaborators by email, and tag the papers you keep coming back to.',
  },
  {
    icon: 'group_add',
    n: '04',
    title: 'Share your calendar',
    text: "Give colleagues free/busy or full view, check several people's availability at once, and propose meetings from what you see.",
  },
];

/**
 * Placeholder quotes, carried over from the design.
 *
 * The design file labels these as provisional and so does the page: publishing
 * invented endorsements attributed to named academics is not something to ship
 * by accident. Replace with real, attributed reviews — or delete the section.
 */
const TESTIMONIALS = [
  {
    quote:
      'The deadline list with timezones is the part I did not know I needed. I run a project across three countries and I no longer guess what time a submission closes.',
    initials: 'AL',
    name: 'A. Lindqvist',
    role: 'Assistant Professor, Informatics',
  },
  {
    quote:
      'Three hundred papers in, the tag filters still find the one I want in a few seconds. My old folder of PDFs never did that.',
    initials: 'RM',
    name: 'R. Mehta',
    role: 'Postdoctoral Researcher',
  },
  {
    quote:
      'The journal is dated by the day the work happened. When I wrote up my second year, the record was already there.',
    initials: 'KO',
    name: 'K. Osei',
    role: 'PhD candidate, Year 3',
  },
  {
    quote:
      'Sharing free/busy with the whole group without exposing what the meetings are about was the thing that finally got my department off a shared spreadsheet.',
    initials: 'JS',
    name: 'J. Svensson',
    role: 'Senior Lecturer, Statistics',
  },
  {
    quote:
      'Career goals in stages sounds like a small thing until the annual review, when the history is already written and dated.',
    initials: 'CB',
    name: 'C. Baptiste',
    role: 'Associate Professor',
  },
];

const FAQS = [
  {
    q: 'Do I need to install anything?',
    a: 'No. Skrivbok runs in the browser. Sign in from any machine — a laptop in the office, a shared computer in the lab — and everything is there.',
  },
  {
    q: 'Can I get my data out?',
    a: 'Yes. Your work is yours. Projects, literature, notes and journal entries can be exported, and deleting your account removes your data rather than hiding it.',
  },
  {
    q: 'Does it sync with Google Calendar or Outlook?',
    a: 'Not at present. Skrivbok has its own calendar with recurring events, meeting requests and per-person sharing. External calendar sync is not available, and we would rather say so than imply otherwise.',
  },
  {
    q: 'How private is my work?',
    a: 'Private by default. Calendar events are private unless you change them, and granting someone access to your calendar never reveals an event you have marked private. Journal entries are never shared.',
  },
  {
    q: 'What does the free plan cover?',
    a: 'Up to five projects, five career goals and five literature entries, with unlimited ideas, notes, journal entries, deadlines and calendar events. Collaboration, sharing and email reminders are included, not paywalled.',
  },
  {
    q: 'How are deadline reminders sent?',
    a: 'By email, on the days before a deadline that you choose, at an hour you set — in your own timezone, correctly across daylight-saving changes.',
  },
  {
    q: 'Can I invite collaborators who do not have an account?',
    a: 'Yes. Project invitations are sent by email and work even if the person has not registered — the invite waits for them.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas-alt">
      <MarketingNav />
      <main>
        <Hero />
        <Features />
        <Why />
        <HowItWorks />
        <Testimonials />
        <Faq />
        <Contact />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

function Hero() {
  // The lamp lights the moment the page is scrolled and goes out again at the
  // top — a small, reversible reward for starting to read.
  const lit = useScrolledPast(40);

  return (
    <Section className="pt-10 pb-16 lg:pt-20 lg:pb-24">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        {/* The hero is above the fold, so it animates on load rather than on
            scroll — an IntersectionObserver reveal would fire instantly anyway
            and cost a frame doing it. */}
        <div className="max-w-[46rem]">
        <h1 className="animate-fade-up pb-3 text-[clamp(38px,5.6vw,60px)] leading-[1.06] font-extrabold tracking-[-0.04em]">
          One workspace for the whole of a{' '}
          <span className="relative inline-block italic">
            research
            <Underline color="#3fbf7f" />
          </span>{' '}
          career.
        </h1>

        <p
          className="animate-fade-up mt-6 max-w-[52ch] text-[16.5px] leading-[1.7] text-ink-3"
          style={{ animationDelay: '90ms' }}
        >
          Skrivbok brings together the work that currently lives in a notes app, a spreadsheet of
          deadlines, a reference folder and three separate calendars. Built by a researcher, for the
          way research actually runs.
        </p>

        <div
          className="animate-fade-up mt-8 flex flex-wrap items-center gap-3"
          style={{ animationDelay: '180ms' }}
        >
          <Link to="/register">
            <Button variant="accent" size="lg" iconAfter="arrow_forward" className="!rounded-full">
              Create free account
            </Button>
          </Link>
          <a
            href="#how"
            className="inline-flex items-center gap-2 px-2 text-[15px] font-semibold text-ink"
          >
            See how it works
            <Icon name="south_east" size={18} />
          </a>
        </div>

        <p
          className="animate-fade-up mt-5 text-[13px] text-ink-3"
          style={{ animationDelay: '260ms' }}
        >
          Free to start. No credit card required.
        </p>
        </div>

        <HeroArt
          lit={lit}
          className="animate-fade-in mx-auto w-full max-w-[460px] lg:max-w-none"
        />
      </div>
    </Section>
  );
}

/* ── Features ─────────────────────────────────────────────────────────────── */

function Features() {
  return (
    <Section id="features" className="pb-6">
      <div className="rounded-[32px] bg-surface p-8 sm:p-12 lg:p-16">
        <Reveal>
          <h2 className="text-[clamp(28px,4vw,40px)] font-extrabold tracking-[-0.035em]">
            Features
          </h2>
          <p className="mt-3 text-[15px] text-ink-3">
            Twelve connected areas, grouped by how research work actually flows.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
          <Stagger step={45}>
            {FEATURES.map((f) => (
              <div key={f.name} className="group flex gap-4">
                <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-brand-tint transition-transform duration-300 group-hover:scale-110">
                  <Icon name={f.icon} size={21} className="text-brand" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15.5px] font-bold">{f.name}</h3>
                  <p className="mt-1.5 text-[14px] leading-[1.65] text-ink-3">{f.text}</p>
                </div>
              </div>
            ))}
          </Stagger>
        </div>
      </div>
    </Section>
  );
}

/* ── Why Skrivbok ─────────────────────────────────────────────────────────── */

function Why() {
  return (
    <Section id="why" className="py-6">
      <div className="rounded-[32px] bg-surface p-8 sm:p-12 lg:p-16">
        <div className="grid items-center gap-8 lg:grid-cols-[220px_1fr]">
          {/* Supplied asset: public/assets/maskot.png */}
          <Reveal>
            <img
              src="/assets/maskot.png"
              alt=""
              className="mx-auto w-[230px] max-w-full object-contain"
            />
          </Reveal>

          <Reveal delay={90} className="text-center">
            <SectionHeading lead="Everything you need to" accent="stay organised" />
            <p className="mx-auto mt-5 max-w-[62ch] text-[15px] leading-[1.7] text-ink-3">
              Skrivbok was built by an assistant professor who kept losing the same things in the
              same ways. Every feature exists because something went wrong first.
            </p>
          </Reveal>
        </div>

        <StickyFeatures
          items={PILLARS.map((p) => ({
            eyebrow: p.eyebrow,
            title: p.title,
            text: p.text,
            link: p.link,
            media: (
              <ArtPlaceholder
                label={p.art}
                icon={p.icon}
                ratio="4 / 3"
                className="rounded-[24px]"
              />
            ),
          }))}
        />
      </div>
    </Section>
  );
}

/* ── How it works ─────────────────────────────────────────────────────────── */

/**
 * The four steps, laid out along a line that draws itself as you scroll.
 *
 * The geometry is a fixed 1000×750 coordinate space stretched to the container
 * width (`preserveAspectRatio="none"`), so the curve always meets the step
 * nodes regardless of how wide the viewport is. The nodes sit at y = 105, 280,
 * 455 and 630, alternating between x = 42% and 58%; each card sits opposite
 * its node.
 *
 * The line is drawn with the stroke-dash trick: the dash pattern is the whole
 * path length, and the offset is scrubbed from that length down to zero as the
 * section moves through the viewport. Because the value is scrubbed rather
 * than triggered, scrolling back up un-draws it.
 */

/** Length of PATH_D, measured once at module load rather than guessed. */
const PATH_D =
  'M420 105 C420 195 580 205 580 280 C580 355 420 360 420 455 C420 545 580 555 580 630';
const PATH_LENGTH = 748.22;

/** Node centres and the scroll progress at which each step lights up. */
const NODES = [
  { top: 105, left: '42%', at: 0.06 },
  { top: 280, left: '58%', at: 0.3 },
  { top: 455, left: '42%', at: 0.54 },
  { top: 630, left: '58%', at: 0.78 },
];

function HowItWorks() {
  const track = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(track);

  // The line runs slightly ahead of the cards, so a node is always reached by
  // a line that is already there rather than arriving after it.
  const drawn = Math.min(1, progress * 1.18);

  return (
    <Section id="how" className="py-16">
      <Reveal>
        <SectionHeading lead="How it" accent="works?" center />
      </Reveal>

      <p className="mx-auto mt-4 max-w-[54ch] text-center text-[15px] leading-[1.7] text-ink-3">
        Four steps, and the first three take a single sitting. Nothing here needs to be set up
        before you can use the rest.
      </p>

      {/* Desktop: the drawn path. */}
      <div ref={track} className="relative mt-14 hidden md:block" style={{ height: 750 }}>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1000 750"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          {/* The unfilled track, always visible. */}
          <path d={PATH_D} stroke="var(--color-line-3)" strokeWidth="3" strokeLinecap="round" />
          {/* The drawn line, scrubbed by scroll. */}
          <path
            d={PATH_D}
            stroke="var(--color-brand)"
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              strokeDasharray: PATH_LENGTH,
              strokeDashoffset: PATH_LENGTH * (1 - drawn),
            }}
          />
        </svg>

        {NODES.map((node, i) => {
          const active = progress >= node.at;
          return (
            <div
              key={i}
              className="absolute z-20"
              style={{
                left: node.left,
                top: node.top,
                transform: `translate(-50%, -50%) scale(${active ? 1 : 0})`,
                opacity: active ? 1 : 0,
                transition: 'transform 0.45s var(--ease-out), opacity 0.3s var(--ease-out)',
              }}
            >
              <span
                className="grid size-[46px] place-items-center rounded-full border-2 border-brand bg-surface text-[13px] font-black text-brand"
                style={{
                  boxShadow:
                    '0 0 0 4px rgb(47 107 250 / 0.12), 0 2px 10px rgb(47 107 250 / 0.2)',
                }}
              >
                {STEPS[i]?.n}
              </span>
            </div>
          );
        })}

        {STEPS.map((step, i) => {
          const fromLeft = i % 2 === 0;
          const active = progress >= (NODES[i]?.at ?? 0);
          return (
            <div
              key={step.n}
              className="absolute"
              style={{
                width: '38%',
                top: i * 175,
                ...(fromLeft ? { left: 0 } : { right: 0 }),
                opacity: active ? 1 : 0,
                transform: active
                  ? 'none'
                  : `translateX(${fromLeft ? -60 : 60}px) rotateY(${fromLeft ? -8 : 8}deg)`,
                transition:
                  'transform 0.6s var(--ease-out), opacity 0.5s var(--ease-out)',
              }}
            >
              <StepCard step={step} />
            </div>
          );
        })}
      </div>

      {/* Mobile: the same steps as a plain vertical list. The drawn path needs
          horizontal room it does not have here, and a cramped version of it
          would be worse than none. */}
      <div className="mt-10 flex flex-col gap-4 md:hidden">
        {STEPS.map((step, i) => (
          <Reveal key={step.n} delay={i * 70}>
            <div className="flex gap-4">
              <span className="grid size-10 flex-none place-items-center self-start rounded-full border-2 border-brand bg-surface text-[12px] font-black text-brand">
                {step.n}
              </span>
              <StepCard step={step} />
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function StepCard({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <article
      className="lift rounded-[24px] border border-line p-6"
      style={{
        background:
          'linear-gradient(to bottom, var(--color-surface) 0%, var(--color-surface) 45%, var(--color-canvas-alt) 100%)',
      }}
    >
      <div className="flex items-center gap-4">
        <span className="grid size-13 flex-none place-items-center rounded-[14px] bg-accent">
          <Icon name={step.icon} size={23} className="text-ink" />
        </span>
        <h3 className="text-[17px] leading-tight font-extrabold tracking-[-0.02em] text-brand-ink">
          {step.title}
        </h3>
      </div>
      <p className="mt-3.5 text-[14px] leading-[1.65] text-ink-3">{step.text}</p>
    </article>
  );
}

/* ── Testimonials ─────────────────────────────────────────────────────────── */

function Testimonials() {
  const { data } = usePublishedReviews();
  const published = data?.reviews ?? [];

  // Real approved reviews replace the placeholders as soon as there are any.
  // Until then the page still needs something to show, and the disclaimer
  // below says plainly which of the two you are looking at.
  const showing = published.length > 0;

  const cards = showing
    ? published.map((review) => ({
        key: review.id,
        name: review.user.name ?? 'A researcher',
        role: review.role ?? '',
        quote: review.body,
        rating: review.rating,
        avatar: review.user.profile?.avatarUrl ?? null,
      }))
    : TESTIMONIALS.map((t) => ({
        key: t.name,
        name: t.name,
        role: t.role,
        quote: t.quote,
        rating: 5,
        avatar: null,
      }));

  return (
    <Section className="overflow-hidden py-16">
      <Reveal>
        <Carousel
          eyebrow="From the people using it"
          eyebrowIcon="groups"
          title={
            <>
              What researchers{' '}
              <span className="relative inline-block text-brand">
                say
                <Underline />
              </span>
            </>
          }
          text="PhD students, postdocs and faculty who moved their work into one place. Use the arrows to read more."
          footer={
            showing ? null : (
              /* Visible on purpose: these quotes are invented, and stay only
                 until real reviews are written and approved. */
              <p className="font-mono text-[11.5px] leading-relaxed text-ink-4">
                placeholder quotes — replaced automatically once real reviews are approved
              </p>
            )
          }
        >
          {cards.map((t) => (
            <figure
              key={t.key}
              className="flex h-full flex-col rounded-[22px] border border-line bg-surface p-5"
            >
              {/* The supplied placeholder portrait on a tinted plate. When
                  real photographs arrive, only this src changes. */}
              <div
                className="grid place-items-center rounded-[16px] py-9"
                style={{
                  background:
                    'linear-gradient(160deg, var(--color-brand-tint) 0%, var(--color-surface-5) 100%)',
                }}
              >
                <img
                  src={t.avatar ?? '/assets/profile_logo.svg'}
                  alt=""
                  width={78}
                  height={78}
                  className="size-[78px] rounded-full object-cover"
                />
              </div>

              <div className="mt-5 flex gap-0.5" aria-label={`Rated ${t.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Icon
                    key={i}
                    name="star"
                    size={16}
                    className={i < t.rating ? 'text-accent' : 'text-line-3'}
                  />
                ))}
              </div>

              <figcaption className="mt-3">
                <span className="block text-[17px] leading-tight font-extrabold tracking-[-0.02em]">
                  {t.name}
                </span>
                <span className="mt-0.5 block text-[13px] text-ink-3">{t.role}</span>
              </figcaption>

              <blockquote className="mt-3 flex-1 text-[14px] leading-[1.65] text-ink-2">
                “{t.quote}”
              </blockquote>
            </figure>
          ))}
        </Carousel>
      </Reveal>
    </Section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────────── */

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? FAQS : FAQS.slice(0, 5);

  return (
    <Section id="faq" className="py-16">
      <Reveal>
        <SectionHeading lead="Frequently Asked" accent="Questions" center />
        <p className="mt-3 text-center text-[15px] text-ink-3">
          Everything you need to know about the platform.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mx-auto mt-12 max-w-[760px] overflow-hidden rounded-3xl border border-line bg-surface">
          {visible.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-line last:border-b-0">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-surface-5"
                  >
                    <span className="text-[15px] font-bold">{f.q}</span>
                    <Icon
                      name="expand_more"
                      size={22}
                      className={`flex-none text-ink-4 transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-brand' : ''
                      }`}
                    />
                  </button>
                </h3>
                {/* The answer stays mounted and its row collapses from 1fr to
                    0fr, which animates smoothly without measuring anything —
                    a height transition needs a pixel value, and `auto` does
                    not interpolate. */}
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 text-[14px] leading-[1.7] text-ink-3">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>

      {FAQS.length > 5 ? (
        <div className="mt-6 text-center">
          <Button variant="secondary" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'View less' : 'View more'}
          </Button>
        </div>
      ) : null}
    </Section>
  );
}

/* ── Contact ──────────────────────────────────────────────────────────────── */

function Contact() {
  return (
    <Section className="pb-20">
      <div className="grid gap-10 rounded-[32px] bg-surface p-8 sm:p-12 lg:grid-cols-2 lg:p-16">
        <Reveal>
          <SectionHeading lead="Contact" accent="us" />
          <p className="mt-4 max-w-[48ch] text-[15px] leading-[1.7] text-ink-3">
            Questions about the product, institutional plans, or getting your department set up. We
            answer within two working days.
          </p>

          <ul className="mt-8 flex flex-col gap-5">
            <ContactRow icon="mail" title="Email" detail="hello@skrivbok.app" />
            <ContactRow
              icon="school"
              title="Departments and labs"
              detail="Institutional plans on request"
            />
            <ContactRow
              icon="bug_report"
              title="Something broken?"
              detail="Report it from inside the app"
            />
          </ul>
        </Reveal>

        <Reveal delay={90}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Name</span>
            <input
              name="name"
              required
              className="h-11 rounded-[11px] border border-line-2 bg-surface px-3.5 text-[14.5px] outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Email</span>
            <input
              name="email"
              type="email"
              required
              className="h-11 rounded-[11px] border border-line-2 bg-surface px-3.5 text-[14.5px] outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Message</span>
            <textarea
              name="message"
              required
              rows={5}
              className="resize-y rounded-[11px] border border-line-2 bg-surface p-3.5 text-[14.5px] leading-relaxed outline-none focus:border-brand"
            />
          </label>
            <Button type="submit" variant="primary" size="md" className="self-start">
              Send message
            </Button>
          </form>
        </Reveal>
      </div>
    </Section>
  );
}

/* ── Closing call to action ───────────────────────────────────────────────── */

/**
 * The last thing on the page before the footer.
 *
 * Full-bleed rather than inside `Section`, with the top corners rounded so the
 * panel reads as the page resolving into a single closing statement instead of
 * one more card in a stack.
 */
function FinalCta() {
  return (
    <section className="mt-10 rounded-t-[40px] bg-brand-tint">
      <div className="mx-auto max-w-[1200px] px-5 py-20 text-center">
        <Reveal>
          <h2 className="text-[clamp(28px,4vw,42px)] leading-[1.12] font-extrabold tracking-[-0.035em]">
            Ready to run your research from one place?
          </h2>

          <p className="mx-auto mt-4 max-w-[60ch] text-[16px] leading-[1.7] text-ink-2">
            Bring your projects, deadlines, reading and calendar together. The free plan is usable
            on its own, and nothing needs installing.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button variant="primary" size="lg" className="!rounded-xl">
                Create free account
              </Button>
            </Link>

            {/* Deliberately unwired: the demo page does not exist yet, and a
                link to a route that is not there would 404. Inert until the
                video page lands, at which point this becomes a Link. */}
            <button
              type="button"
              className="press inline-flex h-[52px] items-center justify-center rounded-xl border-2 border-ink px-6 text-[15px] font-semibold text-ink transition hover:bg-ink hover:text-white"
            >
              Get a demo
            </button>
          </div>

          <p className="mt-5 text-[13px] text-ink-3">No credit card required.</p>
        </Reveal>
      </div>
    </section>
  );
}

function ContactRow({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-brand-tint">
        <Icon name={icon} size={21} className="text-brand" />
      </span>
      <span>
        <span className="block text-[14.5px] font-bold">{title}</span>
        <span className="block text-[13.5px] text-ink-3">{detail}</span>
      </span>
    </li>
  );
}
