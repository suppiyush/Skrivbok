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
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { usePublishedReviews } from '../lib/queries';
import { useAuth } from '../lib/auth';
import { Reveal, Stagger } from '../components/ui/Motion';
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
    icon: 'folder_open',
    name: 'Project Management',
    text: 'Create and manage projects with descriptions, team members, progress tracking, and file organization. Keep all project details in one place.',
    tint: '#fdece0',
    fg: '#c2650b',
  },
  {
    icon: 'lightbulb',
    name: 'Ideas Workspace',
    text: 'Capture brilliant ideas as they come. Organize them by topics, add detailed descriptions, and never lose a creative thought again.',
    tint: 'var(--color-accent-tint)',
    fg: 'var(--color-warn-ink)',
  },
  {
    icon: 'sticky_note_2',
    name: 'Quick Notes',
    text: 'Take instant notes during meetings, lectures, or brainstorming sessions. Access them anytime with powerful search functionality.',
    tint: '#e0f5ee',
    fg: '#1f8a6f',
  },
  {
    icon: 'event_available',
    name: 'Deadline Tracking',
    text: 'Never miss a deadline with smart reminders. Visualize upcoming due dates and receive email notifications before important dates.',
    tint: 'var(--color-danger-tint)',
    fg: 'var(--color-danger)',
  },
  {
    icon: 'track_changes',
    name: 'Career & Goals',
    text: 'Set career milestones and track your professional growth. Break down long-term aspirations into achievable steps.',
    tint: '#f1e9fb',
    fg: '#7c4dbd',
  },
  {
    icon: 'calendar_month',
    name: 'Outlook Calendar',
    text: 'Integrate with your calendar to sync events, meetings, and deadlines. See your schedule alongside your tasks.',
    tint: 'var(--color-brand-tint)',
    fg: 'var(--color-brand)',
  },
  {
    icon: 'menu_book',
    name: 'Literature Manager',
    text: 'Organize research papers, articles, and references. Add notes, tags, and track your reading progress.',
    tint: '#e8eaff',
    fg: '#4f5bd5',
  },
  {
    icon: 'show_chart',
    name: 'Analytics Dashboard',
    text: 'Visualize your productivity patterns. Track completed goals, idea generation, and project progress over time.',
    tint: '#e3f7e9',
    fg: '#2f9e57',
  },
  {
    icon: 'rocket_launch',
    name: 'Future Work Planning',
    text: 'Plan upcoming tasks and long-term projects. Organize your pipeline of work and prioritize effectively.',
    tint: '#ffe9df',
    fg: '#e2572b',
  },
];

const PILLARS = [
  {
    art: 'placeholder: meetings and project timelines in one calendar',
    icon: 'groups',
    eyebrow: 'Communication',
    title: 'No more chasing your own brain.',
    text: 'See every team calendar, schedule meetings without the back and forth, and track project timelines from a single screen instead of piecing them together from old messages.',
  },
  {
    art: 'placeholder: ideas tagged and searchable',
    icon: 'lightbulb',
    eyebrow: 'Ideas',
    title: 'No more ideas falling through the cracks.',
    text: 'Keep every idea in one place instead of scattered across random files, tagged so you can find the right one again in seconds, months after you first wrote it down.',
  },
  {
    art: 'placeholder: papers linked to ideas and takeaways',
    icon: 'menu_book',
    eyebrow: 'Literature',
    title: 'No more digging through downloads.',
    text: 'Link every paper to the idea it belongs to, store your own key takeaways alongside it, and retrieve the whole thread whenever the topic comes back around.',
  },
  {
    art: 'placeholder: a deadline list with reminders',
    icon: 'flag',
    eyebrow: 'Deadlines',
    title: 'No more forgetting deadlines.',
    text: 'Store every deadline in one list with a real due date, and set reminders so nothing falls through the cracks between your diary and your inbox.',
  },
  {
    art: 'placeholder: career goals broken into stages',
    icon: 'timeline',
    eyebrow: 'Career goals',
    title: 'No more goals slipping away.',
    text: 'Track long-term goals step by step, with each stage broken down into something achievable, instead of holding fifty different milestones in your head at once.',
  },
  {
    art: 'placeholder: a dated journal entry',
    icon: 'history_edu',
    eyebrow: 'Journal',
    title: 'No more forgetting how you got there.',
    text: 'Make daily journal entries as the work happens, so your progress is always recorded and easy to follow, even months later when you need to write it all up again.',
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
    q: 'What does the free plan cover?',
    a: 'Up to five projects, five career goals and five literature entries, with unlimited ideas, notes, journal entries, deadlines and calendar events. Collaboration, sharing and email reminders are included, not paywalled.',
  },
  {
    q: 'How private is my calendar and journal?',
    a: 'Private by default. Calendar events are private unless you change them, and granting someone access to your calendar never reveals an event you have marked private. Journal entries are never shared.',
  },
  {
    q: 'How are deadline reminders sent?',
    a: 'By email, on the days before a deadline that you choose, at an hour you set, in your own timezone, correctly across daylight saving changes.',
  },
  {
    q: 'Can I invite collaborators who do not have an account yet?',
    a: 'Yes. Project invitations are sent by email and work even if the person has not registered. The invite waits for them until they sign up.',
  },
  {
    q: 'Can I get my data out if I ever want to leave?',
    a: 'Yes. Your work is yours. Projects, literature, notes and journal entries can be exported, and deleting your account removes your data rather than hiding it.',
  },
];

