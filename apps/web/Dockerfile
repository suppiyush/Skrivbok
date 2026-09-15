# ==============================================================================
#  Skrivbok web — static build served by nginx
# ==============================================================================
#  Build from the repo root, not from apps/web:
#      docker build -f apps/web/Dockerfile -t skrivbok-web .
#
#  The app is compiled once into plain files, and nginx serves them. nginx also
#  forwards /api and /health to the API container, so the browser sees a single
#  origin and the session cookie is sent without any cross-origin setup — the
#  same arrangement the Vite dev server's proxy gives in `npm run dev:web`.
#
#  The web app reads no environment variables at build time, so one image works
#  for any deployment.
# ==============================================================================

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /repo

# Manifests first, so `npm ci` stays cached until a dependency changes.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY apps/web ./apps/web
RUN npm run build --workspace @skrivbok/web

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80
