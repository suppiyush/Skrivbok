# Skrivbok — UI Requirements (First Design Pass)

**For:** UI/design team · **Status:** backend 10/13 complete, frontend not started
**Stack for the rebuild:** React 19 + Vite + TypeScript + **Tailwind v4 + shadcn/ui**

> The backend is done and tested for everything below. Every screen listed here has
> working endpoints behind it. Design against these states — they are what the API
> actually returns.

---

# Part A — Context

## What Skrivbok is

A **workspace for academic and research work**. One place where a researcher keeps
everything that is currently scattered across a notes app, a spreadsheet of
deadlines, a reference manager, a shared calendar and a folder of drafts.

"Skrivbok" is Swedish for _writing book_ / notebook.

## Who uses it

PhD students, postdocs, professors, research staff.

What that means for design:

- **They are not casual users.** They live in this tool for hours, most days, for years.
- **Density beats decoration.** They would rather see 20 items than 6 large cards.
- **Their data accumulates.** A third-year PhD student has hundreds of literature
  entries and years of journal entries. Design for the full drawer, not the empty one.
- **They work across timezones** — conferences, collaborators, visiting positions.
  Timezone is visible in the UI on purpose, not hidden.
- **Mostly desktop, large screens.** Mobile matters for checking a deadline or
  accepting a meeting, not for writing.
- **Low tolerance for friction.** If capturing an idea takes four clicks, they will
  use a text file instead and the feature is dead.

## The mental model

Four groups. This is roughly how the navigation should read:

| Group        | Screens                             | Purpose                                                       |
| ------------ | ----------------------------------- | ------------------------------------------------------------- |
| **Capture**  | Ideas · Notes · Journal             | Fast, low-friction, no required fields. Get the thought down. |
| **Organise** | Projects · Literature · Future Work | Structured. Tagged, linked, searchable later.                 |
| **Commit**   | Deadlines · Calendar · Meetings     | Time-bound. Things with consequences.                         |
| **Grow**     | Career Goals · Profile · Resume     | Long-horizon. Progress measured in years.                     |

Two cross-cutting layers sit on top: **Collaboration** (project members, shared
calendars, meeting requests) and **Account** (notifications, billing, help).

## Free vs PRO

Free accounts are capped at **5 projects, 5 career goals, 5 literature entries**.
Everything else is unlimited. PRO is ₹499/month or ₹4999/year.

Design consequence: the cap is hit during _normal use_, not at the edges. The
limit-reached moment needs to feel like a natural next step, **not a punishment**
— the user has just tried to do something reasonable.

## Why we are rebuilding

The existing app works but is not production-ready. Relevant to design:

| Legacy                                                                                          | Rebuild                               |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Zero shared components** — all 24 pages redeclared their own CSS in an inline `<style>` block | Real design system, shared components |
| Desktop-only, no responsive pass                                                                | Responsive                            |
| No dark mode                                                                                    | Light + dark from the start           |
| No loading/empty/error states — screens just appeared or didn't                                 | All 7 states designed (§1)            |
| Journal saved to browser storage only — cleared the cache, lost everything                      | Real backend                          |
| Whole pages were 900–1,100 lines each                                                           | Composed from components              |

**The visual design is not the problem** — the code underneath it was. If the team
likes the existing look, we can keep the direction. That is an open question below.

## Current state of the project

- **Backend: 10 of 13 parts complete.** Auth, all content features, projects,
  calendar, profile, billing, notifications — built and tested against a live database.
- **Remaining backend:** admin panel, email/reminder worker, tests + deployment.
- **Frontend: not started.** This document is the brief.

Design does not need to wait for the remaining backend parts.

## Vocabulary

Terms that appear in the screens and mean something specific here:

| Term               | Meaning                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **Brief**          | A 25-field creative/project brief attached to a project. Objectives, audience, timeline, sign-off. |
| **Stage**          | Career goals are divided into stages (e.g. 3 of 5). Progress = stages completed.                   |
| **Free/busy**      | Seeing _when_ someone is occupied without seeing _what_ they are doing.                            |
| **Visibility**     | Per-event setting: Private / Busy / Public. Controls what collaborators see.                       |
| **Grant**          | Permission to view someone's calendar. Two levels: Free-busy or Full view.                         |
| **Redacted**       | An event shown as an opaque "Busy" block because the viewer lacks permission for the detail.       |
| **Occurrence**     | One instance of a repeating event. Stored once, expanded for display.                              |
| **Pending invite** | Someone invited to a project by email who has not registered yet.                                  |
| **Quota**          | Free-tier usage against the cap, e.g. "3 of 5 projects used".                                      |

---

# Part B — What to design

## 1. Before screens: the design system

