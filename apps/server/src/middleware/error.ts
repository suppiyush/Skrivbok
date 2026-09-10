/**
 * The one place errors become HTTP responses.
 *
 * Express 5 forwards rejected promises from async handlers to this middleware
 * automatically, so there is no `asyncHandler` wrapper anywhere in this codebase
 * — an `async` controller that throws lands here on its own.
 *
 * Response shape, always:
 *
 *   { "error": { "code": "NOT_FOUND", "message": "Project not found",
 *                "requestId": "…", "details": [ … ] } }
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import {
  AppError,
  ConflictError,
  ErrorCode,
  NotFoundError,
  ValidationError,
  isAppError,
  type FieldIssue,
} from '../utils/errors.js';

const log = createLogger('http');

/** Nothing matched — mounted after all routes. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
};

/**
 * Translate errors thrown by libraries into our own types, so the handler below
 * only ever deals with `AppError`.
 */
function normalise(error: unknown): AppError {
  if (isAppError(error)) return error;

  // A Zod error that escaped `validate()` — e.g. a service parsing external data.
  if (error instanceof z.ZodError) {
    const details: FieldIssue[] = error.issues.map((i) => ({
      path: i.path.map(String).join('.'),
      message: i.message,
    }));
    return new ValidationError(details);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        // Unique constraint. `meta.target` names the offending column(s).
        const target = error.meta?.['target'];
        const field = Array.isArray(target)
          ? target.join(', ')
          : typeof target === 'string'
            ? target
            : 'value';
        return new ConflictError(
          `A record with that ${field} already exists`,
          ErrorCode.ALREADY_EXISTS,
        );
      }
      case 'P2025':
        return new NotFoundError('Record');
      case 'P2003':
        return new ConflictError('That change would break a reference to another record');
      default:
        break;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    // A malformed query is our bug, never the client's.
    return new AppError(500, ErrorCode.INTERNAL_ERROR, 'Invalid database query', {
      cause: error,
      isOperational: false,
    });
  }

  // Body parser failures arrive as plain Errors carrying a `status`.
  if (error instanceof SyntaxError && 'body' in error) {
    return new AppError(400, ErrorCode.BAD_REQUEST, 'Request body is not valid JSON');
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    return new AppError(413, ErrorCode.PAYLOAD_TOO_LARGE, 'Request body is too large');
  }

  return new AppError(500, ErrorCode.INTERNAL_ERROR, 'Something went wrong', {
    cause: error,
    isOperational: false,
  });
}

// Express identifies an error handler by its arity, so all four parameters must
// stay declared even though `next` is unused.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = normalise(err);

  const context = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode: appError.statusCode,
    code: appError.code,
  };

  if (appError.isOperational) {
    // Expected: bad input, missing record, denied access. Not a defect.
    log.warn(context, appError.message);
  } else {
    // A real bug. Log the original error with its stack, not the wrapper.
    log.error({ ...context, err: err instanceof Error ? err : appError }, appError.message);
  }

  // Never leak internals. Non-operational errors get a fixed message in
  // production; in development the real one is kept, to make debugging possible.
  const clientMessage =
    appError.isOperational || !env.isProd ? appError.message : 'Something went wrong';

  if (res.headersSent) {
    // The response already started streaming — destroy it rather than appending
    // a second body, which would corrupt the payload.
    req.destroy();
    return;
  }

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: clientMessage,
      ...(appError.details ? { details: appError.details } : {}),
      ...(req.id ? { requestId: req.id } : {}),
      // A stack is included only for unexpected failures, and only outside
      // production. Attaching one to routine 404s and validation errors buries
      // the useful part of the response in noise.
      ...(!env.isProd && !appError.isOperational && err instanceof Error
        ? { stack: err.stack }
        : {}),
    },
  });
};
