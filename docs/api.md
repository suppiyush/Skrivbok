# Skrivbok API

Base URL: `/api/v1` · **135 endpoints** across 16 route groups.

---

## Conventions

### Authentication

A session cookie, set by the Google OAuth callback and sent automatically by the
browser. **Google is the only sign-in method** — there is no password endpoint
anywhere in the API, and the server stores no credential of its own.

```
skrivbok_sid=<opaque token>; HttpOnly; SameSite=Lax; Secure (production); Max-Age=2592000
```

Non-browser clients may send `Authorization: Bearer <token>` instead.

**The caller's identity always comes from the session.** No endpoint accepts an
email or user id to identify _who is asking_ — only to name someone else
(inviting a collaborator, requesting calendar access).

### Errors

Every failure has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The submitted data is invalid",
    "details": [{ "path": "body.title", "message": "Too small: expected >=1 characters" }],
    "requestId": "a01859e8-60fd-4361-91ab-d262de3e349f"
  }
}
```

**Branch on `code`, never on `message`.** Messages change; codes do not.

| Status | Typical codes                                       |
| ------ | --------------------------------------------------- |
| 400    | `BAD_REQUEST`                                       |
| 401    | `UNAUTHENTICATED`, `SESSION_EXPIRED`                |
| 403    | `FORBIDDEN`, `ADMIN_REQUIRED`, `FREE_LIMIT_REACHED` |
| 404    | `NOT_FOUND`                                         |
| 409    | `CONFLICT`, `ALREADY_EXISTS`                        |
| 422    | `VALIDATION_FAILED`                                 |
| 429    | `RATE_LIMITED`                                      |
| 503    | `SERVICE_UNAVAILABLE`, `FEATURE_DISABLED`           |

**404 vs 403 for other people's data:** a record you have no access to answers
**404**, not 403 — a 403 would confirm it exists. 403 is used only when you
_already know_ the resource exists, e.g. a project you are a viewer on.

### Lists

Every list endpoint takes `?page=1&limit=25` (limit max 100) and returns:

```json
{
  "data": [ … ],
  "pagination": { "page": 1, "limit": 25, "total": 9, "totalPages": 3,
                  "hasNext": true, "hasPrevious": false }
}
```

### Updates

`PATCH` writes only the fields you send. **An empty body is a 422**, not a
no-op — this prevents a client bug from silently resetting fields to defaults.

### Rate limits

`RateLimit` / `RateLimit-Policy` headers on every response.

| Bucket                      | Limit                                         |
| --------------------------- | --------------------------------------------- |
| General                     | 300 / 15 min per IP                           |
| Auth (`/auth/google`)       | 10 **failures** / 15 min — successes are free |
| Expensive (orders, reports) | 20 / hour                                     |

---

## Health

| Method | Path            | Notes                                        |
| ------ | --------------- | -------------------------------------------- |
| GET    | `/health`       | Liveness. Does **not** touch the database.   |
| GET    | `/health/ready` | Readiness. 503 when Postgres is unreachable. |

---

## Auth — `/api/v1/auth`

| Method | Path               | Notes                                                                     |
| ------ | ------------------ | ------------------------------------------------------------------------- |
| GET    | `/config`          | `{ googleEnabled }` — false means nobody can sign in; the page says so    |
| GET    | `/google`          | → consent screen                                                          |
| GET    | `/google/callback` | → session + redirect. Signs up on first use. **No identity in the URL**   |
| POST   | `/logout`          | 204. Revokes server-side, not just the cookie                             |
| POST   | `/logout-all`      | Sign out everywhere → `{ revokedSessions }`. Ends the caller's session too |
| GET    | `/me`              | Current user + `providers`                                                |
| PATCH  | `/me`              | `name`, `timezone`                                                        |

There is no `/register`, `/login` or `/password`. **Sign-up is not a separate
call:** the Google callback creates the account the first time it sees an
identity. An account whose email matches an existing user is linked to it,
provided Google reports that address as verified.

---

## Content — the six single-owner modules

`/ideas` · `/notes` · `/journal` · `/deadlines` · `/future-work` · `/literature`

All share: `GET /` `POST /` `GET /:id` `PATCH /:id` `DELETE /:id`

| Module      | Extra                             | Filters                                                 |
| ----------- | --------------------------------- | ------------------------------------------------------- |
| ideas       | `GET /categories`                 | `category`, `color`, `search`, `sort`                   |
| notes       | `GET /categories`                 | + `pinned` (pinned always sorts first)                  |
| journal     | `GET /activity?from&to` — heatmap | `from`, `to`, `mood`, `search`                          |
| deadlines   | `GET /summary`                    | `status`, `priority`, `from`, `to`, `overdue`, `search` |
| future-work | —                                 | `priority`, `search`                                    |
| literature  | `GET /tags` — with counts         | `tag` (repeatable), `tagMatch=any\|all`, `year`         |

Notes: deadlines store an **instant + IANA timezone**, not a date string.
Setting `status: COMPLETED` makes the server set `completedAt`; reopening clears
it. Literature tags are lowercased and de-duplicated on write.

---

## Projects — `/api/v1/projects`

| Method | Path                      | Required role                    |
| ------ | ------------------------- | -------------------------------- |
| GET    | `/`                       | — (`scope=all\|owned\|shared`)   |
| GET    | `/quota`                  | —                                |
| POST   | `/`                       | — (counts against the free tier) |
| GET    | `/:id`                    | VIEWER                           |
| PATCH  | `/:id`                    | EDITOR                           |
| DELETE | `/:id`                    | OWNER                            |
| GET    | `/:id/members`            | VIEWER                           |
| POST   | `/:id/members`            | OWNER                            |
| POST   | `/:id/members/accept`     | the invitee                      |
| PATCH  | `/:id/members/:memberId`  | OWNER                            |
| DELETE | `/:id/members/:memberId`  | OWNER, **or yourself**           |
| POST   | `/:id/transfer-ownership` | OWNER                            |
| GET    | `/:id/brief`              | VIEWER                           |
| PUT    | `/:id/brief`              | EDITOR                           |

Roles rank `OWNER > EDITOR > VIEWER`. Inviting someone with no account creates a
**pending member row** that is linked the first time they sign in with Google.

---

## Career goals — `/api/v1/career-goals`

Standard CRUD, plus:

| Method       | Path                      | Notes             |
| ------------ | ------------------------- | ----------------- |
| GET          | `/quota` · `/summary`     |                   |
| POST         | `/:id/advance`            | One stage forward |
| PUT          | `/:id/stage`              | Jump to a stage   |
| GET/POST     | `/:id/history`            |                   |
| PATCH/DELETE | `/:id/history/:historyId` |                   |

`currentStage` **cannot** be changed via `PATCH` — stage moves go through
`/advance` or `/stage`, which write the history entry in the same transaction.
`progressPercent` is derived on read, never stored.

---

## Calendar — `/api/v1/calendar`

### Events

| Method           | Path                    | Notes                                                     |
| ---------------- | ----------------------- | --------------------------------------------------------- |
| GET              | `/events/range?from&to` | **Expanded occurrences** for the grid. Max 400-day window |
| GET              | `/events/categories`    |                                                           |
| GET/POST         | `/events`               | Flat list of stored series                                |
| GET/PATCH/DELETE | `/events/:id`           | Edits the **whole series**                                |

A repeating event is stored once and expanded on read. Recurrence steps the
**wall clock in the event's timezone**, so a weekly 10:00 meeting stays at 10:00
across a DST change. Monthly/yearly series **skip** months without the intended
day rather than sliding (Jan 31 → Mar 31, not Feb 28).

### Meeting requests

| Method   | Path                            | Who                                        |
| -------- | ------------------------------- | ------------------------------------------ |
| GET/POST | `/meeting-requests`             | `box=incoming\|outgoing\|all`              |
| GET      | `/meeting-requests/:id`         | either party — includes **your** conflicts |
| PATCH    | `/meeting-requests/:id`         | sender, while PENDING                      |
| POST     | `/meeting-requests/:id/accept`  | receiver                                   |
| POST     | `/meeting-requests/:id/decline` | receiver                                   |
| POST     | `/meeting-requests/:id/cancel`  | either party                               |

Accepting creates **two linked calendar events**, one per person. Cancelling
removes both, regardless of any edits made to either copy.

### Access control

| Method       | Path                            | Who                                    |
| ------------ | ------------------------------- | -------------------------------------- |
| GET/POST     | `/access/requests`              |                                        |
| POST         | `/access/requests/:id/approve`  | target — **chooses the level**         |
| POST         | `/access/requests/:id/reject`   | target                                 |
| DELETE       | `/access/requests/:id`          | requester (withdraw)                   |
| GET          | `/access/granted`               | who can see me                         |
| GET          | `/access/held`                  | whose calendars I can see              |
| PATCH/DELETE | `/access/:id`                   | owner (or viewer, to remove their own) |
| GET          | `/shared/:email?from&to`        | requires a grant                       |
| GET          | `/availability?from&to&email=…` | merged busy blocks, up to 25 people    |
| GET          | `/combined?from&to`             | own + all shared                       |

**What a grant reveals:**

| event `visibility` | FREE_BUSY        | VIEW             |
| ------------------ | ---------------- | ---------------- |
| `PRIVATE`          | not returned     | **not returned** |
| `BUSY`             | `redacted: true` | `redacted: true` |
| `PUBLIC`           | `redacted: true` | full detail      |

A redacted event has **no** title, description, location, attendees or link.
`PRIVATE` is the default for new events, and is hidden even at VIEW level.

---

## Profile — `/api/v1/profile`

| Method         | Path                          | Notes                                          |
| -------------- | ----------------------------- | ---------------------------------------------- |
| GET/PUT/DELETE | `/`                           | `PUT` writes only the keys sent                |
| GET            | `/resume`                     | HTML, own                                      |
| PUT            | `/resume/sharing`             | `{ isPublic }` → mints a slug                  |
| GET            | `/api/v1/public/resume/:slug` | **No session.** Works only while sharing is on |

Disabling sharing kills an already-circulated link immediately.

---

## Billing — `/api/v1/billing`

| Method | Path                        | Notes                                                      |
| ------ | --------------------------- | ---------------------------------------------------------- |
| GET    | `/plans`                    | Server-side pricing                                        |
| GET    | `/subscription`             | `isPro`, `isExpired`, `subscriptionEndsAt`                 |
| GET    | `/usage`                    | Quota for all three capped resources                       |
| GET    | `/payments`                 | History                                                    |
| POST   | `/orders`                   | `{ plan: "MONTHLY" \| "YEARLY" }` — **no amount accepted** |
| POST   | `/verify`                   | Checkout callback. Signature + **order-owner check**       |
| POST   | `/api/v1/webhooks/razorpay` | Unauthenticated; the signature _is_ the auth               |

Free tier: **5 projects, 5 career goals, 5 literature entries**. Exceeding one
returns 403 `FREE_LIMIT_REACHED`. A `PRO` plan with a past `subscriptionEndsAt`
falls back to free limits, so a missed webhook cannot grant PRO indefinitely.

Webhooks are idempotent on `(provider, eventId)`, and capture is idempotent on
payment status — a redelivery cannot add a second month.

---

## Notifications & reports

| Method   | Path                                                        |
| -------- | ----------------------------------------------------------- |
| GET      | `/notifications` (`unreadOnly`, `type`)                     |
| GET      | `/notifications/unread-count`                               |
| POST     | `/notifications/read` `{ ids }` · `/notifications/read-all` |
| DELETE   | `/notifications/:id` · `/notifications/read`                |
| GET/POST | `/reports`                                                  |

**There is no create endpoint for notifications** — they are written only by the
features that cause them.

---

## Admin — `/api/v1/admin`

Every route requires `requireAuth` **and** `requireAdmin`.

| Method | Path                                                        |
| ------ | ----------------------------------------------------------- |
| GET    | `/stats` · `/analytics?days=30`                             |
| GET    | `/users` (`search`, `role`, `plan`, `sort`) · `/users/:id`  |
| PATCH  | `/users/:id` — `name`, `role`, `plan`, `subscriptionEndsAt` |
| DELETE | `/users/:id` — body must be `{ "confirm": "DELETE" }`       |
| POST   | `/users/:id/revoke-sessions`                                |
| GET    | `/subscriptions` · `/payments`                              |
| GET    | `/reports` (with tab counts) · `/reports/:id`               |
| PATCH  | `/reports/:id` — status + resolution                        |

An admin **cannot** change a user's email, delete themselves, or
demote the last remaining admin. Every mutation is logged with the acting
admin's id.

---

## Public — `/api/v1/public`

| Method | Path            | Notes                              |
| ------ | --------------- | ---------------------------------- |
| GET    | `/stats`        | Landing-page counters. Totals only |
| GET    | `/resume/:slug` | Shared resume, when enabled        |
