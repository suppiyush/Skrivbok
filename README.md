# Skrivbok

A space to write, organize and grow. Complete rebuild of the original Skrivbok
codebase on a typed, modular stack.

> **Status:** Complete — API, web app, reminder worker and a production Docker
> stack. Payments switch on once Razorpay keys are configured.

## Stack

| Layer      | Choice                                                          |
| ---------- | --------------------------------------------------------------- |
| Runtime    | Node 24 (LTS 22+), ESM, TypeScript 5.9 strict                   |
| API        | Express 5                                                       |
| Database   | PostgreSQL 17 + Prisma ORM (versioned migrations)               |
| Validation | Zod 4 — one schema per request                                  |
| Auth       | Opaque session tokens in `httpOnly` cookies, hashed in Postgres |
| Logging    | pino (JSON in prod, pretty in dev, secrets redacted)            |
| Web        | React 19 + Vite + Tailwind 4, React Router, TanStack Query      |
| Services   | Google sign-in, Brevo email, Cloudinary uploads, Razorpay       |
| Deployment | Docker Compose — Caddy (HTTPS), nginx, API, worker, Postgres    |
| Tooling    | npm workspaces, ESLint 9 flat config, Prettier, Vitest          |

## Layout

```
skrivbok/
├── apps/
│   ├── server/                 The API and the reminder worker
│   │   ├── src/
│   │   │   ├── config/         env.ts (Zod-validated), logger.ts
│   │   │   ├── db/             prisma.ts (client singleton), seed.ts
│   │   │   ├── middleware/     auth guards, validate, errors, rate limits
│   │   │   ├── routes/         the /api/v1 router index
│   │   │   ├── modules/        one folder per feature — see modules/README.md
│   │   │   ├── jobs/           reminder worker + cleanup
│   │   │   ├── emails/         templates + mail transport (Brevo API or SMTP)
│   │   │   ├── scripts/        admin helpers: list users, promote an admin
│   │   │   ├── types/          Express request augmentation
│   │   │   ├── utils/          errors, CSV export and shared helpers
│   │   │   ├── app.ts          Express assembly (no listen)
│   │   │   └── server.ts       Entry point + graceful shutdown
│   │   ├── prisma/             schema.prisma + migrations
│   │   ├── tests/              unit + integration (Vitest)
│   │   └── Dockerfile          API / worker image
│   └── web/                    The React app
│       ├── src/
│       │   ├── pages/          one file (or folder) per screen, incl. legal/
│       │   ├── components/     layout, marketing and UI building blocks
│       │   ├── lib/            API client, auth, queries, formatting
│       │   ├── router.tsx      routes
│       │   └── main.tsx        entry point
│       ├── public/assets/      static images
│       ├── nginx.conf          serves the build, forwards /api in Docker
│       └── Dockerfile          build + nginx image
├── docker/
│   └── Caddyfile               HTTPS and routing for production
├── docker-compose.yml          Development: Postgres, or the whole app
├── docker-compose.prod.yml     Production: Caddy, web, API, worker, Postgres
├── docs/                       API reference and design briefs
├── design/                     Design references (not used at runtime)
├── .env.example                Every variable, documented
└── tsconfig.base.json          Strict options — apps extend, never loosen
```

## Getting started

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Generate a session secret and paste it into SESSION_SECRET:
openssl rand -base64 48

# 3. Start Postgres
npm run db:up

# 4. Run the API and the web app, in two terminals
npm run dev            # API  → http://localhost:4000
npm run dev:web        # app  → http://localhost:5173
```

Open http://localhost:5173. Sign-in is Google only, so `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` must be set, and the Google client must list
`http://localhost:5173` as an origin and
`http://localhost:4000/api/v1/auth/google/callback` as a redirect URI.

To run everything in Docker instead: `npm run docker:up`, then the same address.

The API refuses to start on invalid configuration — it prints exactly which
variables are wrong and exits, rather than failing later inside a request.

### Scripts

| Command                 | What it does                                 |
| ----------------------- | -------------------------------------------- |
| `npm run dev`           | API with hot reload (tsx watch)              |
| `npm run dev:web`       | Web app with hot reload (Vite)               |
| `npm run build`         | Type-check and compile to `apps/server/dist` |
| `npm start`             | Run the compiled build                       |
| `npm run typecheck`     | Type-check every workspace, no emit          |
| `npm run lint`          | ESLint across the repo                       |
| `npm run format`        | Prettier write                               |
| `npm run db:up/down`    | Start / stop local Postgres                  |
| `npm test`              | Unit + integration tests                     |
| `npm run test:coverage` | Coverage report                              |
| `npm run worker`        | Reminder worker (separate process)           |
| `npm run docker:up`     | The whole app in Docker, for development     |
| `npm run prod:up`       | The production stack (see Deployment)        |

