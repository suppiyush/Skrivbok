# Skrivbok — Landing Page Specification

**Scope:** the public marketing page at `/`. Nothing else.

**This document contains no colour or typography direction.** Those belong to the
design system (see `design-brief.md` §2). This is about **structure, content and
copy**.

**All copy in this document is new and final-draft.** It is written to be used, not
paraphrased. The existing landing page was written in a casual, confessional
first-person voice; everything here is rewritten in a professional register while
keeping the one thing worth keeping — that the product came from a real
researcher's real problems.

---

## 1. Objective

One job: **convince a working researcher, in under ninety seconds, that this
solves a problem they actually have — and get them to create an account.**

Secondary jobs, in order:

1. Make the founder's credibility visible without making the page about him
2. Show what the product does, concretely
3. State the price plainly
4. Answer the three objections that stop academic users signing up (§9)

**Primary conversion:** Create account.
**Secondary conversion:** Watch the product walkthrough.

## 2. Audience and mindset

The visitor is a PhD student, postdoc or faculty member. They arrived from a
colleague's recommendation, a conference, or a link in a departmental email.

They are **sceptical of productivity software.** They have abandoned three
similar tools already. They are asking:

- _Is this built by someone who understands academic work, or is it a generic
  task app with a university stock photo?_
- _Will I still be able to get my data out in three years?_
- _Is this another thing I have to maintain?_

The page must answer all three without being asked.

## 3. Voice

**Professional, specific, plain.** Write the way a competent colleague explains
something useful.

| Do                                                                              | Don't                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| State what it does                                                              | Promise transformation                                              |
| Use researchers' own vocabulary — _literature, supervision, submission, cohort_ | Use startup vocabulary — _supercharge, unleash, 10x, game-changing_ |
| Concrete numbers and nouns                                                      | Vague benefit language                                              |
| Short declarative sentences                                                     | Exclamation marks                                                   |
| Confident and calm                                                              | Chatty, self-deprecating, or apologetic                             |

**Banned from this page:** "chaos", "messy", "brain", "boom", "Classic.",
"nightmare", "cool", emoji, and any sentence ending in an exclamation mark.

---

## 4. Page structure

Nine sections, in this order.

```
1  Navigation (sticky)
2  Hero
3  Product walkthrough (video)
4  The problem  — six research-workflow problems
5  Feature overview  — what is actually in the product
6  Collaboration  — the part competitors do not have
7  Pricing
8  Closing call to action
9  Footer
```

---

## 5. Section-by-section

### 5.1 Navigation — sticky

**Contents:** logo + wordmark (left) · anchor links (centre, desktop only) ·
auth action (right)

**Anchor links:** Features · Collaboration · Pricing

**Auth action:** two states.

| State      | Label                                              | Destination           |
| ---------- | -------------------------------------------------- | --------------------- |
| Signed out | `Sign in` (secondary) + `Create account` (primary) | `/login`, `/register` |
| Signed in  | `Open Skrivbok`                                    | `/dashboard`          |

The signed-in state matters — returning users hit `/` often.

**Behaviour:** transparent over the hero, gains a border and solid background on
scroll. Collapses to a menu button below 900px.

---

### 5.2 Hero

**Purpose:** state what this is and who it is for, in one screen, with no scrolling.

**Eyebrow**

> Built for academic research

**Headline**

> Your projects, deadlines, literature and ideas — in one place, for the whole
> length of a research career.

_Alternative, if a shorter headline is preferred:_

> One workspace for the whole of a research career.

**Subheading**

> Skrivbok brings together the work that currently lives in a notes app, a
> spreadsheet of deadlines, a reference folder and three separate calendars.
> Built by a researcher, for the way research actually runs.

**Primary action:** `Create free account`
**Secondary action:** `Watch the walkthrough` — smooth-scrolls to §5.3

**Supporting line beneath the actions:**

> Free to start. No credit card required.

**Visual:** a real product screenshot — the Dashboard or Calendar — not an
abstract illustration. It should be legible enough to convey density and
seriousness. If the interface is not ready, use a considered placeholder, never
a stock photograph of a laptop.

**Requirements**

- Headline visible without scrolling at 1440×900 and on a 390px phone
- No hero carousel, no auto-playing video, no parallax
- The screenshot should suggest a _populated_ workspace, not an empty one

---

### 5.3 Product walkthrough

**Purpose:** the highest-intent visitors want to see it work.

**Section heading**

> See how it works

**Supporting line**

> A four-minute walkthrough of a working setup — projects, deadlines, the
> calendar and shared access.

**Contents:** one 16:9 video, click-to-play, poster frame from real product UI,
duration shown.

**Requirements**

