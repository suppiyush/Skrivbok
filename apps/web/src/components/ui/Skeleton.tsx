import { useEffect, useState } from 'react';

/**
 * Whether a loading state has lasted long enough to be worth drawing.
 *
 * A request that answers in eighty milliseconds should never paint a skeleton.
 * It appears and is gone again before anyone can read it, and because the
 * skeleton and the thing that replaces it are different heights, the page
 * reflows on the way in and again on the way out. What the user sees is not
 * feedback but a flinch.
 *
 * So nothing is drawn until the wait is long enough to be a wait. Under the
 * threshold the screen goes straight from empty to content; over it, the
 * skeleton appears and stays put for long enough to read as deliberate.
 *
 * Returns to false the moment loading ends, so a slow first load followed by a
 * fast refetch does not keep the placeholder on screen.
 */
export function useSlowLoad(loading: boolean, afterMs = 220): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), afterMs);
    return () => window.clearTimeout(timer);
  }, [loading, afterMs]);

  return slow;
}

/** Skeleton block. Always shaped like the content it replaces. */
export function Skeleton({
  h = 20,
  w = '100%',
  radius = 8,
  className = '',
}: {
  h?: number | string;
  w?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`bg-line-3 ${className}`}
      style={{ height: h, width: w, borderRadius: radius }}
    />
  );
}
