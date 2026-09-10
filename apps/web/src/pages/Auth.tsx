/**
 * Login and Sign up.
 *
 * One component, two tabs — the design switches between them in place rather
 * than navigating, so the panel does not jump.
 *
 * Layout is two columns: the form on the left over the app canvas, and a
 * fixed reassurance panel on the right. The right column is deliberately
 * composed rather than left half-empty — an unbalanced sign-in screen is the
 * first thing a new user sees.
 *
 * Every error state from the design is handled:
 *   wrong credentials · rate limited (429) · Google declined · inline field errors
 */
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, auth } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Icon } from '../components/ui/Icon';
import { Logo } from '../components/marketing/MarketingChrome';
import { LoginArt } from '../components/marketing/LoginArt';

/** Google's redirect carries a reason; each maps to its own sentence. */
const OAUTH_ERRORS: Record<string, string> = {
  google_declined: 'Google sign-in was cancelled. You can try again or use your email address.',
  google_state_mismatch:
    'That sign-in link has expired. Start again from this page rather than reusing an old link.',
  google_incomplete: 'Google did not complete the sign-in. Please try again.',
  google_failed: 'Google sign-in could not be completed. Please try again in a moment.',
};


export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refresh } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>(mode);
  /**
   * Three states, not a boolean.
   *
   * "The server has no Google keys" and "the server did not answer" are
   * different facts and must not collapse into the same `false`: the first
   * means hide the button, the second means the whole page is about to fail
   * and the user deserves to be told before typing a password into it.
   */
  const [google, setGoogle] = useState<'loading' | 'on' | 'off' | 'unreachable'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
  useEffect(() => {
    if (oauthError) setFormError(OAUTH_ERRORS[oauthError] ?? OAUTH_ERRORS['google_failed']!);
  }, [oauthError]);

  useEffect(() => setTab(mode), [mode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    try {
      if (tab === 'login') {
        await auth.login(email, password);
      } else {
        await auth.register({
          name: String(form.get('name') ?? ''),
          email,
          password,
          // The browser knows the timezone; asking the user to pick it is friction.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details.length > 0) {
          setFieldErrors(
            Object.fromEntries(
              error.details.map((d) => [d.path.replace(/^body\./, ''), d.message]),
            ),
          );
          setFormError(null);
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError('Could not reach the server. Check your connection and try again.');
      }
      setSubmitting(false);
    }
  }

  function switchTo(next: 'login' | 'register') {
    setTab(next);
    setFormError(null);
    setFieldErrors({});
    navigate(next === 'login' ? '/login' : '/register', { replace: true });
  }

  const isLogin = tab === 'login';

  return (
    <div className="grid min-h-screen bg-canvas-alt lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Left: the illustration ──────────────────────────────────────
          Hidden below `lg`: on a phone the form is the whole point of the
          screen, and an illustration above it only pushes it below the fold. */}
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

      {/* ── Right: the form ────────────────────────────────────────────── */}
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
              ? 'Sign in to pick up where you left off.'
              : 'Name, email and a password. Nothing to install, no card required.'}
          </p>

          <div
            role="tablist"
            aria-label="Sign in or create an account"
            className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1"
          >
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => switchTo(t)}
                className={`h-9 rounded-[9px] text-[13.5px] font-semibold transition ${
                  tab === t
                    ? 'border border-line bg-surface text-ink shadow-card'
                    : 'border border-transparent text-ink-3 hover:text-ink'
                }`}
              >
                {t === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* The email form is just as broken as the Google button when the
              API is down, so say so once, here, rather than letting the user
              discover it by submitting. */}
          {google === 'unreachable' ? (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border-l-[3px] border-l-warn bg-warn-tint px-4 py-3"
            >
              <Icon name="cloud_off" size={18} className="mt-px flex-none text-warn" />
              <p className="text-[13px] leading-relaxed text-warn-ink">
                Cannot reach the Skrivbok server, so signing in will not work yet. Check your
                connection and reload.
              </p>
            </div>
          ) : null}

          {formError ? (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger/25 border-l-[3px] border-l-danger bg-danger-tint px-4 py-3"
            >
              <Icon name="error" size={18} className="mt-px flex-none text-danger" />
              <p className="text-[13px] leading-relaxed text-danger-ink">{formError}</p>
            </div>
          ) : null}

          {/* Google first: it is the fastest path, and the email form stays
              complete below it rather than being hidden behind a toggle. It is
              hidden only when the server states it has no keys — never merely
              because the check failed. */}
          {google === 'on' ? (
            <>
              <a
                href="/api/v1/auth/google"
                className="mt-5 flex h-11 items-center justify-center gap-2.5 rounded-xl border border-line-2 bg-surface text-[14px] font-semibold text-ink transition hover:bg-surface-2"
              >
                <GoogleMark />
                Continue with Google
              </a>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line-3" />
                <span className="text-[12px] text-ink-4">or continue with email</span>
                <span className="h-px flex-1 bg-line-3" />
              </div>
            </>
          ) : null}

          <form
            className={`flex flex-col gap-4 ${google === 'on' ? '' : 'mt-6'}`}
            onSubmit={onSubmit}
            noValidate
          >
            {!isLogin ? (
              <Field
                label="Name"
                name="name"
                autoComplete="name"
                placeholder="Your full name"
                required
                error={fieldErrors['name']}
              />
            ) : null}

            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              required
              error={fieldErrors['email']}
            />

            <PasswordField
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              error={fieldErrors['password']}
              hint={isLogin ? undefined : 'At least 8 characters. Length matters more than symbols.'}
              action={
                isLogin ? (
                  <Link
                    to="/forgot-password"
                    className="text-[12.5px] font-semibold text-brand-ink hover:underline"
                  >
                    Forgot password?
                  </Link>
                ) : undefined
              }
            />

            <Button type="submit" variant="primary" size="lg" loading={submitting} className="mt-1">
              {submitting
                ? isLogin
                  ? 'Signing in…'
                  : 'Creating account…'
                : isLogin
                  ? 'Sign in'
                  : 'Create account'}
            </Button>

            {/* The payment provider requires the Terms, EULA and Privacy Policy
                to be agreed at sign-up and reachable from here. */}
            {!isLogin ? (
              <p className="text-center text-[12px] leading-relaxed text-ink-4">
                By creating an account you agree to our{' '}
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
            ) : null}

            <p className="text-center text-[13px] text-ink-3">
              {isLogin ? 'New to Skrivbok? ' : 'Already have an account? '}
              <button
                type="button"
                className="font-semibold text-brand-ink hover:underline"
                onClick={() => switchTo(isLogin ? 'register' : 'login')}
              >
                {isLogin ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </form>
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

/**
 * Password input with a reveal toggle.
 *
 * Field cannot carry an adornment or a label-row action, and both matter here:
 * typos in a masked field are the most common reason a correct password is
 * reported as wrong, and "Forgot password?" belongs beside the label rather
 * than floating under the input.
 */
function PasswordField({
  autoComplete,
  error,
  hint,
  action,
}: {
  autoComplete: string;
  error?: string | undefined;
  hint?: string | undefined;
  action?: ReactNode | undefined;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
          Password
        </label>
        {action}
      </div>

      <div
        className={`flex h-11 items-center rounded-[11px] border bg-surface pr-1.5 pl-3.5 transition focus-within:border-brand ${
          error ? 'border-danger' : 'border-line-2'
        }`}
      >
        <input
          id={id}
          name="password"
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder="••••••••"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="w-full min-w-0 border-0 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-5"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className="grid size-8 flex-none place-items-center rounded-lg text-ink-4 transition hover:bg-surface-2 hover:text-ink-2"
        >
          <Icon name={shown ? 'visibility_off' : 'visibility'} size={18} />
        </button>
      </div>

      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-[12.5px] text-danger-ink">
          <Icon name="error" size={15} className="mt-px flex-none" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12.5px] leading-relaxed text-ink-3">
          {hint}
        </p>
      ) : null}
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
