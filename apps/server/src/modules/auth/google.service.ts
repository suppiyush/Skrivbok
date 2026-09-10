/**
 * Google OAuth 2.0, implemented directly against the endpoints.
 *
 * Passport is deliberately not used. Its Google strategy drags in a serialised
 * `express-session` login state that duplicates — and can disagree with — the
 * session system in `session.service.ts`. The flow itself is two HTTPS calls;
 * owning them keeps one source of truth for "who is signed in", and makes the
 * CSRF protection below explicit rather than implicit.
 *
 * Flow:
 *   1. `buildAuthUrl` mints a random `state`, which the caller stores in a
 *      short-lived httpOnly cookie and sends to Google.
 *   2. Google redirects back with `code` + `state`.
 *   3. The controller compares the returned `state` against the cookie. A
 *      mismatch means the callback was not initiated by this browser — a login
 *      CSRF attempt — and is rejected.
 *   4. `exchangeCode` swaps the code for tokens over a server-to-server call
 *      (the client secret never reaches the browser).
 *   5. `fetchIdentity` reads the profile.
 */
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import {
  BadRequestError,
  FeatureDisabledError,
  ServiceUnavailableError,
} from '../../utils/errors.js';
import type { GoogleIdentity } from './auth.service.js';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/** Google calls must not hang a request thread indefinitely. */
const TIMEOUT_MS = 10_000;

/** Name of the short-lived cookie holding the CSRF `state` value. */
export const OAUTH_STATE_COOKIE = 'skrivbok_oauth_state';

/** The state cookie only has to survive one redirect round trip. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** Narrow `env.google` to its enabled shape, or fail with a clear 503. */
function googleConfig(): { clientId: string; clientSecret: string; callbackUrl: string } {
  if (!env.google.enabled) {
    throw new FeatureDisabledError('Google sign-in');
  }
  return env.google;
}

export function isGoogleEnabled(): boolean {
  return env.google.enabled;
}

/** A random, unguessable CSRF token for the `state` parameter. */
export function createState(): string {
  return randomBytes(24).toString('base64url');
}

export function buildAuthUrl(state: string): string {
  const config = googleConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // No refresh token is requested: Skrivbok only needs the identity once, at
    // sign-in. Asking for offline access would mean storing a long-lived
    // credential with nothing to spend it on.
    access_type: 'online',
    prompt: 'select_account',
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function postForm(url: string, body: URLSearchParams): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    // Google's error body can contain the request parameters, so it is not
    // forwarded to the client.
    throw new ServiceUnavailableError('Could not complete Google sign-in. Please try again.');
  }

  return response.json();
}

/** Exchange the one-time authorization code for an access token. */
export async function exchangeCode(code: string): Promise<string> {
  const config = googleConfig();

  const payload = await postForm(
    TOKEN_ENDPOINT,
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: 'authorization_code',
    }),
  );

  const accessToken =
    typeof payload === 'object' && payload !== null && 'access_token' in payload
      ? payload.access_token
      : undefined;

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new BadRequestError('Google did not return a usable token');
  }

  return accessToken;
}

/**
 * Read the profile behind an access token.
 *
 * The token came straight from Google's token endpoint over TLS in the call
 * above, so this response is trusted without separately verifying an id_token
 * signature.
 */
export async function fetchIdentity(accessToken: string): Promise<GoogleIdentity> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new ServiceUnavailableError('Could not read your Google profile. Please try again.');
  }

  const profile = (await response.json()) as {
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
  };

  if (typeof profile.sub !== 'string' || typeof profile.email !== 'string') {
    throw new BadRequestError('Google did not return an email address for this account');
  }

  return {
    providerAccountId: profile.sub,
    email: profile.email.toLowerCase().trim(),
    name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : null,
    emailVerified: profile.email_verified === true,
  };
}