Agree these first, or every screen gets redesigned twice.

| Item                   | Notes                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colour tokens          | Light **and dark**. 8 feature accent colours already exist (see §4).                                                                                                           |
| Typography             | Legacy used Fraunces (serif) + DM Sans. Keep or replace — decide now.                                                                                                          |
| Spacing / radius scale | Tailwind defaults or custom                                                                                                                                                    |
| Core components        | Button, Input, Select, Textarea, Modal, Drawer, Toast, Tabs, Badge, Avatar, Dropdown, Tooltip, Card, Table, Pagination, DatePicker, TimePicker, TagInput, EmptyState, Skeleton |
| Icons                  | Legacy used FontAwesome. Recommend switching to Lucide (ships with shadcn).                                                                                                    |
| Logo / brand mark      | Currently a placeholder 4-square SVG                                                                                                                                           |

### States every list & form screen needs

**This is the part most often skipped and it costs the most later.**

1. **Loading** — skeleton, not a spinner
2. **Empty** — first-time user, with a call to action
3. **Empty after filtering** — different message from #2
4. **Error** — retry affordance
5. **Partial permission** — 403 (read-only view)
6. **Limit reached** — free-tier cap hit → upgrade prompt
7. **Pagination** — every list is paginated (25/page default)

---

## 2. App shell

| Element                | Requirements                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Sidebar**            | Logo, user card (name, email, PRO badge), nav, Help & Feedback, Upgrade CTA, Sign out. Needs collapsed + mobile drawer variants. |
| **Top bar**            | Page title, search (where relevant), **notification bell with unread count**, user menu                                          |
| **Notification panel** | Dropdown from the bell. Mark-read, mark-all-read, clear-read. 9 notification types (§9).                                         |
| **Mobile**             | Full responsive pass — legacy app was desktop-only                                                                               |

---

## 3. Public / auth screens

| #   | Screen                 | Requirements                                                                                                                                                                                                        |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Landing page**       | Marketing. Feature grid, platform stats, sign-up CTA                                                                                                                                                                |
| 2   | **Sign in / Sign up**  | **One "Continue with Google" button — no email or password fields.** `/login` and `/register` are the same screen, differing only in heading. States: loading, Google unconfigured, server unreachable, OAuth error |
| 3   | **Legal pages** ×5     | Terms, EULA, Refund Policy, Privacy Policy, Contact                                                                                                                                                                 |
| 4   | **Public resume page** | Server-rendered HTML today — design team should restyle. Print stylesheet required.                                                                                                                                 |

There is no register, set-password or change-password screen: Google is the only
sign-in method, and Skrivbok stores no password of its own.

---

## 4. Dashboard

Tile grid, one per feature. Each tile shows count + 2–3 recent items.

| Tile           | Accent  |
| -------------- | ------- |
| Projects       | indigo  |
| Ideas          | amber   |
| Notes          | emerald |
| Deadlines      | red     |
| Future Work    | blue    |
| Literature     | teal    |
| Career & Goals | violet  |
| Journal        | pink    |

Plus: greeting with first name, inline name edit, notification bell, quick-report button.

---

## 5. Content screens (same pattern ×6)

**Ideas · Notes · Journal · Deadlines · Future Work · Literature**

Shared shape: list/grid + create modal + edit modal + delete confirm + filters + search + pagination.

| Screen          | Specific needs                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ideas**       | Sticky-note cards. **7 colours**, category filter, search                                                                                                               |
| **Notes**       | Same + **pinned** notes sort first (needs a visual pin state)                                                                                                           |
| **Journal**     | Date-based entries, mood field, **activity heatmap** (GitHub-style contribution grid), date-range filter                                                                |
| **Deadlines**   | Priority (4 levels), status (4), due date **+ time + timezone**, overdue styling, reminder toggle, **summary bar** (total / open / overdue / due-this-week / completed) |
| **Future Work** | Priority, free-text timeline field                                                                                                                                      |
| **Literature**  | Multi-link, **tag chips w/ counts sidebar**, tag filter (any/all), year, authors, summary                                                                               |

---

## 6. Projects

| Screen             | Requirements                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Projects list**  | Cards w/ progress bar, member avatars, owner. Tabs: **All / Owned / Shared with me**. Archived filter. **Quota indicator "3 of 5 used"**                       |
| **Project detail** | Header (name, progress, members), member list with roles                                                                                                       |
| **Members panel**  | Add by email, role selector, **pending-invite state** (invited but not registered), accept-invite banner, remove, **transfer ownership** (destructive confirm) |
| **Project brief**  | **25-field form** — needs sectioning into steps/accordion. Sections: project info · client contact · your contact · brief content · sign-off                   |

