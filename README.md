# Skrivbok

A space to write, organize and grow. Complete rebuild of the original Skrivbok
codebase on a typed, modular stack.

> **Status:** Backend complete — all 13 parts. Frontend next. See [Build plan](#build-plan).

## Stack

| Layer      | Choice                                                          |
| ---------- | --------------------------------------------------------------- |
| Runtime    | Node 24 (LTS 22+), ESM, TypeScript 5.9 strict                   |
| API        | Express 5                                                       |
| Database   | PostgreSQL 17 + Prisma ORM (versioned migrations)               |
| Validation | Zod 4 — one schema per request, shared with the frontend later  |
| Auth       | Opaque session tokens in `httpOnly` cookies, hashed in Postgres |
| Logging    | pino (JSON in prod, pretty in dev, secrets redacted)            |
| Web        | React 19 + Vite + Tailwind 4 + shadcn/ui _(Phase 2)_            |
| Tooling    | npm workspaces, ESLint 9 flat config, Prettier, Vitest          |

## Layout

```
skrivbok/
├── apps/
│   └── api/                    Backend service
│       ├── src/
│       │   ├── config/         env.ts (Zod-validated), logger.ts
│       │   ├── db/             prisma.ts (client singleton), seed.ts
│       │   ├── middleware/     auth guards, validate, errors, rate limits
│       │   ├── routes/         the /api/v1 router index
│       │   ├── modules/        one folder per feature — see modules/README.md
│       │   ├── jobs/           reminder worker + cleanup
│       │   ├── emails/         templates + SMTP transport
│       │   ├── types/          Express request augmentation
│       │   ├── utils/          errors.ts and shared helpers
│       │   ├── app.ts          Express assembly (no listen)
│       │   └── server.ts       Entry point + graceful shutdown
│       └── prisma/             schema.prisma + migrations
├── packages/
│   └── shared/                 Types + Zod schemas shared with the web app
├── docker-compose.yml          Local Postgres (+ optional Adminer)
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

# 4. Run the API
npm run dev            # http://localhost:4000
curl http://localhost:4000/health
```

The API refuses to start on invalid configuration — it prints exactly which
variables are wrong and exits, rather than failing later inside a request.

### Scripts

| Command                 | What it does                                 |
| ----------------------- | -------------------------------------------- |
| `npm run dev`           | API with hot reload (tsx watch)              |
| `npm run build`         | Type-check and compile to `apps/server/dist` |
| `npm start`             | Run the compiled build                       |
| `npm run typecheck`     | Type-check every workspace, no emit          |
| `npm run lint`          | ESLint across the repo                       |
| `npm run format`        | Prettier write                               |
| `npm run db:up/down`    | Start / stop local Postgres                  |
| `npm test`              | 85 tests — unit + integration                |
| `npm run test:coverage` | Coverage report                              |
| `npm run worker`        | Reminder worker (separate process)           |

## Running the worker

The reminder worker is a **separate process** from the API:

```bash
npm run dev      # API
npm run worker   # reminders, in a second terminal
```

Set `ENABLE_REMINDER_WORKER=false` on API instances in production. The legacy
server ran its cron inside every API process, so scaling to two instances would
have doubled every reminder email.

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

```bash
docker build -f apps/server/Dockerfile -t skrivbok-api .
docker run --env-file .env -p 4000:4000 skrivbok-api
```

Multi-stage build, non-root user, healthcheck wired to `/health/ready`, and
`node` as PID 1 so SIGTERM reaches the graceful-shutdown handler.

Run `npx prisma migrate deploy` before starting a new version.

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