export default function Landing() {
  // Without this, the nav always renders its signed-out state — Log In and
  // Get Started stay in the header even after signing in, and following
  // either link back to a page RedirectIfAuthed doesn't cover reads as if
  // the session never took.
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-canvas-alt">
      <MarketingNav
        isSignedIn={Boolean(user)}
        ctaClassName="!bg-[color:var(--color-brand-deep)] hover:!brightness-110"
      />
      <main>
        <Hero />
        <Features />
        <Why />
        <Testimonials />
        <Faq />
        <GetOrganised />
      </main>
      <MarketingFooter />
    </div>
  );
}

/* ── Closing call to action ───────────────────────────────────────────────── */

function GetOrganised() {
  return (
    <section className="mt-10 rounded-t-[40px] bg-brand-tint">
      <div className="mx-auto max-w-[1200px] px-5 py-20 text-center">
        <Reveal>
          <h2 className="text-[clamp(28px,4vw,42px)] leading-[1.12] font-extrabold tracking-[-0.035em]">
            Get Organised Now
          </h2>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button
                variant="primary"
                size="lg"
                className="!rounded-xl !bg-[color:var(--color-brand-deep)] hover:!brightness-110"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <Section className="pt-14 pb-16 text-center lg:pt-24 lg:pb-24">
      {/* The hero is above the fold, so it animates on load rather than on
          scroll — an IntersectionObserver reveal would fire instantly anyway
          and cost a frame doing it. */}
      <div className="mx-auto max-w-[54rem]">
        <h1 className="animate-fade-up text-[clamp(38px,6.4vw,68px)] leading-[1.06] font-extrabold tracking-[-0.04em]">
          A place where your{' '}
          <span className="relative inline-block italic">
            ideas
            <Underline color="var(--color-brand)" />
          </span>{' '}
          and goals stay organised.
        </h1>

        <p
          className="animate-fade-up mx-auto mt-6 max-w-[52ch] text-[16.5px] leading-[1.7] text-ink-3"
          style={{ animationDelay: '90ms' }}
        >
          A platform inspired by my own struggles as an Assistant Professor.
        </p>

        <div
          className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: '180ms' }}
        >
          <Link to="/register">
            <Button
              variant="accent"
              size="lg"
              iconAfter="arrow_forward"
              className="!bg-[color:var(--color-brand-deep)] !text-white hover:!brightness-110"
            >
              Create free account
            </Button>
          </Link>
          <a href="#features">
            <Button variant="secondary" size="lg">
              See how it works
            </Button>
          </a>
        </div>
      </div>

      <div className="animate-fade-up mt-14" style={{ animationDelay: '260ms' }}>
        <ArtPlaceholder
          label="Product screenshot / demo video"
          icon="play_circle"
          ratio="16 / 9"
          className="mx-auto max-w-[980px] rounded-[20px] border border-line shadow-[0_20px_60px_-20px_rgb(0_0_0/0.25)]"
        />
      </div>
    </Section>
  );
}

/* ── Features ─────────────────────────────────────────────────────────────── */

