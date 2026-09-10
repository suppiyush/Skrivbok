# ==============================================================================
#  Skrivbok API — production image
# ==============================================================================
#  Build from the repo root, not from apps/server:
#      docker build -f apps/server/Dockerfile -t skrivbok-api .
#
#  Four stages, so the final image carries the compiled output and production
#  dependencies only — no TypeScript, no tests, no source, no dev tooling.
# ==============================================================================

# ── Stage 1: all dependencies ─────────────────────────────────────────────────
# Manifests only, so `npm ci` stays cached until a dependency actually changes.
FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
RUN npm ci

# ── Stage 2: generate the Prisma client, then compile ─────────────────────────
FROM deps AS build
WORKDIR /repo
COPY tsconfig.base.json ./
COPY apps/server ./apps/server

# The client must exist before tsc runs — the code imports its generated types.
RUN npx prisma generate --schema apps/server/prisma/schema.prisma
RUN npm run build --workspace @skrivbok/server

# ── Stage 3: production dependencies ──────────────────────────────────────────
# A fresh `npm ci --omit=dev` rather than `npm prune` on the previous stage:
# pruning would strip the Prisma CLI *and* the generated client it produced,
# and the client cannot be regenerated without the CLI. Installing clean and
# copying the generated output in is both smaller and more predictable.
FROM node:24-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
RUN npm ci --omit=dev

COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /repo/node_modules/@prisma/client ./node_modules/@prisma/client

# ── Stage 4: runtime ──────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /repo

ENV NODE_ENV=production

# The Alpine Node image ships a `node` user. Running as root is a needless
# privilege: a container escape starts with whatever the process already has.
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/server/dist ./apps/server/dist
COPY --from=build --chown=node:node /repo/apps/server/prisma ./apps/server/prisma
COPY --from=build --chown=node:node /repo/apps/server/package.json ./apps/server/
COPY --from=build --chown=node:node /repo/package.json ./

USER node
EXPOSE 4000

# Uses the readiness probe, so an instance that cannot reach the database is
# marked unhealthy and taken out of rotation rather than serving errors.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `node` directly, not `npm start`: npm would sit between the signal and the
# process, and the graceful-shutdown handler would never see SIGTERM.
CMD ["node", "apps/server/dist/server.js"]