- **Never auto-play**
- The poster frame must be a real screenshot
- Captions/subtitles required
- If the video does not exist yet, **hide this section** rather than shipping a
  play button that does nothing. The current page has six placeholder players
  that show an alert; that costs more credibility than the section gains.

---

### 5.4 The problem — six research-workflow problems

**Purpose:** recognition. The visitor should read at least two of these and think
_that is exactly my week_.

This is the most important section on the page. It is also where the existing
page is strongest in substance and weakest in register — the problems are real
and specific; the writing is too casual. All six are rewritten below.

**Section heading**

> Six problems that research software usually ignores

**Section introduction**

> Skrivbok was built by an assistant professor who kept losing the same things in
> the same ways. Every feature exists because something went wrong first.

**Layout:** two columns on desktop, one on mobile. Numbered 01–06. Each card:
number · title · problem (2–3 sentences) · resolution (1–2 sentences, naming the
feature).

---

#### 01 — Decisions disappear between meetings

**Problem**

> A supervision meeting produces four decisions and two deadlines. A week later
> the notes are in a notebook at home, the deadlines are in an email thread, and
> nobody remembers what was agreed about the third experiment.

**Resolution**

> Notes, deadlines and calendar events belong to the project they came from.
> Shared calendars mean scheduling the next meeting takes one exchange instead of
> ten.

---

#### 02 — Ideas arrive at the wrong moment

**Problem**

> A good idea surfaces while reading someone else's paper — and there is no time
> to pursue it. It goes into a new document with a name that made sense that day.
> Six months later there are eleven such documents and no way to tell which
> contains what.

**Resolution**

> Ideas are captured in seconds, with categories and search. Future Work holds
> the ones that are worth returning to, with a timeline attached.

---

#### 03 — Papers are downloaded, then lost

**Problem**

> A paper is saved with a filename that seemed descriptive at the time. A year
> later the topic comes round again and the paper cannot be found — not in
> Downloads, not in email, not anywhere.

**Resolution**

> The literature library holds the reference, the links, the tags and your own
> summary of why it mattered. Filter by any combination of tags to find it again.

---

#### 04 — Deadlines live in too many places

**Problem**

> Submission dates, review windows, grant reports and teaching obligations end up
> split across a calendar, a spreadsheet and a diary. Missing one is rarely a
> matter of forgetting — it is a matter of never having them in one list.

**Resolution**

> One deadline list with priority, status and timezone-aware email reminders,
> sent at the hour you choose, in the timezone you are actually in.

---

#### 05 — Long-term goals have no structure

**Problem**

> Promotion criteria, publication targets and skills to acquire are real
> objectives with real consequences, but they span years. Held only in memory,
> they are reconstructed from scratch every time they come up.

**Resolution**

> Career goals are broken into stages. Each advance is recorded with a note, so
> the progress log writes itself — and is there when the case has to be made.

---

#### 06 — The record of how the work was done is lost

**Problem**

> Experiments, failed approaches and the reasoning behind a decision are rarely
> written down. Four months later the result is still there, and the path to it
> is gone.

**Resolution**

> A research journal, dated by the day the work happened rather than the day it
> was written up. Searchable, private, and yours for the whole project.

---

**Requirements**

- Each card must be readable on its own — visitors scan, they do not read in order
- No video placeholders inside these cards
- Do not number them as "steps"; they are independent problems

---

### 5.5 Feature overview

**Purpose:** show scope. The visitor should understand this is a complete
workspace, not a single-purpose tool.

**Section heading**

> What is in Skrivbok

**Supporting line**

> Twelve connected areas, grouped by how the work actually flows.

**Layout:** grouped into the product's four groups. Group heading + feature cards
beneath.

> **Important:** every claim below is checked against what the backend actually
> does. See §8 for the claims that must **not** be made.

#### Capture

| Feature     | Copy                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Ideas**   | Record an idea in seconds, before it goes. Categorise and colour them, then search across everything you have written. |
| **Notes**   | Meeting notes, lecture notes, working notes. Pin the ones you return to; find the rest by search.                      |
| **Journal** | A dated record of how the work was done. Entries are dated by when the work happened, not when you wrote them up.      |

#### Organise

| Feature         | Copy                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Projects**    | Every project with its own members, progress, notes and a structured brief. Invite collaborators by email, with view or edit access. |
| **Literature**  | Your reading, with authors, year, links, tags and your own summary. Filter by any combination of tags.                               |
| **Future Work** | The ideas worth returning to, with a priority and a rough timeline.                                                                  |

#### Commit

| Feature       | Copy                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Deadlines** | Priority, status and due time in your own timezone. Email reminders arrive on the days you choose.                                |
| **Calendar**  | Events, recurring commitments and meetings, with per-event privacy. Recurring events stay correct across daylight-saving changes. |
| **Meetings**  | Propose a time, see it accepted or declined, and have the event appear on both calendars at once.                                 |

