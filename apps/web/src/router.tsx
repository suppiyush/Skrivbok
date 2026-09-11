/**
 * Routing.
 *
 * Three groups, and the grouping is the security boundary as much as the
 * navigation one:
 *   public   marketing and legal — reachable signed out
 *   auth     login and register — redirect away once signed in
 *   app      everything behind `RequireAuth`
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RedirectIfAuthed, RequireAdmin, RequireAuth } from './components/layout/RequireAuth';
import { useAuth } from './lib/auth';
import { chunks } from './lib/preload';
import Landing from './pages/Landing';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import { Journal } from './pages/Journal';
import { CareerGoals, Deadlines, FutureWork, Ideas, Literature, Notes } from './pages/screens';

// Screens a signed-out visitor never reaches are split out of the first load.
// The loaders come from `lib/preload` so that a link can start fetching one of
// these chunks before the route that needs it is rendered.
const Legal = lazy(chunks.legal);
const Projects = lazy(chunks.projects);
const ProjectDetail = lazy(chunks.projectDetail);
const Admin = lazy(chunks.admin);
const Calendar = lazy(chunks.calendar);
const Meetings = lazy(() => chunks.calendar().then((m) => ({ default: m.Meetings })));
const Profile = lazy(() => chunks.account().then((m) => ({ default: m.Profile })));
const Upgrade = lazy(() => chunks.account().then((m) => ({ default: m.Upgrade })));
const Notifications = lazy(() => chunks.account().then((m) => ({ default: m.Notifications })));
const Help = lazy(() => chunks.account().then((m) => ({ default: m.Help })));
const Settings = lazy(() => chunks.account().then((m) => ({ default: m.Settings })));

/**
 * Where an unmatched path goes.
 *
 * Depends on who is asking: a signed-in user has an app to be returned to, and
 * bouncing them to the marketing page is indistinguishable from being logged
 * out. `loading` is waited on, or the redirect would fire before the session
 * check has answered and always choose the visitor branch.
 */
function NotFound() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? '/dashboard' : '/'} replace />;
}

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <span className="ms animate-spin text-[26px] text-brand" aria-hidden="true">
        progress_activity
      </span>
    </div>
  );
}

const page = (node: ReactNode) => <Suspense fallback={<Loading />}>{node}</Suspense>;
const guarded = (node: ReactNode) => <RequireAuth>{page(node)}</RequireAuth>;

export const router = createBrowserRouter([
  // ── Public ────────────────────────────────────────────────────────────────
  { path: '/', element: <Landing /> },
  // Sign-in and sign-up are the same Google button, so both paths render the
  // same page. They are kept apart only so the wording matches the link the
  // visitor followed — and so existing links to /register keep working.
  {
    path: '/login',
    element: (
      <RedirectIfAuthed>
        <AuthPage mode="login" />
      </RedirectIfAuthed>
    ),
  },
  {
    path: '/register',
    element: (
      <RedirectIfAuthed>
        <AuthPage mode="register" />
      </RedirectIfAuthed>
    ),
  },

  { path: '/terms', element: page(<Legal doc="terms" />) },
  { path: '/privacy-policy', element: page(<Legal doc="privacy" />) },
  { path: '/end-user-agreement', element: page(<Legal doc="eula" />) },
  { path: '/refund-policy', element: page(<Legal doc="refund" />) },
  { path: '/contact', element: page(<Legal doc="contact" />) },

  // ── Application ───────────────────────────────────────────────────────────
  { path: '/dashboard', element: guarded(<Dashboard />) },

  { path: '/ideas', element: guarded(<Ideas />) },
  { path: '/notes', element: guarded(<Notes />) },
  { path: '/journal', element: guarded(<Journal />) },
  { path: '/projects', element: guarded(<Projects />) },
  // One project and its brief. Notifications link here (`/projects/<id>`), and
  // before this screen existed the route rendered the list instead — so a
  // notification about one project opened all of them.
  { path: '/projects/:id', element: guarded(<ProjectDetail />) },
  { path: '/literature', element: guarded(<Literature />) },
  { path: '/future-work', element: guarded(<FutureWork />) },
  { path: '/deadlines', element: guarded(<Deadlines />) },
  { path: '/calendar', element: guarded(<Calendar />) },
  { path: '/meetings', element: guarded(<Meetings />) },
  { path: '/career-goals', element: guarded(<CareerGoals />) },
  { path: '/profile', element: guarded(<Profile />) },
  { path: '/upgrade', element: guarded(<Upgrade />) },
  { path: '/notifications', element: guarded(<Notifications />) },
  { path: '/help', element: guarded(<Help />) },
  { path: '/settings', element: guarded(<Settings />) },

  { path: '/admin', element: <RequireAdmin>{page(<Admin />)}</RequireAdmin> },

  // Unknown paths: a signed-in user goes to their dashboard, a visitor to the
  // marketing page. Sending everyone to the landing page made every broken
  // link look like a session expiry.
  { path: '*', element: <NotFound /> },
]);
