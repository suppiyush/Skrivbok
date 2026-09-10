/**
 * Express request augmentation.
 *
 * Anything middleware attaches to `req` is declared here so downstream handlers
 * see it typed. This is what replaces the legacy pattern of trusting an email
 * from the URL: the authenticated user comes from `req.user`, which only
 * `requireAuth` can populate.
 */

declare global {
  namespace Express {
    interface Request {
      /** Correlation id for this request, echoed in the `x-request-id` header. */
      id?: string;

      /**
       * The exact bytes of the request body, captured by the JSON parser.
       * Needed only by the Razorpay webhook, whose HMAC is computed over the
       * raw payload — re-serialising the parsed object breaks verification.
       */
      rawBody?: Buffer;

      /**
       * The authenticated caller. Undefined on public routes; guaranteed
       * present after `requireAuth`. Populated in Part 3.
       */
      user?: AuthenticatedUser;

      /** The session backing `user`. Populated in Part 3. */
      sessionId?: string;
    }

    /** The subset of the user record carried on a request. Never the password hash. */
    interface AuthenticatedUser {
      id: string;
      email: string;
      name: string | null;
      role: 'USER' | 'ADMIN';
      plan: 'FREE' | 'PRO';
      timezone: string;
    }
  }
}

export {};