#### Grow

| Feature              | Copy                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| **Career goals**     | Long-term objectives broken into stages, with a permanent record of each advance.                       |
| **Academic profile** | Degrees, appointments, grants, awards, teaching and research interests, kept in one structured place.   |
| **Resume**           | Generate a formatted CV from your profile. Share it with a private link you can switch off at any time. |

---

### 5.6 Collaboration

**Purpose:** the strongest differentiator, and the one the current page does not
mention at all. Give it its own section.

**Section heading**

> Shared work, without shared inboxes

**Body**

> Research is collaborative and calendars are private. Skrivbok treats both as
> true.
>
> Grant a colleague access to your calendar at one of two levels: they see when
> you are busy, or they see the events you have marked visible. Events you keep
> private stay private at either level — granting access is not the same as
> giving everything away.
>
> Projects work the same way. Invite someone by email, choose whether they can
> edit or only view, and hand over ownership when a project changes hands.
> Invitations work even if the person does not have an account yet.

**Three supporting points**

| Point                             | Copy                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Two levels of calendar access** | Free/busy shows when you are occupied. Full view shows the detail of events you have made visible. You choose per person. |
| **Private stays private**         | Any event marked private is never shown to anyone, at any access level.                                                   |
| **Find a time that works**        | Check several colleagues' availability at once and propose a meeting from what you see.                                   |

**Visual:** a simplified diagram of the same week seen by the owner and by a
colleague with free/busy access — the second showing plain "Busy" blocks. This
communicates the privacy model faster than any paragraph.

---

### 5.7 Pricing

**Purpose:** state the price plainly. **The current landing page has no pricing
section at all**, which forces an interested visitor to register before finding
out what it costs.

**Section heading**

> Pricing

**Supporting line**

> Start free. Upgrade when you outgrow it.

**Two cards.**

|          | **Free**                                                                                                                                                                                             | **Pro**                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Price    | ₹0                                                                                                                                                                                                   | ₹499 / month · ₹4,999 / year                                                             |
| Line     | Everything you need to start                                                                                                                                                                         | For sustained research work                                                              |
| Included | Up to 5 projects · Up to 5 career goals · Up to 5 literature entries · **Unlimited** ideas, notes, journal entries, deadlines and calendar events · Full collaboration and sharing · Email reminders | Everything in Free, without the limits · Unlimited projects, career goals and literature |
| Action   | `Create free account`                                                                                                                                                                                | `Create account`                                                                         |

**Note beneath the cards**

> The yearly plan is equivalent to ₹417 per month.

**Requirements**

- Be explicit that collaboration, reminders and sharing are **not** paywalled —
  only three resource caps are
- Monthly/yearly toggle, or show both. Do not hide the yearly saving
- No fake urgency, no countdowns, no "most popular" badge on a two-plan page

---

### 5.8 Closing call to action

**Heading**

> Start with the next deadline

**Body**

> Create an account, add the things due this month, and see whether it holds up.
> Nothing is required beyond an email address.

**Primary action:** `Create free account`
**Secondary action:** `Sign in`

Keep this short. A visitor who has read this far does not need another argument.

---

### 5.9 Footer

**Columns**

| Product                                      | Legal                                                                      | Support |
| -------------------------------------------- | -------------------------------------------------------------------------- | ------- |
| Features · Collaboration · Pricing · Sign in | Terms and Conditions · Privacy Policy · End User Agreement · Refund Policy | Contact |

**Bottom line**

> Skrivbok — a workspace for academic research. © [year]

All five legal pages exist and are linked from here. **Refund Policy and Terms
are a payment-provider requirement** — they must be reachable from the footer of
every public page.

---

## 6. Optional section — platform activity

An endpoint returns live counts: `{ users, projects, ideas, careerGoals }`.

**Include only if the numbers are genuinely impressive.** Small honest numbers on
a landing page do more harm than no numbers. If included, place it between §5.5
and §5.6, and label it plainly:

> Researchers are using Skrivbok to track **N** projects and **N** literature
> entries.

**Design the section as removable** — it should not leave a hole in the layout.

---

## 7. Assets required

| Asset                          | Notes                                  | Blocking?                        |
| ------------------------------ | -------------------------------------- | -------------------------------- |
| Logo and wordmark              | Currently a placeholder                | Yes                              |
| Hero screenshot                | Real UI, populated with realistic data | Yes                              |
| 3–5 feature screenshots        | For §5.5 and §5.6                      | No — can ship with copy only     |
| Privacy-model diagram          | Two calendar views side by side (§5.6) | No                               |
| Walkthrough video + poster     | ~4 minutes, captioned                  | No — hide the section without it |
| Favicon and social share image | Open Graph 1200×630                    | Before launch                    |

