/**
 * Warming the code-split route chunks.
 *
 * A `lazy()` route only starts downloading when it renders — which is the exact
 * moment the user is waiting to see it, so the whole download is spent on a
 * loading state. Nothing requires it to start that late: a pointer resting on a
 * link, or a menu that has just opened, is a few hundred milliseconds of
 * warning, and that is usually the entire chunk.
 *
 * The loaders live here rather than in `router.tsx` so that a screen can warm a
 * route without importing the router: `router.tsx` already imports the screens,
 * and importing it back would be a cycle.
 */

/**
 * The code-split modules, one entry per chunk.
 *
 * `router.tsx` builds its `lazy()` components from these same functions, so
 * there is one definition of where each chunk comes from and warming cannot
 * quietly fetch something the router does not use.
 */
export const chunks = {
  account: () => import('../pages/Account'),
  admin: () => import('../pages/Admin'),
  calendar: () => import('../pages/Calendar'),
  legal: () => import('../pages/Legal'),
  projects: () => import('../pages/Projects'),
  projectDetail: () => import('../pages/ProjectDetail'),
};

/**
 * Which chunk each path needs.
 *
 * Paths absent from this map are not code-split — Ideas, Notes and the rest of
 * `screens.tsx` are in the initial bundle — so warming them is a no-op rather
 * than an error.
 */
const BY_PATH: Record<string, () => Promise<unknown>> = {
  '/projects': chunks.projects,
  '/calendar': chunks.calendar,
  '/meetings': chunks.calendar,
  '/admin': chunks.admin,
  '/profile': chunks.account,
  '/upgrade': chunks.account,
  '/notifications': chunks.account,
  '/help': chunks.account,
  '/settings': chunks.account,
  '/terms': chunks.legal,
  '/privacy-policy': chunks.legal,
  '/end-user-agreement': chunks.legal,
  '/refund-policy': chunks.legal,
  '/contact': chunks.legal,
};

/** Paths already asked for, so a hover that fires repeatedly costs nothing. */
const warmed = new Set<string>();

/**
 * Start fetching the chunk behind a path, if it has one.
 *
 * Safe to call from a pointer handler. A failure is swallowed on purpose: this
 * is an optimisation, and the route imports the module again for real when it
 * renders — that attempt is the one that should surface an error.
 */
export function preloadRoute(path: string): void {
  const load = BY_PATH[path];
  if (!load || warmed.has(path)) return;

  warmed.add(path);
  void load().catch(() => warmed.delete(path));
}
