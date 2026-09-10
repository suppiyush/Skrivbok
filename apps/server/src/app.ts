/**
 * Express application assembly.
 *
 * `createApp()` returns a fully configured app without listening, so tests can
 * drive it with Supertest and `server.ts` owns only the network and lifecycle.
 *
 * Middleware order matters and is deliberate:
 *
 *   1. trust proxy      — before anything reads req.ip (rate limiting, logs)
 *   2. helmet           — security headers on every response, errors included
 *   3. request id       — so every later log line and error can be correlated
 *   4. access log       — records the outcome of everything below it
 *   5. CORS             — must precede routes; rejects disallowed origins early
 *   6. cookie parser    — sessions are read from cookies in Part 3
 *   7. body parsers     — after CORS so a rejected origin never has its body read
 *   8. rate limiting    — after parsing, so a 429 still carries proper headers
 *   9. health probes    — deliberately outside /api and outside rate limiting
 *  10. /api/v1 routes
 *  11. 404 handler      — anything unmatched
 *  12. error handler    — must be last, and must have four parameters
 */
import cookieParser from 'cookie-parser';
import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './db/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { requestId, requestLogger } from './middleware/requestContext.js';
import { apiRouter } from './routes/index.js';
import { ErrorCode, ForbiddenError } from './utils/errors.js';

/** Largest accepted request body. Profiles with long CV sections are the peak. */
const BODY_LIMIT = '1mb';

function corsOptions(): CorsOptions {
  const allowed = new Set(env.corsOrigins);

  return {
    origin(origin, callback) {
      // A missing Origin means a same-origin or non-browser client (curl, the
      // health checker, server-to-server). Those are not CORS requests at all.
      if (!origin || allowed.has(origin)) {
        callback(null, true);
        return;
      }
      // A ForbiddenError (not a bare Error) so the handler answers 403 with a
      // clear code, rather than treating a blocked origin as a server fault.
      callback(new ForbiddenError(`Origin ${origin} is not allowed`, ErrorCode.FORBIDDEN));
    },
    // Required for the session cookie to be sent cross-origin.
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 86_400,
  };
}

export function createApp(): Express {
  const app = express();

  // 1. Behind a load balancer, trust exactly one hop so req.ip is the real
  //    client and Secure cookies are recognised. Trusting all proxies would let
  //    a client spoof X-Forwarded-For and evade rate limiting.
  app.set('trust proxy', env.isProd ? 1 : false);
  app.disable('x-powered-by');
  app.set('json spaces', 0);

  // 2. Security headers. This is a JSON API that serves no HTML, so the CSP and
  //    framing protections that matter for pages are not needed here; the
  //    frontend sets its own.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // 3 & 4.
  app.use(requestId);
  app.use(requestLogger);

  // 5.
  app.use(cors(corsOptions()));

  // 6.
  app.use(cookieParser(env.session.secret));

  // 7. The raw body is retained for the Razorpay webhook, whose signature is
  //    computed over the exact bytes sent — re-serialising the parsed object
  //    would produce a different string and fail verification.
  app.use(
    express.json({
      limit: BODY_LIMIT,
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

  // 8.
  app.use(generalLimiter);

  // 9. Liveness: is the process up? Deliberately does not touch the database, so
  //    a database blip never causes the orchestrator to kill a healthy process.
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'skrivbok-server',
      env: env.nodeEnv,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  //    Readiness: can this instance serve traffic? Checks the database, so a
  //    load balancer stops routing here while Postgres is unreachable.
  app.get('/health/ready', async (_req, res) => {
    try {
      await checkDatabaseConnection();
      res.json({ status: 'ready', database: 'up' });
    } catch (error) {
      res.status(503).json({
        error: {
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: 'Database unreachable',
          ...(env.isProd ? {} : { detail: error instanceof Error ? error.message : String(error) }),
        },
      });
    }
  });

  // 10.
  app.use('/api/v1', apiRouter);

  // 11 & 12.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