### Role-based UI — three variants of the same screen

| Role       | Sees                                         |
| ---------- | -------------------------------------------- |
| **OWNER**  | Everything: edit, members, delete, transfer  |
| **EDITOR** | Edit project + brief. **No** member controls |
| **VIEWER** | Read-only. All edit affordances hidden       |

---

## 7. Career Goals

- Goal cards with **staged progress** (e.g. stage 3 of 5, 60%)
- "Advance stage" action w/ description prompt
- **Stage history timeline** — add / edit / delete / backdate entries
- Summary: total / active / achieved / average progress
- Quota indicator (5 on free tier)

---

## 8. Calendar — largest screen, needs the most design time

| Piece                    | Requirements                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Grid**                 | Month / week / day views. Legacy was Outlook-style.                                                                                                                                                    |
| **Event modal**          | Title, description, location, start/end, **timezone**, all-day, category, priority, show-as (4), **visibility (3)**, online + meeting link, attendees, reminder, **recurrence (6 options + end date)** |
| **Recurring events**     | Occurrences must be visually distinguishable from one-offs                                                                                                                                             |
| **Meeting requests**     | Inbox / outbox. Accept / decline / cancel / reschedule. **Conflict warning** — "this clashes with X on your calendar"                                                                                  |
| **Calendar sharing**     | Request access, approve (**owner picks FREE_BUSY or VIEW**), reject, revoke. Two lists: _who can see me_ / _whose calendars I can see_                                                                 |
| **Shared calendar view** | **Redacted events render as plain "Busy" blocks with no title.** This is a required visual state — see below                                                                                           |
| **Availability finder**  | Multi-person free/busy grid for scheduling                                                                                                                                                             |
| **Combined view**        | Own + all shared calendars, colour-coded by person                                                                                                                                                     |

### Critical: the redaction states

The API returns `redacted: true` for events the viewer may not see in full.

| Event visibility | FREE_BUSY grant         | VIEW grant              |
| ---------------- | ----------------------- | ----------------------- |
| PRIVATE          | **not returned at all** | **not returned at all** |
| BUSY             | opaque "Busy" block     | opaque "Busy" block     |
| PUBLIC           | opaque "Busy" block     | full detail             |

Design needs **two** event chip variants: full and opaque.

---

## 9. Notifications

9 types, each wants an icon + colour:
`DEADLINE_DUE` · `MEETING_REQUEST` · `MEETING_ACCEPTED` · `MEETING_REJECTED` ·
`CALENDAR_ACCESS_REQUEST` · `CALENDAR_ACCESS_GRANTED` · `PROJECT_INVITE` ·
`SUBSCRIPTION` · `SYSTEM`

Read / unread states, deep-link on click, empty state.

---

## 10. Profile & Resume

| Screen             | Requirements                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile editor** | 22 fields + **5 repeatable sections** (degrees, employment, courses, grants, awards). Needs add/remove row UI. Section-by-section save. |
| **Resume preview** | Rendered CV, print-friendly                                                                                                             |
| **Resume sharing** | Toggle public on/off, copy-link, clear warning that disabling kills the existing link                                                   |

---

## 11. Billing / Upgrade

- Plan cards: **₹499/month · ₹4999/year** (prices come from the server)
- **Usage meters** for the 3 capped resources: projects, career goals, literature (5 each on free)
- Razorpay checkout handoff
- Subscription status: active / **expired** (distinct states) / none
- Payment history table
- **Limit-reached modal** — appears anywhere a cap is hit, links here

---

## 12. Help & Feedback

Report form: type (Bug / Feature / Feedback), page, title, description. Plus "my reports" list with status (Open / In progress / Resolved / Dismissed).

---

## 13. Admin — _backend in progress (Part 11)_

Design can start; endpoints land next.

- Dashboard: users, PRO count, revenue, signups over time
- User table: search, edit, change plan, delete
- Subscriptions list
- Report triage: filter by status, resolve/dismiss with a note
- **Analytics** — the legacy app had a 393-line analytics page that was never wired up; we are reviving it

---

## What we need back from the UI team

1. Design-system decisions (§1) — **blocking everything else**
2. Priority order for screens. Suggested: **Auth → App shell → Dashboard → one content screen (Ideas) as the pattern → Projects → Calendar**
3. Confirmation that all 7 states in §1 will be designed, not just the happy path
4. Mobile: full responsive, or desktop-first with a mobile pass later?

## Notes / open questions

- Legacy design (fonts, colours, layout) — **keep, refresh, or start clean?**
- The legacy app had **zero shared components** — every page redeclared its own CSS. Not repeating that.
- Editing a single occurrence of a recurring event is **not** supported by the backend yet. Confirm whether the UI needs it.