function Features() {
  return (
    <Section id="features" className="py-16">
      <Reveal>
        <SectionHeading
          lead="Everything you need to"
          accent="stay organised."
          size="text-[clamp(32px,4.6vw,46px)]"
          underline="var(--color-ink)"
        />
        <p className="mt-3 max-w-[56ch] text-[15px] text-ink-3">
          Tools designed to help you stay organized, and productive.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Stagger step={45}>
          {FEATURES.map((f) => (
            <div
              key={f.name}
              className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6"
            >
              <span
                className="grid size-11 flex-none place-items-center rounded-[13px]"
                style={{ background: f.tint }}
              >
                <Icon name={f.icon} size={21} style={{ color: f.fg }} />
              </span>
              <h3 className="mt-4 text-[15.5px] font-bold">{f.name}</h3>
              <p className="mt-1.5 text-[14px] leading-[1.65] text-ink-3">{f.text}</p>
            </div>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}

/* ── Why Skrivbok ─────────────────────────────────────────────────────────── */

function Why() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = PILLARS.length;

  const measure = () => {
    const node = track.current;
    if (!node) return;
    setActive(Math.round(node.scrollLeft / node.clientWidth));
  };

  const goTo = (index: number) => {
    const node = track.current;
    if (!node) return;
    const wrapped = ((index % count) + count) % count;
    // Stepping past either end loops around instantly rather than scrolling
    // back across every slide in between, which is what "wrap" is supposed
    // to feel like.
    const looped = index < 0 || index >= count;
    node.scrollTo({ left: wrapped * node.clientWidth, behavior: looped ? 'auto' : 'smooth' });
  };

  // Advances on its own, and stops the moment a pointer is over the carousel
  // so a reader isn't fighting the slide out from under them mid-read.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => goTo(active + 1), 3000);
    return () => clearInterval(id);
  }, [active, paused]);

  return (
    <Section id="why" className="py-6">
      <div className="rounded-[32px] p-8 sm:p-12 lg:p-16">
        <div
          ref={track}
          onScroll={measure}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="grid w-full flex-none snap-center items-center gap-10 lg:grid-cols-2"
            >
              <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
                <ArtPlaceholder
                  label={p.art}
                  icon={p.icon}
                  ratio="4 / 3"
                  showLabel={false}
                  className="rounded-[24px]"
                />
              </div>
              <div>
                <p className="text-[12.5px] font-bold tracking-[0.1em] text-brand uppercase">
                  {p.eyebrow}
                </p>
                <h3 className="mt-3 text-[clamp(26px,3.2vw,38px)] leading-[1.12] font-extrabold tracking-[-0.035em]">
                  {p.title}
                </h3>
                <p className="mt-4 max-w-[50ch] text-[17px] leading-[1.75] text-ink-3">{p.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => goTo(active - 1)}
            className="press grid size-8 place-items-center rounded-full bg-ink text-white transition hover:bg-[#1a2130]"
          >
            <Icon name="arrow_back" size={15} />
          </button>

          <div className="flex items-center gap-2">
            {PILLARS.map((p, i) => (
              <button
                key={p.title}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`size-2 rounded-full transition-colors ${
                  i === active ? 'bg-brand' : 'bg-line-3'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next"
            onClick={() => goTo(active + 1)}
            className="press grid size-8 place-items-center rounded-full bg-ink text-white transition hover:bg-[#1a2130]"
          >
            <Icon name="arrow_forward" size={15} />
          </button>
        </div>
      </div>
    </Section>
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
    <Section className="py-16">
      <Reveal>
        <h2 className="text-center text-[clamp(28px,3.6vw,42px)] leading-[1.12] font-extrabold tracking-[-0.035em]">
          What researchers{' '}
          <span className="relative inline-block text-brand">
            say
            <Underline color="var(--color-ink)" />
          </span>
        </h2>

        <p className="mx-auto mt-4 max-w-[54ch] text-center text-[15.5px] leading-[1.7] text-ink-3">
          PhD students, postdocs and faculty who moved their work into one place.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Stagger step={45}>
          {cards.slice(0, 3).map((t) => (
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
        </Stagger>
      </div>
    </Section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────────── */

function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" className="py-16">
      <Reveal>
        <SectionHeading
          lead="Frequently Asked"
          accent="Questions"
          center
          underline="var(--color-ink)"
        />
        <p className="mt-3 text-center text-[15px] text-ink-3">
          Everything you need to know about the platform.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mx-auto mt-12 max-w-[760px] overflow-hidden rounded-3xl border border-line bg-surface">
          {FAQS.map((f, i) => {
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
    </Section>
  );
}
