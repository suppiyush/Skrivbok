# Skrivbok — Complete UI Design Brief

**Read this whole document before designing anything.**

This is a self-contained brief. It assumes no knowledge of the product and
carries no legacy design decisions — **there is no existing palette,
typography, spacing scale, icon set or component library to inherit or match.
Start from a blank page.** Any earlier Skrivbok interface is irrelevant; do not
reference it.

The backend is finished and tested: 133 endpoints, 25 database models. Every
field, state and permission described here is real and already implemented.
Design against it exactly.

---

# PART 1 — PRODUCT CONTEXT

## 1.1 What Skrivbok is

A **workspace for academic and research work**. One application holding
everything a researcher currently scatters across a notes app, a spreadsheet of
deadlines, a reference manager, a shared calendar and a folder of drafts.

_Skrivbok_ is Swedish for "writing book" — a notebook.

## 1.2 Who uses it

PhD students, postdoctoral researchers, professors, research staff. Ages roughly
24–65. International: a single project routinely spans three countries.

Nine facts that should drive every design decision:

1. **They live in it.** Hours a day, most days, for three to seven years. This is
   a tool, not a destination. It should feel like a well-organised desk, not a
   product demo.
2. **Density beats decoration.** They would rather see 25 items than 6 large
   cards. Generous whitespace reads as "wasting my screen".
3. **Data accumulates enormously.** A third-year PhD student has 300+ literature
   entries, 700+ journal entries, 40+ deadlines. **Design for the full drawer.**
   An interface that looks elegant with 3 items and collapses at 300 is a failure.
4. **Capture must be frictionless.** If recording an idea takes four clicks they
   will use a text file instead, and the feature is dead. Speed of entry beats
   completeness of form.
5. **Timezones are a daily reality.** Conferences, collaborators, visiting
   positions. Timezone is shown deliberately, not hidden.
6. **Privacy is not paranoia.** Unpublished results, grant applications, personal
   journal entries. When something is shared, that must be unmistakable.
7. **Desktop-first, genuinely.** 1440px+ is the primary target. Mobile is for
   checking a deadline or accepting a meeting, not writing.
8. **Long sessions, often at night.** Dark mode is not a nice-to-have.
9. **Not consumer-app users.** No gamification, no streaks-as-pressure, no
   celebration animations, no emoji in the UI chrome. Respect their seriousness.

## 1.3 The mental model — four groups

Navigation should express these. This is the product's spine.

| Group        | Screens                             | Character                                                                    |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------- |
| **Capture**  | Ideas · Notes · Journal             | Fast, low-friction, no required fields beyond a title. Get the thought down. |
| **Organise** | Projects · Literature · Future Work | Structured. Tagged, linked, searchable months later.                         |
| **Commit**   | Deadlines · Calendar · Meetings     | Time-bound. Things with consequences. Urgency is legible.                    |
| **Grow**     | Career Goals · Profile · Resume     | Long-horizon. Progress measured in years, not tasks.                         |

Two cross-cutting layers: **Collaboration** (project members, shared calendars,
meeting requests) and **Account** (notifications, billing, help, settings).

## 1.4 Commercial model

- **Free**: capped at **5 projects, 5 career goals, 5 literature entries**.
  Everything else unlimited.
- **PRO**: ₹499/month or ₹4999/year. Unlimited everything.

The cap is reached during _normal use_, not at the extremes. The limit-reached
moment must read as a natural next step, **never as a penalty** — the user just
tried to do something entirely reasonable.

---

# PART 2 — DESIGN DIRECTION

## 2.1 Character

Design a system that feels: **calm, precise, durable, quietly confident.**

Reference points for _feeling_ (not for copying): a well-made notebook, a
research library's catalogue, a good text editor, professional scientific
software. Think Linear's precision, Notion's flexibility, but calmer and less
playful than either.

Explicitly **not**: startup-bright, playful, gradient-heavy, illustration-led,
card-shadow-heavy, or anything that would look dated in three years.

## 2.2 What you must define from scratch

Nothing is inherited. Establish all of the following:

### Icons

Choose one set and stay in it. Outline style recommended for calmness. Define
sizes (16 / 20 / 24).

## 2.3 Layout system

- Desktop: fixed sidebar + fluid content region.
- Define a max content width for reading-heavy screens (~72ch for prose).
- Define a grid for card/list screens.
- Breakpoints: define 4. Suggested ≥1440 primary, 1024–1439, 768–1023, <768.

