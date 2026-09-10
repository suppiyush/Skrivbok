/**
 * Application error types.
 *
 * Services and controllers throw these; the central error handler
 * (`middleware/error.ts`) is the only place that turns them into a response.
 * Nothing outside that handler may call `res.status(...).json({ error })`.
 *
 * Two properties matter:
 *   • `statusCode` — the HTTP status to send.
 *   • `code` — a stable, machine-readable string the frontend can branch on
 *     (`FREE_LIMIT_REACHED`, `SESSION_EXPIRED`), so UI behaviour never depends on
 *     matching a human-readable message.
 *
 * `isOperational` separates *expected* failures (bad input, missing record)
 * from genuine bugs. Operational errors are logged at `warn` and their message
 * is safe to return; anything else is logged at `error` and reported to the
 * client as a generic 500, so internals never leak.
 */

/** Stable error codes shared with the frontend. */
export const ErrorCode = {
  // 400
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  // 401
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  // 403
  FORBIDDEN: 'FORBIDDEN',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  FREE_LIMIT_REACHED: 'FREE_LIMIT_REACHED',
  // 404
  NOT_FOUND: 'NOT_FOUND',
  // 409
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  // 413 / 415
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  // 429
  RATE_LIMITED: 'RATE_LIMITED',
  // 500 / 503
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Field-level detail attached to a validation failure. */
export interface FieldIssue {
  /** Dotted path to the offending field, e.g. "profile.degrees.0.year". */
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCodeValue;
  readonly isOperational: boolean;
  readonly details: FieldIssue[] | undefined;

  constructor(
    statusCode: number,
    code: ErrorCodeValue,
    message: string,
    options?: { details?: FieldIssue[]; cause?: unknown; isOperational?: boolean },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = options?.isOperational ?? true;
    this.details = options?.details;
    Error.captureStackTrace(this, new.target);
  }
}

// ── 4xx ───────────────────────────────────────────────────────────────────────

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code: ErrorCodeValue = ErrorCode.BAD_REQUEST) {
    super(400, code, message);
  }
}

export class ValidationError extends AppError {
  constructor(details: FieldIssue[], message = 'The submitted data is invalid') {
    super(422, ErrorCode.VALIDATION_FAILED, message, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = 'Authentication required',
    code: ErrorCodeValue = ErrorCode.UNAUTHENTICATED,
  ) {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = 'You do not have access to this resource',
    code: ErrorCodeValue = ErrorCode.FORBIDDEN,
  ) {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  /** `NotFoundError('Project')` reads as "Project not found". */
  constructor(resource = 'Resource') {
    super(404, ErrorCode.NOT_FOUND, `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = 'That conflicts with something that already exists',
    code: ErrorCodeValue = ErrorCode.CONFLICT,
  ) {
    super(409, code, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests — please slow down') {
    super(429, ErrorCode.RATE_LIMITED, message);
  }
}

// ── 5xx ───────────────────────────────────────────────────────────────────────

export class InternalError extends AppError {
  constructor(message = 'Something went wrong', cause?: unknown) {
    super(500, ErrorCode.INTERNAL_ERROR, message, { cause, isOperational: false });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message = 'Service temporarily unavailable',
    code: ErrorCodeValue = ErrorCode.SERVICE_UNAVAILABLE,
  ) {
    super(503, code, message);
  }
}

/** A third-party integration (mail, billing) is not configured in this environment. */
export class FeatureDisabledError extends AppError {
  constructor(feature: string) {
    super(503, ErrorCode.FEATURE_DISABLED, `${feature} is not configured on this server`);
  }
}

/** Type guard for the error handler and for `catch` blocks that re-throw. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
