/**
 * Scroll-reveal primitives.
 *
 * One IntersectionObserver per element is fine at this scale and avoids a
 * global registry that has to be kept in sync with mounting and unmounting.
 * The observer disconnects after the first intersection: content should reveal
 * once, not flicker every time it scrolls back past the fold.
 *
 * `once={false}` is deliberately not offered. Re-hiding content the user has
 * already read is an animation working against the reader.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';

/** True when the user has asked the system for less motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
  style,
}: {
  children: ReactNode;
  /** Milliseconds. Used to stagger siblings; keep the total under ~400ms. */
  delay?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(() => prefersReducedMotion());

  useEffect(() => {
    const node = ref.current;
    if (!node || shown) return;

    // Older browsers without IntersectionObserver get the content immediately
    // rather than a permanently invisible page.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect();
        }
      },
      // Fires a little before the element reaches the fold, so the movement is
      // finishing as it arrives rather than starting.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? 'reveal-in' : ''} ${className}`}
      style={{ ...style, ...(delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : {}) }}
    >
      {children}
    </Tag>
  );
}

/**
 * Reveals each child in sequence.
 *
 * Takes the children as an array rather than cloning arbitrary nodes, so the
 * stagger cannot silently fail on a fragment or a conditional.
 */
export function Stagger({
  children,
  step = 60,
  className = '',
}: {
  children: ReactNode[];
  /** Milliseconds between siblings. */
  step?: number;
  className?: string;
}) {
  return (
    <>
      {children.map((child, i) => (
        <Reveal key={i} delay={i * step} className={className}>
          {child}
        </Reveal>
      ))}
    </>
  );
}

/**
 * How far an element has travelled through the viewport, 0 → 1.
 *
 * This is the scrubbed kind of scroll animation, as opposed to the one-shot
 * reveal above: the value tracks the scroll position continuously, so an
 * animation driven by it runs forwards when scrolling down and backwards when
 * scrolling up. That is what makes a line appear to be *drawn* by the scroll
 * rather than merely triggered by it.
 *
 * 0 is reached when the element's top is at 90% of the viewport height, and 1
 * when its bottom reaches 55%. The end is deliberately well inside the fold:
 * an animation that only completes as its section leaves the screen is one the
 * reader never sees finish. Reads are batched into a rAF so a fast scroll
 * costs one layout measurement per frame, not one per scroll event.
 */
export function useScrollProgress(ref: { current: HTMLElement | null }): number {
  const [progress, setProgress] = useState(() => (prefersReducedMotion() ? 1 : 0));

  useEffect(() => {
    // With reduced motion the animation is not played at all — the end state
    // is shown immediately, which is the honest equivalent of a drawn line.
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }

    let frame = 0;

    const measure = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || 800;
      const startY = viewport * 0.9;
      const endY = viewport * 0.55;

      // Distance the top edge travels between p=0 and p=1.
      const span = rect.height + (startY - endY);
      if (span <= 0) return;

      const travelled = startY - rect.top;
      setProgress(Math.min(1, Math.max(0, travelled / span)));
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref]);

  return progress;
}

/**
 * True once the page has been scrolled past `threshold` pixels.
 *
 * Reversible on purpose: scrolling back to the top returns false, so a state
 * tied to it switches off again. That is the difference between this and
 * `Reveal`, which is deliberately one-way.
 */
export function useScrolledPast(threshold = 60): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      setPast(window.scrollY > threshold);
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    // Read once on mount: a reload part-way down the page should not start in
    // the un-scrolled state and then jump.
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);

  return past;
}

/**
 * Counts up to a number when it first appears.
 *
 * Only used for the handful of headline figures. A count-up on every number in
 * a table would be noise, and would make values hard to read while they move.
 */
export function CountUp({
  value,
  duration = 900,
  className = '',
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0));
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // Ease-out cubic: fast at first, settling on the final value.
          setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.2 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
    </span>
  );
}