## 2.4 Density

Design **two density modes** where it is cheap to do so: comfortable and compact.
Power users with 300 literature entries will want compact. If two modes are too
much, design for compact and make it breathe.

## 2.5 Accessibility — non-negotiable

- WCAG **AA** minimum: 4.5:1 body text, 3:1 large text and UI boundaries.
- **Never colour alone.** Priority, status, and redaction states each need a
  second channel: icon, label, shape or weight.
- Visible focus ring on every interactive element, in both themes.
- Full keyboard operability, including the calendar grid.
- Minimum hit target 44×44 on touch.
- Every icon-only control needs an accessible label.

---

# PART 3 — BACKEND CONTEXT

Design cannot be correct without this. These are the real shapes.

## 3.1 Entities and their fields

Fields marked `?` are nullable. This is what you have to display and edit.

### User

`id` · `email` · `name?` · `role` (USER | ADMIN) · `plan` (FREE | PRO) ·
`timezone` (IANA, e.g. "Europe/Stockholm") · `subscriptionEndsAt?` ·
`emailVerifiedAt?` · `lastLoginAt?` · `createdAt`

### Idea

`id` · `title` · `content?` · `category` (free text, default "general") ·
`color` (YELLOW | PINK | BLUE | GREEN | PURPLE | ORANGE | GRAY) · `createdAt` ·
`updatedAt`

### Note

Same as Idea, plus `pinned` (boolean). **Pinned notes always sort first.**

### JournalEntry

`id` · `title?` · `content` (required, up to 100,000 chars) ·
`entryDate` (a calendar day — the day the entry is _about_, which may not be the
day it was written) · `mood?` (free text) · `createdAt` · `updatedAt`

### Deadline

`id` · `title` · `description?` · `dueAt` (exact instant) ·
`timezone` (the zone the user entered it in) ·
`priority` (LOW | MEDIUM | HIGH | URGENT) ·
`status` (PENDING | IN_PROGRESS | COMPLETED | CANCELLED) ·
`reminderEnabled` · `remindAt?` · `completedAt?` · `createdAt`

### FutureWork

`id` · `title` · `description?` · `priority` · `timeline?` (free text, e.g.
"next semester", "2027 H1")

### Literature

`id` · `title` · `authors?` · `year?` · `links` (array of URLs) ·
`tags` (array, lowercased) · `summary?` · `createdAt`

### CareerGoal

`id` · `title` · `description?` · `goalType` (free text) · `totalStages` (2–50) ·
`currentStage` (0–totalStages) · `stageDescription?` · `startAt?` · `targetAt?` ·
`achievedAt?` · plus computed `progressPercent` and `isAchieved`

### CareerStageHistory

`id` · `stage` · `description?` · `recordedAt` — an append-only log of progress

### Project

`id` · `name` · `description?` · `progress` (0–100) · `archivedAt?` · `owner` ·
`memberCount` · `myRole` (OWNER | EDITOR | VIEWER) · `invitePending` (boolean)

### ProjectMember

`id` · `email` · `name?` · `role` · `invitedAt` · `acceptedAt?` ·
`user?` (**null when the person has been invited but has not registered yet**)

### ProjectBrief — 25 fields, grouped

- **Project**: projectTitle, notes
- **Their contact**: colleagueName, colleaguePhone, colleagueEmail,
  colleagueAddress1–3
- **Your contact**: yourName, yourPhone, yourEmail, yourAddress1–3
- **The brief**: objectives, timeline, primaryAudience, secondaryAudience,
  callToAction, competition, graphics, photography, multimedia, otherInfo
- **Sign-off**: clientName, clientComments, approvalDate, approvalSignature

### CalendarEvent

`id` · `title` · `description?` · `location?` · `startAt` · `endAt` ·
`timezone` · `isAllDay` · `category` (free text, default "Work") · `priority` ·
`showAs` (FREE | BUSY | TENTATIVE | OUT_OF_OFFICE) ·
`visibility` (PRIVATE | BUSY | PUBLIC — **default PRIVATE**) · `isOnline` ·
`meetingLink?` · `attendees` (array of email strings) · `reminderMinutes?` ·
`recurrence` (NONE | DAILY | WEEKLY | BIWEEKLY | MONTHLY | YEARLY) ·
`recurrenceEndAt?` · `meetingRequestId?`