**Screenshot rule:** populated with realistic academic content — real-sounding
project names, plausible paper titles, a full week in the calendar. **Never
`Lorem ipsum`, never "Test project 1", never an empty state.**

---

## 8. Claims that must NOT be made

The existing landing page promises several things the product does not do. These
are removed above and must not return.

| Old claim                                                          | Reality                                                                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| "Outlook Calendar" · "Integrate with your calendar to sync events" | **There is no external calendar integration.** Skrivbok has its own calendar. Do not imply Outlook, Google Calendar or iCal sync. |
| "Analytics Dashboard — visualise your productivity patterns"       | Analytics is **administrator-only**. Users have summary counts, not a personal analytics dashboard.                               |
| Project management with "file organization"                        | **There is no file upload or storage.** Projects hold text, members and a brief.                                                  |
| Literature "track your reading progress"                           | **No reading-progress field exists.** Literature has title, authors, year, links, tags and a summary.                             |

**Rule: if it is not in §5.5, it does not exist. Do not add features to the copy.**

Two things the product _does_ do that the old page never mentioned, both worth
promoting: **calendar sharing with privacy levels**, and **CV generation from
the profile**.

---

## 9. The three objections to answer

Every section above should be checked against these.

| Objection                                      | Where it is answered                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| _"Generic task app, not built for academics."_ | §5.4 — six problems only a researcher would list. §5.5 — literature, supervision, career stages.    |
| _"Another tool to maintain."_                  | §5.4 resolutions — everything connects to the project it came from. §5.8 — start with one deadline. |
| _"What does it cost, really?"_                 | §5.7 — prices stated, caps named, no dark patterns.                                                 |

---

## 10. Page-wide requirements

### States

| State                | Handling                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Signed-out (default) | Full page as specified                                                                           |
| **Signed in**        | Nav shows `Open Skrivbok`; hero action becomes `Go to dashboard`; pricing marks the current plan |
| Live counters fail   | Hide §6 entirely, no error, no zeros                                                             |
| Video not ready      | Hide §5.3 entirely                                                                               |
| Reduced motion       | All scroll and reveal animations disabled                                                        |
| Slow connection      | Text renders before images; no layout shift when images arrive                                   |

### Responsive

| Width     | Treatment                                                                     |
| --------- | ----------------------------------------------------------------------------- |
| ≥1440     | Full layout. Problem cards 2-up, features 3-up                                |
| 1024–1439 | Same structure, tightened spacing                                             |
| 768–1023  | Problem cards 1-up, features 2-up, nav collapses                              |
| <768      | Single column throughout. Actions full-width. Pricing cards stack, Free first |

### Performance

- Largest Contentful Paint under 2.0s on a mid-range laptop
- Hero image preloaded; everything below the fold lazy-loaded
- No layout shift (CLS ≈ 0) — reserve space for every image
- Video loads only on click, never on page load

### Accessibility

- One `<h1>`; heading levels in order
- All actions reachable and operable by keyboard, with a visible focus state
- Every image has meaningful alternative text; decorative images marked as such
- Video has captions
- Contrast meets WCAG AA (specifics in the design system)

### SEO and sharing

- **Title:** `Skrivbok — a research workspace for projects, deadlines and literature`
- **Meta description:** `One workspace for academic research: projects, deadlines, literature, ideas, calendar and career goals. Free to start.`
- Open Graph and Twitter card images
- Semantic landmarks: `header`, `nav`, `main`, `section`, `footer`

---

## 11. What not to do

1. **No stock photography.** No smiling people at laptops, no abstract science
   imagery, no glass buildings.
2. **No fake social proof.** No invented testimonials, no logo wall of
   universities that have not agreed, no fabricated user counts.
3. **No countdowns, no urgency banners, no exit-intent popups.** This audience
   reacts badly to all three.
4. **No auto-playing anything.**
5. **No cookie-banner theatre.** If a banner is needed, keep it small and honest.
6. **No newsletter modal.** The conversion is the account, not an email address.
7. **No placeholder players that show an alert.** Ship the video or hide the
   section.
8. **Do not make the page about the founder.** The origin story is credibility,
   delivered in one sentence in §5.4. It is not the subject of the page.

---

## 12. Open questions

1. **Founder attribution** — one line in §5.4, or a short named section with a
   photograph? A named academic adds real credibility to this audience.
2. **Walkthrough video** — is one being produced? If not, §5.3 is cut for launch.
3. **Live counters** — what are the real numbers today? That decides §6.
4. **Institutional pricing** — is a department or lab plan planned? If so, the
   pricing section needs a third column and this changes the layout now rather
   than later.
5. **Currency** — INR only, or is international pricing planned? Affects whether
   pricing needs to be locale-aware.
