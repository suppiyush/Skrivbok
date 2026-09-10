/**
 * Sign in / Sign up.
 *
 * Google is the only sign-in method, so this page has no form: one button,
 * which hands off to `/api/v1/auth/google`. Signing in and signing up are the
 * same action — the server creates the account the first time an identity is
 * seen — so `/login` and `/register` render the same page and differ only in
 * their wording.
 *
 * Layout is two columns: a fixed reassurance panel on the left and the sign-in
 * panel on the right. The left column is deliberately composed rather than left
 * half-empty — an unbalanced sign-in screen is the first thing a new user sees.
 *
 * Every error state is handled: Google declined · expired state · server not
 * configured for Google · server unreachable.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/api';
import { Icon } from '../components/ui/Icon';
import { Logo } from '../components/marketing/MarketingChrome';
import { LoginArt } from '../components/marketing/LoginArt';

/** Google's redirect carries a reason; each maps to its own sentence. */
const OAUTH_ERRORS: Record<string, string> = {
  google_declined: 'Google sign-in was cancelled. Nothing was created — try again when ready.',
  google_state_mismatch:
    'That sign-in link has expired. Start again from this page rather than reusing an old link.',
  google_incomplete: 'Google did not complete the sign-in. Please try again.',
  google_failed: 'Google sign-in could not be completed. Please try again in a moment.',
};

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [params] = useSearchParams();

  /**
   * Four states, not a boolean.
   *
   * "The server has no Google keys" and "the server did not answer" are
   * different facts and must not collapse into the same failure: the first is
   * permanent and the operator has to fix it, the second may well be gone by
   * the time the user reloads. Either way the button cannot work, and saying
   * which is which is the difference between a useful page and a dead one.
   */
  const [google, setGoogle] = useState<'loading' | 'on' | 'off' | 'unreachable'>('loading');

  useEffect(() => {
    let cancelled = false;

    const load = async (attempt = 0): Promise<void> => {
      try {
        const config = await auth.config();
        if (!cancelled) setGoogle(config.googleEnabled ? 'on' : 'off');
      } catch {
        // One retry: a dev server restarting mid-load is the common case, and
        // it is back within a second or two.
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          if (!cancelled) await load(1);
          return;
        }
        if (!cancelled) setGoogle('unreachable');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const oauthError = params.get('error');
  const errorMessage = oauthError
    ? (OAUTH_ERRORS[oauthError] ?? OAUTH_ERRORS['google_failed']!)
    : null;

  const isLogin = mode === 'login';

  return (
    <div className="grid min-h-screen bg-canvas-alt lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Left: the illustration ──────────────────────────────────────
          Hidden below `lg`: on a phone the sign-in panel is the whole point of
          the screen, and an illustration above it only pushes it down. */}
      <aside className="relative hidden flex-col justify-center overflow-hidden bg-surface px-14 py-12 lg:flex">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-24 size-[560px] rounded-full"
          style={{
            background: 'radial-gradient(closest-side, var(--color-brand-tint), transparent)',
          }}
        />

        <div className="relative mx-auto w-full max-w-[520px]">
          <h2 className="text-[clamp(28px,2.6vw,38px)] leading-[1.15] font-extrabold tracking-[-0.035em]">
            Everything your research runs on, in one workspace.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[15.5px] leading-[1.7] text-ink-3">
            Ideas, notes, literature, deadlines and your calendar — held together, so nothing is
            tracked in four places and lost in a fifth.
          </p>

          <LoginArt className="mt-10 w-full" />
        </div>
      </aside>

      {/* ── Right: the sign-in panel ───────────────────────────────────── */}
      <div className="flex flex-col px-5 py-7 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="Skrivbok home">
            <Logo size={28} />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1 text-[13px] font-semibold text-ink-3 transition hover:text-ink"
          >
            <Icon name="arrow_back" size={16} />
            Back to site
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="text-[27px] leading-tight font-extrabold tracking-[-0.035em]">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
            {isLogin
              ? 'Continue with Google to pick up where you left off.'
              : 'Continue with Google. Nothing to install, no password to remember, no card required.'}
          </p>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-xl border border-danger/25 border-l-[3px] border-l-danger bg-danger-tint px-4 py-3"
            >
              <Icon name="error" size={18} className="mt-px flex-none text-danger" />
              <p className="text-[13px] leading-relaxed text-danger-ink">{errorMessage}</p>
            </div>
          ) : null}

          {/* The button is the whole page, so it is never simply hidden. Each
              state that stops it working says so in its place. */}
          {google === 'on' ? (
            <a
              href="/api/v1/auth/google"
              className="mt-6 flex h-12 items-center justify-center gap-2.5 rounded-xl border border-line-2 bg-surface text-[14.5px] font-semibold text-ink transition hover:bg-surface-2"
            >
              <GoogleMark />
              Continue with Google
            </a>
          ) : google === 'loading' ? (
            <div
              aria-hidden="true"
              className="mt-6 flex h-12 items-center justify-center gap-2.5 rounded-xl border border-line-2 bg-surface-2 text-[14.5px] font-semibold text-ink-4"
            >
              <Icon name="progress_activity" size={18} className="animate-spin" />
              Checking sign-in…
            </div>
          ) : (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-xl border-l-[3px] border-l-warn bg-warn-tint px-4 py-3"
            >
              <Icon
                name={google === 'off' ? 'key_off' : 'cloud_off'}
                size={18}
                className="mt-px flex-none text-warn"
              />
              <p className="text-[13px] leading-relaxed text-warn-ink">
                {google === 'off'
                  ? 'Google sign-in is not configured on this server, so there is currently no way to sign in. If this is your Skrivbok, add the Google OAuth keys and restart the server.'
                  : 'Cannot reach the Skrivbok server, so signing in will not work yet. Check your connection and reload.'}
              </p>
            </div>
          )}

          {/* The payment provider requires the Terms, EULA and Privacy Policy
              to be agreed at sign-up and reachable from here. Signing in and
              signing up are the same button, so the line sits under it. */}
          <p className="mt-5 text-center text-[12px] leading-relaxed text-ink-4">
            By continuing you agree to our{' '}
            <Link to="/terms" className="font-semibold text-ink-3 hover:text-ink">
              Terms
            </Link>
            ,{' '}
            <Link to="/end-user-agreement" className="font-semibold text-ink-3 hover:text-ink">
              End User Agreement
            </Link>{' '}
            and{' '}
            <Link to="/privacy-policy" className="font-semibold text-ink-3 hover:text-ink">
              Privacy Policy
            </Link>
            .
          </p>

          <p className="mt-6 border-t border-line pt-5 text-center text-[13px] leading-relaxed text-ink-3">
            {isLogin
              ? 'No account yet? The same button creates one the first time you sign in.'
              : 'Already have an account? The same button signs you back into it.'}
          </p>
        </div>

        <footer className="mx-auto flex w-full max-w-[400px] flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12px] text-ink-4">
          <span>© {new Date().getFullYear()} Skrivbok</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/terms" className="transition hover:text-ink-2">
              Terms
            </Link>
            <Link to="/privacy-policy" className="transition hover:text-ink-2">
              Privacy
            </Link>
            <Link to="/contact" className="transition hover:text-ink-2">
              Contact
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
