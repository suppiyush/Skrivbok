# Module conventions

Every feature is a self-contained folder under `src/modules/`. **No file outside a
module may import that module's service or repository directly** — go through its
public `index.ts`.

## Required file shape

```
modules/<feature>/
├── <feature>.routes.ts       Path -> middleware -> controller. Nothing else.
├── <feature>.controller.ts   HTTP in / HTTP out. No SQL, no business rules.
├── <feature>.service.ts      Business rules, authorization, transactions.
├── <feature>.schema.ts       Zod schemas + inferred DTO types.
├── <feature>.mapper.ts       Prisma row -> API response shape. (optional)
└── index.ts                  Exports the router, and nothing else by default.
```

## Layer rules

| Layer          | May import                           | Must never                                     |
| -------------- | ------------------------------------ | ---------------------------------------------- |
| **routes**     | controller, middleware, schema       | contain logic, touch Prisma                    |
| **controller** | service, schema, mapper              | write SQL, decide authorization                |
| **service**    | Prisma client, other services, utils | read `req`/`res`, know about HTTP status codes |
| **schema**     | zod only                             | import anything from the app                   |

A controller's job is exactly three things: pull already-validated input off
`req`, call one service method, shape the response. If a controller is longer
than ~20 lines, logic has leaked out of the service.

## The rule that fixes the legacy app

**A service method never accepts an identity from the client.** The caller's id
is passed in from `req.user.id` by the controller, and every query is scoped by
it:

```ts
// ✅ ownership is enforced in the query itself
findMany({ where: { userId, deletedAt: null } });

// ❌ what the old server did — trusts an email off the URL
findMany({ where: { user_email: req.params.email } });
```

For shared resources (projects, calendars) the service must additionally check
membership or granted access before returning or mutating anything.

## Errors

Throw `AppError` subclasses (`NotFoundError`, `ForbiddenError`, `ConflictError`,
…) from services. Never call `res.status(...)` in a service, and never
`try/catch` in a controller just to send a 500 — the central error handler owns
that. See `src/middleware/error.ts` (Part 2).

## Validation

Every route with input gets `validate({ body, params, query })` in front of it.
Controllers may assume input is parsed and typed; they never re-check it.
