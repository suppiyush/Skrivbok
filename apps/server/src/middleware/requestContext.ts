/**
 * Request correlation and access logging.
 *
 * Every request gets an id, echoed back as `x-request-id` and included in both
 * the access log line and any error response. When a user reports a failure,
 * that id is enough to find the exact log entry.
 */
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { createLogger } from '../config/logger.js';

const log = createLogger('http');

/** Paths whose access logs are noise — probes hit them constantly. */
const QUIET_PATHS = new Set(['/health', '/health/ready']);

/**
 * Adopt an upstream `x-request-id` when a proxy or the frontend supplies one, so
 * a trace survives across services. Otherwise mint a new one.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  // Only trust an upstream id that looks like one — an unbounded header value
  // would otherwise end up in every log line.
  req.id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};

/**
 * One log line per completed request. Bound to the response's `finish` event so
 * the status and duration are real, not predicted.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  if (QUIET_PATHS.has(req.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const payload = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
    };

    // 5xx is ours to fix, 4xx is the client's; below that it is routine traffic.
    if (res.statusCode >= 500) {
      log.error(payload, 'request failed');
    } else if (res.statusCode >= 400) {
      log.warn(payload, 'request rejected');
    } else {
      log.info(payload, 'request');
    }
  });

  next();
};