Plus, on an expanded occurrence: `seriesId` · `isRecurrence` (true for every
instance after the first).

### MeetingRequest

`id` · `title` · `description?` · `startAt` · `endAt` · `timezone` ·
`status` (PENDING | ACCEPTED | REJECTED | CANCELLED) · `respondedAt?` ·
`sender` · `receiver` · `isSender` (is the viewer the sender?) ·
`counterpart` (the other person) · `conflicts` (array — the viewer's own
clashing events)

### CalendarAccess / CalendarAccessRequest

Grant: `owner` · `viewer` · `level` (FREE_BUSY | VIEW) · `createdAt`
Request: `requester` · `target` · `status` (PENDING | APPROVED | REJECTED |
REVOKED) · `message?` · `respondedAt?` · `isRequester`

### Profile — 22 fields + 5 repeating sections

- **Identity**: fullName, designation, department, institution, officeAddress
- **Contact**: officialEmail, alternateEmail, phone, website, scholarLink
- **Research**: researchKeywords (comma-separated), researchDescription
- **Other prose**: skills, professionalActivities, outreachService
- **Sharing**: isResumePublic, resumeSlug
- **Repeating lists** (add/remove rows):
  - `degrees[]` — institution, degree, field?, startYear?, endYear?
  - `employment[]` — organisation, title, startYear?, endYear?, description?
  - `courses[]` — code?, title, level?, term?
  - `grants[]` — title, funder?, amount?, startYear?, endYear?
  - `awards[]` — title, awarder?, year?

### Notification

`id` · `type` · `title` · `message?` · `link?` · `readAt?` · `createdAt`

Nine types, each needs an icon and colour:
`DEADLINE_DUE` · `MEETING_REQUEST` · `MEETING_ACCEPTED` · `MEETING_REJECTED` ·
`CALENDAR_ACCESS_REQUEST` · `CALENDAR_ACCESS_GRANTED` · `PROJECT_INVITE` ·
`SUBSCRIPTION` · `SYSTEM`

### Report

`id` · `type` (BUG | FEATURE | FEEDBACK) · `featurePage?` · `title?` ·
`description` (min 10 chars) · `status` (OPEN | IN_PROGRESS | RESOLVED |
DISMISSED) · `resolution?` · `createdAt`

## 3.2 Universal API behaviours

### Every list is paginated

```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 25, "total": 137, "totalPages": 6,
                  "hasNext": true, "hasPrevious": false }
}
```

Default 25 per page, max 100. **Design pagination once and reuse it.**

### Every error has one shape

```json
{
  "error": {
    "code": "FREE_LIMIT_REACHED",
    "message": "Free accounts are limited to 5 projects...",
    "details": [{ "path": "body.title", "message": "Too small: expected >=1 characters" }],
    "requestId": "a01859e8-..."
  }
}
```

`details` is a per-field array — **design inline field errors, not just a toast**.
`requestId` should be shown on 500s so a user can quote it in a support report.

### Codes you must design for

| Code                                  | Status | Design response                         |
| ------------------------------------- | ------ | --------------------------------------- |
| `VALIDATION_FAILED`                   | 422    | Inline field errors                     |
| `UNAUTHENTICATED` / `SESSION_EXPIRED` | 401    | Redirect to login, preserve intent      |
| `FORBIDDEN`                           | 403    | Read-only or "ask for access" state     |
| `ADMIN_REQUIRED`                      | 403    | Not-authorised screen                   |
| `FREE_LIMIT_REACHED`                  | 403    | **Upgrade prompt**                      |
| `NOT_FOUND`                           | 404    | Empty/not-found state                   |
| `CONFLICT` / `ALREADY_EXISTS`         | 409    | Inline conflict message                 |
| `RATE_LIMITED`                        | 429    | "Too many attempts, wait a few minutes" |
| `SERVICE_UNAVAILABLE`                 | 503    | Feature-unavailable state               |

### Partial updates

`PATCH` writes only the fields sent. **An empty body returns 422** — a save
button with no changes should be disabled rather than sending nothing.

## 3.3 Permission models — three of them

### A. Single-owner (Ideas, Notes, Journal, Deadlines, Future Work, Literature, Career Goals)

You see only your own. Another user's record returns **404**, not 403. No sharing
UI needed at all on these screens.

