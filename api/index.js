/**
 * Vercel entry point.
 *
 * Vercel turns every file in `api/` into a serverless function. This one hands
 * each request to the same Express app that `apps/server/src/server.ts` binds
 * to a port everywhere else — the app is built to `apps/server/dist` first, so
 * nothing here needs compiling. `vercel.json` routes `/api/*` and `/health*`
 * to it; the function sees the original URL, so the app's own routing applies.
 *
 * There is no `listen`, no signal handling and no cron: the platform starts and
 * stops instances itself, and scheduled passes arrive over HTTP at
 * `/api/v1/internal/*` instead.
 */
import { createApp } from '../apps/server/dist/app.js';

export default createApp();
