/**
 * Route guard.
 *
 * The server is the authority — this only decides what to render while that
 * answer is being fetched, and where to send someone who is not signed in.
 * The attempted path is preserved so signing in returns them to it.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <span className="ms animate-spin text-[26px] text-brand" aria-hidden="true">
            progress_activity
          </span>
          <p className="text-[13.5px] text-ink-3">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/**
 * The inverse guard, for `/login` and `/register`.
 *
 * Without this, a signed-in visitor who follows a stale "Log In" link (or one
 * from a page that has not yet learned they are signed in) lands back on the
 * sign-in page and can press "Continue with Google" again — which is not
 * broken, just pointless, and reads as if the first sign-in did not take.
 * Sending them straight to the dashboard is the same trust already placed in
 * `RequireAuth` above, just pointed the other way.
 */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
