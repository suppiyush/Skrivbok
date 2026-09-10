/**
 * Request validation.
 *
 * Every route that accepts input declares a Zod schema and mounts `validate()`
 * in front of its controller. By the time a controller runs, its input is
 * parsed, coerced and typed — controllers never re-check anything.
 *
 *   router.post(
 *     '/',
 *     validate({ body: createIdeaSchema }),
 *     ideaController.create,
 *   );
 *
 * Parsed output replaces the raw input, so defaults and coercions (a numeric
 * string becoming a number, a date string becoming a Date) are what the handler
 * sees. In Express 5 `req.query` is a getter, so it is redefined rather than
 * assigned.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';
import { ValidationError, type FieldIssue } from '../utils/errors.js';

export interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/** Flatten a ZodError into the `details` array returned to the client. */
function toFieldIssues(error: z.ZodError, source: keyof ValidationSchemas): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: [source, ...issue.path.map(String)].join('.'),
    message: issue.message,
  }));
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: FieldIssue[] = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        req.params = result.data as typeof req.params;
      } else {
        issues.push(...toFieldIssues(result.error, 'params'));
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        // `req.query` is a lazily-evaluated getter in Express 5; plain
        // assignment throws, so the property is redefined in place.
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        issues.push(...toFieldIssues(result.error, 'query'));
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data;
      } else {
        issues.push(...toFieldIssues(result.error, 'body'));
      }
    }

    // All three sources are checked before failing, so a client fixing a form
    // sees every problem at once instead of one per round trip.
    if (issues.length > 0) {
      next(new ValidationError(issues));
      return;
    }

    next();
  };
}

/**
 * A request whose parts have been narrowed by `validate`.
 *
 *   type CreateIdeaBody = z.infer<typeof createIdeaSchema>;
 *   const create = (req: ValidatedRequest<CreateIdeaBody>, res: Response) => { … }
 */
export type ValidatedRequest<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
  TQuery = unknown,
> = Omit<Request, 'body' | 'params' | 'query'> & {
  body: TBody;
  params: TParams;
  query: TQuery;
};

// ── Reusable fragments ────────────────────────────────────────────────────────

/** Every entity in this schema is keyed by a cuid. */
export const cuidSchema = z
  .string()
  .min(20)
  .max(40)
  .regex(/^[a-z0-9]+$/, 'must be a valid id');

/** `/:id` route parameter. */
export const idParamSchema = z.object({ id: cuidSchema });

/** Cursor-free offset pagination, applied consistently across list endpoints. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;