## Running the worker

The reminder worker is a **separate process** from the API:

```bash
npm run dev      # API
npm run worker   # reminders, in a second terminal
```

Only the worker ever schedules reminders — the API never does, however many
copies of it run. (The legacy server ran its cron inside every API process, so
two instances doubled every email.) Run exactly one worker.
`ENABLE_REMINDER_WORKER=false` stops it from starting at all.

## Testing

```bash
npm run db:test:setup   # create + migrate skrivbok_test (once)
npm test
```

Unit tests are pure and need nothing. Integration tests drive the real Express
app against a real `skrivbok_test` database — Prisma is **not** mocked, because
most of what is being tested is whether a `where` clause actually scopes a
query, and a mock would happily agree that it does. The test bootstrap refuses
to run if the connection string does not point at `skrivbok_test`.

## Deployment

Production is one server running `docker-compose.prod.yml`: Caddy in front
(HTTPS, with certificates obtained and renewed automatically), then the web
app, the API, the reminder worker and PostgreSQL. Only ports 80 and 443 are
exposed.

```bash
cp <your production env file> .env    # the name must be exactly .env
npm run prod:up                       # build, migrate, start
npm run prod:seed                     # once: give ADMIN_EMAIL the admin role
```

The domain's DNS must point at the server before the first start, or the
certificate cannot be issued. Migrations run automatically on every deploy,
before the API starts. `npm run prod:logs` follows the logs; the same commands
work without Node as `docker compose -f docker-compose.prod.yml …`.

## Documentation

| Document                                                                 | For                                                  |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| [`docs/api.md`](docs/api.md)                                             | Every endpoint, error codes, auth model, rate limits |
| [`docs/ui-requirements.md`](docs/ui-requirements.md)                     | Screen-by-screen brief for the design team           |
| [`apps/server/src/modules/README.md`](apps/server/src/modules/README.md) | Module layering contract                             |

## Conventions

- **Config**: nothing reads `process.env` except `src/config/env.ts`.
- **Logging**: `console.*` is an ESLint error. Use `createLogger('module')`.
- **Modules**: routes → controller → service → Prisma. Rules and rationale in
  [`apps/server/src/modules/README.md`](apps/server/src/modules/README.md).
- **Identity**: the caller is always `req.user`, never a value from the URL or
  body. This is the single most important rule in the rebuild.
- **Imports**: ESM with explicit `.js` extensions on relative paths
  (`import { env } from './config/env.js'`) — required by `NodeNext`.
- **Errors**: throw `AppError` subclasses; only `middleware/error.ts` writes an
  error response. Express 5 forwards async rejections on its own, so there is no
  `asyncHandler` wrapper.
- **Validation**: every route with input mounts `validate({ body, params, query })`.

### Error response shape

Every failure, from any route, returns:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The submitted data is invalid",
    "details": [{ "path": "body.title", "message": "Too small: expected >=3 characters" }],
    "requestId": "a01859e8-60fd-4361-91ab-d262de3e349f"
  }
}
```

`code` is stable and machine-readable — branch on it, never on `message`.

## Security baseline

Fixed relative to the legacy codebase, and non-negotiable going forward:

- No route trusts a client-supplied identity; every query is scoped to the session user.
- Admin routes sit behind a real role check, with no hardcoded credential fallback.
- Subscription state is written only by a signature-verified Razorpay webhook.
- Secrets live in `.env`, which is gitignored; `.env.example` carries no values.
- Session cookies are `httpOnly` + `SameSite=Lax`, `Secure` in production, and
  sessions are revocable server-side.
- helmet, CORS allowlist, and per-route rate limits on all auth endpoints.

## Build plan

| Part | Scope                                                           | Status |
| ---- | --------------------------------------------------------------- | ------ |
| 0    | Scaffold, config, logging, tooling, Docker                      | ✅     |
| 1    | Prisma schema, migrations, seed                                 | ✅     |
| 2    | App core: middleware, errors, validation, `/api/v1`             | ✅     |
| 3    | Auth: sessions, Google OAuth, guards, RBAC                      | ✅     |
| 4    | CRUD: ideas, notes, deadlines, future work, literature, journal | ✅     |
| 5    | Projects, members, description brief                            | ✅     |
| 6    | Career goals and stage history                                  | ✅     |
| 7    | Calendar: events, meeting requests, access control              | ✅     |
| 8    | Profile and resume generation                                   | ✅     |
| 9    | Billing: Razorpay orders, webhooks, plan limits                 | ✅     |
| 10   | Notifications and reports                                       | ✅     |
| 11   | Admin and analytics                                             | ✅     |
| 12   | Email service and reminder worker                               | ✅     |
| 13   | Tests, Docker image, CI, API docs                               | ✅     |