### B. Project roles

`OWNER > EDITOR > VIEWER`

| Action                             | OWNER | EDITOR | VIEWER |
| ---------------------------------- | ----- | ------ | ------ |
| View project + brief + members     | ✅    | ✅     | ✅     |
| Edit project, edit brief           | ✅    | ✅     | ❌ 403 |
| Add/remove/change members          | ✅    | ❌     | ❌     |
| Transfer ownership, delete project | ✅    | ❌     | ❌     |
| Remove **themselves**              | —     | ✅     | ✅     |

**Design three variants of the project screen.** Decide and document: are
unavailable controls hidden or disabled-with-tooltip? (Recommendation: hidden for
VIEWER, since a viewer never gains the right; disabled-with-reason for EDITOR on
member controls, since they might ask the owner.)

### C. Calendar visibility — the most subtle one

Two independent settings combine:

**Per-event `visibility`** (set by the event's owner) ×
**Per-person `level`** (set when granting calendar access)

| Event visibility | Viewer has FREE_BUSY    | Viewer has VIEW         |
| ---------------- | ----------------------- | ----------------------- |
| `PRIVATE`        | **not returned at all** | **not returned at all** |
| `BUSY`           | opaque block            | opaque block            |
| `PUBLIC`         | opaque block            | full detail             |

A redacted event arrives as `{ redacted: true }` with **only** start, end,
`isAllDay` and `showAs`. **No title, no description, no location, no attendees,
no link.**

**Design consequence: you need two calendar event chip designs** — a full one and
an opaque "Busy" one. The opaque one must look deliberate and calm, not broken or
loading.

---

# PART 4 — GLOBAL PATTERNS

## 4.1 The seven states — design all of them for every screen

This is the single most commonly skipped part of a design and the most expensive
to add later.

1. **Loading** — skeleton matching the real layout, not a centred spinner
2. **Empty (first use)** — explains the feature, one clear action
3. **Empty (after filtering)** — _different_ message: "No results for X" + clear filters
4. **Error** — what failed, and a retry
5. **Read-only (403)** — visible content, edit affordances resolved per §3.3
6. **Limit reached** — free-tier cap, with an upgrade path
7. **Partial / stale** — one panel failed while others loaded

Plus, for anything with pagination: a **loaded, full page** state showing what
25 dense rows actually look like.

## 4.2 Component inventory

Design these once:

**Primitives** — Button (primary, secondary, ghost, danger; 3 sizes; loading and
disabled), Icon button, Input, Textarea (auto-growing), Select, Combobox,
Checkbox, Radio, Switch, Slider, Date picker, Time picker, **Timezone picker**,
Tag input, Colour picker (7 swatches), Segmented control

**Composites** — Card, List row, Table (sortable), Pagination, Tabs, Modal (3
sizes), Drawer, Popover, Dropdown menu, Tooltip, Toast, Inline alert (4
severities), Badge, Avatar (+ stacked group), Progress bar, Progress ring,
Skeleton, Empty state, Confirmation dialog (with a **destructive** variant that
requires typing a word)

**App-specific** — Priority indicator (4 levels, not colour-only) · Status pill ·
Quota meter ("3 of 5 used") · Calendar event chip (full + redacted) · Notification
row · Member row with role selector · Stage progress indicator · Tag chip with
count · Activity heatmap cell

## 4.3 Global chrome

### Sidebar (fixed, desktop)

- Product mark
- **User card**: avatar, name, email, **PRO badge when applicable** — clicking
  opens Profile
- Navigation grouped by the four groups in §1.3
- Bottom: Help & Feedback, Upgrade CTA (or "PRO" state), Sign out
- **Design collapsed (icon-only) and mobile-drawer variants**

### Top bar

- Current screen title + breadcrumb where nested
- Contextual search
- **Notification bell with unread count badge**
- User menu

### Notification panel

Dropdown from the bell. Grouped by read/unread. Per-item: type icon, title,
message, relative time, read dot. Actions: mark read, mark all read, clear read.
Clicking follows `link`.

---

# PART 5 — SCREEN SPECIFICATIONS

For each: route, data, layout, states, actions.

---

## 5.1 Landing page — `/`

**Public.** Purpose: explain the product and convert to sign-up.

- Hero: what Skrivbok is, in one sentence a researcher recognises
- Feature grid: the 12 features, grouped by the four groups from §1.3
- **Live platform counters** from `GET /public/stats` → `{ users, projects, ideas, careerGoals }`
- Pricing block: Free vs PRO (₹499/mo, ₹4999/yr)
- Footer: Terms, EULA, Refund, Privacy, Contact

**States:** default; stats-failed (hide the counters rather than showing zeros).

---

## 5.2 Login — `/login`

- Email, password, submit
- **"Continue with Google"** — `GET /auth/config` returns `{ googleEnabled }`.
  **Design the screen both with and without this button.**
- Link to register, link to forgot-password
- Error states: wrong credentials (401, deliberately identical for
  wrong-password and unknown-account — do not hint at which), rate-limited (429,
  "too many attempts, wait a few minutes")
- OAuth failure: the redirect carries `?error=google_declined |
google_state_mismatch | google_failed`. Design one inline error region that
  handles these.

## 5.3 Register — `/register`

- Name, email, password, **timezone picker** (defaults to browser-detected)
- Password rule: **minimum 8 characters, no composition requirements.** Do not
  design a "must contain a symbol" checklist — it does not exist.
- Inline errors: email taken (409), password too short (422), invalid timezone (422)

## 5.4 Set / change password

Two screens. **Change password must warn**: "This signs you out on your other
devices." The response returns `{ revokedSessions: n }` — confirm with "Signed
out of n other devices."

## 5.5 Legal pages ×5

Terms, EULA, Refund Policy, Privacy Policy, Contact. One long-form template.
Reading width ~72ch, clear heading hierarchy, table of contents for long ones.

---

## 5.6 Dashboard — `/dashboard`

The daily landing screen. Must answer "what needs me today?" in under three
seconds.

**Layout:**

- Greeting with first name; inline-editable name
- **Today strip**: overdue count, due today, today's events, pending meeting requests
- **Feature tile grid** — 8 tiles, one per feature. Each: icon in its accent,
  name, total count, 2–3 most recent items as one-line previews, click-through.
- Notification bell

**Data:** `GET /deadlines/summary` → `{ total, open, overdue, dueThisWeek, completed }`,
plus a small list per feature.

**States:** loading (skeleton tiles); brand-new user (all tiles empty — this is
the onboarding moment, design it deliberately); one tile failed while others
loaded.

---

## 5.7 Ideas — `/ideas`

**Purpose:** frictionless capture. This screen's success metric is time-to-first-keystroke.

- **Layout:** masonry or grid of sticky-note cards, dense
- **Card:** title, content preview, category chip, colour (one of 7), relative date
- **Create:** a persistent inline composer at the top, _not_ a modal behind a
  button. Title + content + category + colour. Enter to save.
- **Filters:** category (from `GET /ideas/categories`), colour, search, sort
  (newest | oldest | title)
- **Edit:** click a card → inline or modal editor
- **Delete:** confirm

**Design the 7 colours as card treatments** that remain legible in dark mode —
tinted surface + border, not saturated fills.

**States:** all seven. The 300-item state matters: show what dense looks like.

## 5.8 Notes — `/notes`

As Ideas, plus:

- **Pinned** state — pinned notes always sort first, in a visually distinct band
  or with a clear pin marker
- Longer content (up to 50,000 chars) — the editor needs to handle a full page
- Pin/unpin action on card and in editor

## 5.9 Journal — `/journal`

**Purpose:** reflective writing. The calmest screen in the app.

- **Layout:** two-pane — entry list (left) + reading/writing pane (right)
- **Entry:** optional title, required content (up to 100,000 chars), `entryDate`
  (defaults today, **editable** — you may write Tuesday's entry on Thursday),
  optional `mood`
- **Activity heatmap** — `GET /journal/activity?from&to` returns
  `[{ date, count }]`. A GitHub-style contribution grid. **Frame it as a record,
  not a streak to protect.** No guilt, no fire emoji.
- **Filters:** date range, mood, search
- **Writing mode:** consider a distraction-free full-width variant

**States:** all seven, plus "writing in progress / unsaved".

## 5.10 Deadlines — `/deadlines`

**Purpose:** nothing is missed. Urgency must be legible at a glance.

- **Summary bar:** total · open · **overdue** · due this week · completed
- **List:** grouped by urgency — Overdue / Today / This week / Later / Completed
- **Row:** title, due date **and time**, **timezone indicator**, priority,
  status, reminder-on indicator, description preview
- **Overdue rows need a distinct treatment** — but read as serious, not alarming.
  These are professionals, not a to-do gamification app.
- **Create/edit:** title, description, **date + time + timezone**, priority (4),
  status (4), reminder toggle, optional custom reminder time
- **Validation:** a reminder cannot be after the deadline (422)
- **Complete:** the server sets `completedAt`; reopening clears it. Design both
  transitions.
- **Filters:** status, priority, date range, `overdue=true`, search
- **Sorts:** due soonest | due latest | priority | newest

**Priority must not be colour-only** — pair with an icon, a bar, or a label.

## 5.11 Future Work — `/future-work`

Lightest screen. Title, description, priority, free-text `timeline`. List or
card grid, priority filter, search. Sorts: newest | oldest | priority | title.

## 5.12 Literature — `/literature`

**Purpose:** a reference library that stays usable at 300+ entries. **The screen
most at risk of collapsing under real data.**

- **Layout:** two-pane — tag sidebar + entry list
- **Tag sidebar:** `GET /literature/tags` → `[{ tag, count }]`, sorted by count.
  Multi-select, with an **any / all** toggle. This is the primary navigation.
- **Entry row:** title, authors, year, tag chips, link count, summary preview
- **Create/edit:** title, authors, year, **multiple links** (add/remove rows),
  **tag input with autocomplete** from existing tags, summary
- Tags are **lowercased and de-duplicated server-side** — reflect that in the input
- **Filters:** tags, year, search across title/authors/summary
- **Sorts:** newest | oldest | title | year (entries with no year sort last)
- **Quota meter** — capped at 5 on free

**States:** all seven, and specifically **the 300-entry state at compact density.**

## 5.13 Career Goals — `/career-goals`

**Purpose:** multi-year progress, visible.

- **Summary:** total · active · achieved · average progress
- **Goal card:** title, type, **stage indicator (e.g. "Stage 3 of 5" + 60%)**,
  target date, current stage description
- **Progress is staged, not percentage-entered.** `progressPercent` is derived
  from `currentStage / totalStages` — design the indicator around discrete
  stages, not a continuous bar.
- **Detail view:** goal + **stage history timeline** (append-only log)
- **Advance stage:** a prompt for "what was accomplished" → written to history
- **Set stage:** jump forwards or backwards. Moving backwards **reopens** an
  achieved goal — design that transition.
- **History:** add (with backdating), edit, delete entries
- **Achieved state:** a distinct, quiet celebration. Restrained.
- **Filters:** type, status (all | active | achieved), search
- **Quota meter** — capped at 5 on free

---

## 5.14 Projects — `/projects`

**List screen:**

- **Tabs:** All · Owned · Shared with me
- **Card:** name, description, **progress bar**, member avatars (stacked),
  owner, updated-at, archived flag
- **`invitePending` state** — "You've been invited" with an Accept action
- **Quota meter**: "3 of 5 projects used" — and **disable Create when full**,
  rather than letting the user discover the limit by failing
- Filters: archived, search. Sorts: recent | name | progress | newest

**Detail screen — `/projects/:id`:**

- Header: name, progress (editable 0–100), owner, member avatars, actions
- Sections: Overview · Members · Brief
- **Three role variants** — see §3.3B

**Members panel:**

- Row: avatar, name, email, **role selector**, invited date, accepted state
- **Pending invite state** (`user` is null): "Invited — not yet registered".
  This is a real and common state; design it properly.
- Add member: email + role (EDITOR | VIEWER only — **OWNER is not assignable**)
- Remove member (owner), leave project (self)
- **Transfer ownership** — destructive-feeling confirm; the current owner is
  demoted to EDITOR

**Project Brief — `/projects/:id/brief`:**

- **25 fields.** Do **not** design one long form.
- Group into 5 sections (§3.1) as an accordion, stepper, or tabbed form
- **Section-by-section save** — the API writes only the fields sent
- Show completion per section ("4 of 6 filled")
- Sign-off section includes a date and a signature field

---

## 5.15 Calendar — `/calendar`

**The largest and most complex screen. Budget the most time here.**

### Views

Month · Week · Day. Plus an agenda/list view for mobile.

### Event chip — two designs required

1. **Full**: title, time, location or online indicator, category accent,
   recurrence marker, attendee count
2. **Redacted** (`redacted: true`): time only, labelled "Busy", visually
   distinct — muted, patterned, or outlined. **Must look intentional, not
   broken.** Include a tooltip: "Details are private."

### Event create/edit modal

Every field from §3.1:

- Title, description, location
- **Start / end date + time + timezone**
- All-day toggle
- Category (free text with suggestions from `GET /calendar/events/categories`)
- Priority (4)
- **Show as** (Free | Busy | Tentative | Out of office)
- **Visibility** (Private | Busy | Public) — **defaults to Private.** Explain
  what each means in one line; this controls who sees what.
- Online toggle + meeting link
- Attendees (email chips — **these people may have no Skrivbok account**)
- Reminder (minutes before)
- **Recurrence**: None | Daily | Weekly | Biweekly | Monthly | Yearly + end date

**Important:** editing a recurring event edits **the whole series**. Editing a
single occurrence is **not supported**. Make that unmistakable in the UI —
"Changes apply to all occurrences."

### Meeting requests

- **Inbox / Outbox tabs**, status filter, upcoming filter
- Request card: title, counterpart, date/time/timezone, status, description
- **Conflict warning** — the detail response includes `conflicts[]`, _the
  viewer's own_ clashing events. Display as "This clashes with: Lab meeting,
  09:00–10:00." Informative, not blocking.
- Actions by role and state:
  - Receiver, PENDING → **Accept**, **Decline**
  - Sender, PENDING → **Reschedule**, **Cancel**
  - Either, ACCEPTED → **Cancel** (removes the event from _both_ calendars)
- Send request: recipient email, title, description, start/end, timezone
- Errors: no account with that email (404), yourself (400), in the past (400),
  already responded (409)

### Calendar sharing

- **Two lists**, clearly distinguished:
  - _Who can see my calendar_ — person, level, granted date, change level, revoke
  - _Whose calendars I can see_ — person, level, remove my access
- **Incoming requests**: approve (**and the owner chooses FREE_BUSY or VIEW —
  the requester does not ask for a level**), reject
- **Outgoing requests**: pending, withdraw
- Request access: email + optional message
- **Level explanation is essential**: "Free/busy — they see when you're busy, not
  what you're doing" vs "Full view — they see event details you've marked public"

### Availability finder

`GET /calendar/availability?from&to&email=a&email=b` (max 25 people) →
per person: `{ email, name, timezone, busy: [{startAt, endAt}] | null, hasAccess }`

- A multi-person timeline grid of busy blocks
- **`hasAccess: false`** — show "No access" for that row, not an empty row.
  Distinguish "free" from "unknown".
- **Only merged busy intervals are returned** — no titles, no counts, ever

### Combined view

Own events (full detail) + every calendar you have access to (projected).
Colour-code by person. Toggle calendars on/off.

---

## 5.16 Profile — `/profile`

- **22 fields + 5 repeating sections.** Section-based layout with per-section save.
- **Repeating rows** (degrees, employment, courses, grants, awards) need clean
  add/remove/reorder affordances. This is the fiddliest interaction in the app —
  design it carefully.
- Fields: see §3.1
- Timezone picker (affects reminders and calendar defaults)

## 5.17 Resume — `/profile/resume`

- **Preview** of the generated CV, print-styled
- **Sharing toggle**: on → a public link is created; copy button
- **Explicit warning**: "Turning this off immediately breaks the existing link."
  Re-enabling restores the _same_ link.
- Design the **public resume page** itself: clean, printable, no app chrome, no
  navigation. It is someone's CV — it should look like one.

---

## 5.18 Upgrade / Billing — `/upgrade`

- **Plan cards**: Monthly ₹499 · Yearly ₹4999 (prices come from the server; do
  not hard-code them in the design as immutable)
- **Three usage meters**: projects, career goals, literature — "3 of 5 used"
- **Subscription states, all distinct:**
  - Free
  - PRO active (+ renewal date)
  - **PRO expired** — must not look identical to Free; it needs a "renew" path
- Razorpay checkout handoff (an external modal takes over)
- Payment history table: date, plan, amount, status (CREATED | AUTHORIZED |
  CAPTURED | FAILED | REFUNDED)
- **Limit-reached modal** — reachable from anywhere a cap is hit. Per §1.4: a
  natural next step, not a penalty. Name the specific limit reached.

## 5.19 Notifications — `/notifications` + panel

Full page and dropdown panel. Nine types (§3.1), each with an icon and colour.
Read/unread, filter by type, unread-only toggle, mark read, mark all read,
clear read, delete one. Click follows `link`.

## 5.20 Help & Feedback — `/help`

- Report form: type (Bug | Feature | Feedback), page (pre-filled from where they
  came from), title, description (**min 10 characters** — reflect that in
  validation copy)
- "My reports" list with status: Open | In progress | Resolved | Dismissed
- Resolution note shown when resolved

---

## 5.21 Admin — `/admin`

Separate visual treatment is acceptable — denser, more utilitarian.

- **Dashboard**: total users, PRO, free, admins, new this week, active this week;
  content counts across 11 types; revenue (captured, failed, refunded);
  engagement (with projects, with profile, never logged in)
- **Analytics**: daily signups, daily active users, daily revenue (line charts,
  7–365 day window), **feature adoption** (bar chart, users per feature)
- **Users table**: search, filter by role/plan, sort. Row → detail with content
  counts, sessions, payments. Actions: edit name/role/plan/subscription end,
  **revoke all sessions**, delete
- **Delete requires typing "DELETE"** — design that confirmation
- **Admins cannot** change a user's email or password — do not design those fields
- **Subscriptions**: PRO users sorted soonest-to-lapse, with days remaining
- **Payments**: all payments, filter by status
- **Report triage**: tabs with counts (Open / In progress / Resolved /
  Dismissed), detail view, resolve with a note

---

# PART 6 — RESPONSIVE

| Breakpoint | Treatment                                                           |
| ---------- | ------------------------------------------------------------------- |
| ≥1440      | Primary target. Sidebar + full content. Two-pane where specified.   |
| 1024–1439  | Sidebar collapsible. Two-pane may become single with a drawer.      |
| 768–1023   | Sidebar → drawer. Single column. Tables → cards.                    |
| <768       | Bottom nav or hamburger. Calendar → agenda list. Forms full-screen. |

**Mobile priorities** (in order): check deadlines · view calendar · accept a
meeting · capture an idea · read notifications. Deprioritise: the 25-field brief,
the profile editor, admin, availability finder.

---

# PART 7 — WHAT TO DELIVER

**Phase 1 — foundations (blocking everything else)**

1. Colour system, light + dark, with contrast validation
2. Typography scale
3. Spacing, radius, elevation, motion tokens
4. Icon set choice
5. Core primitives (§4.2)

**Phase 2 — proving the system** 6. App shell: sidebar, top bar, notification panel 7. Auth screens 8. Dashboard 9. **Ideas — the full pattern**, all seven states. Once approved this becomes the
template for Notes, Journal, Future Work, Literature.

**Phase 3 — the rest** 10. Remaining content screens 11. Projects (three role variants) + Brief 12. Career Goals 13. **Calendar** — allocate the most time 14. Profile, Resume, Billing 15. Admin

---

# PART 8 — QUESTIONS TO ANSWER BACK

1. **Type system** — which family/pair, and why?
2. **Density** — two modes, or one? If one, which?
3. **Disabled vs hidden** for controls a role cannot use?
4. **Dark mode** — designed alongside, or as a second pass?
5. **Mobile** — full responsive now, or desktop-first with a later pass?
6. Anything in §5 that seems wrong for how researchers actually work — you may
   know better than this brief does.

---

# PART 9 — THINGS THAT WILL GO WRONG IF IGNORED

A short list of the failure modes this brief exists to prevent.

1. **Designing only the happy path.** Seven states, every screen (§4.1).
2. **Designing for 5 items.** Literature has 300. Journal has 700. Test at scale.
3. **Forgetting the redacted calendar chip.** Two chip designs, not one (§3.3C).
4. **One project screen instead of three.** Roles change what is visible (§3.3B).
5. **Colour-only priority and status.** Fails accessibility and fails in dark mode.
6. **A 25-field brief as one scrolling form.** Section it (§5.14).
7. **Treating "PRO expired" as "Free".** They are different states with different
   actions (§5.18).
8. **Making the free limit feel punitive.** It is hit during normal use (§1.4).
9. **Hiding timezone.** These users need it visible (§1.2).
10. **A streak-guilt journal heatmap.** It is a record, not a chore (§5.9).
