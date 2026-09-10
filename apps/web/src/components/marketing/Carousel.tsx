/**
 * The two-column card carousel.
 *
 * Copy and controls on the left, a horizontally scrolling row of cards on the
 * right that runs off the edge of the viewport — so the next card is always
 * half visible and the row reads as continuing rather than ending.
 *
 * The track is a real scroll container (`overflow-x`, scroll snapping) rather
 * than a transformed strip. That buys touch swiping, trackpad gestures,
 * keyboard scrolling and correct behaviour under `prefers-reduced-motion` for
 * free, and the arrows become a thin wrapper over `scrollBy` instead of a
 * hand-written animation with its own index state to keep in sync.
 *
 * Exactly one card is current at a time — the one leading the track — and
 * every other card is dimmed, whether or not it happens to fit on screen. The
 * index is derived from the scroll offset, so the rule holds at every width.
 * The track carries trailing room equal to its own width less one card, which
 * is what lets the final card scroll into the leading position and sit alone.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../ui/Icon';

/** Gap between cards, in pixels. Must match the `gap-5` on the track. */
const GAP = 20;

export function Carousel({
  eyebrow,
  eyebrowIcon,
  title,
  text,
  footer,
  children,
}: {
  eyebrow: string;
  eyebrowIcon?: string;
  title: ReactNode;
  text: string;
  /** Optional line under the controls — a disclaimer, a link. */
  footer?: ReactNode;
  children: ReactNode[];
}) {
  const count = children.length;
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /** Width of one card plus the gap — the distance one step moves. */
  const cardStep = (node: HTMLDivElement): number => {
    const card = node.querySelector('[data-index]');
    return card ? card.getBoundingClientRect().width + GAP : node.clientWidth;
  };

  /**
   * Which card is leading, and are we at either end?
   *
   * Exactly one card is current — the one at the left of the track — and every
   * other card is dimmed, whether or not it happens to fit on screen. Deriving
   * this from the scroll offset rather than from how much of each card is
   * visible is what makes the rule hold at every viewport width.
   */
  const measure = useCallback(() => {
    const node = track.current;
    if (!node) return;

    const index = Math.min(count - 1, Math.max(0, Math.round(node.scrollLeft / cardStep(node))));
    setActive(index);

    // Both arrows follow the current card rather than the raw scroll extent.
    // Snapping parks the last card a gap's width short of the true maximum, so
    // a `scrollLeft >= scrollWidth - clientWidth` test never fired and Next
    // stayed enabled on the final card.
    setAtStart(index <= 0);
    setAtEnd(index >= count - 1);
  }, [count]);

  useEffect(() => {
    const node = track.current;
    if (!node) return;

    measure();
    node.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      node.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure, count]);

  /** Scroll by exactly one card. */
  const step = (direction: 1 | -1) => {
    const node = track.current;
    if (!node) return;
    node.scrollBy({ left: direction * cardStep(node), behavior: 'smooth' });
  };

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      {/* ── Copy and controls ──────────────────────────────────────────────── */}
      <div className="lg:pr-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink-2">
          {eyebrowIcon ? <Icon name={eyebrowIcon} size={16} className="text-brand" /> : null}
          {eyebrow}
        </span>

        <h2 className="mt-5 text-[clamp(28px,3.6vw,42px)] leading-[1.12] font-extrabold tracking-[-0.035em]">
          {title}
        </h2>

        <p className="mt-4 max-w-[44ch] text-[15.5px] leading-[1.7] text-ink-3">{text}</p>

        <div className="mt-8 flex items-center gap-3">
          <ArrowButton
            direction="left"
            label="Previous"
            disabled={atStart}
            onClick={() => step(-1)}
          />
          <ArrowButton direction="right" label="Next" disabled={atEnd} onClick={() => step(1)} />
        </div>

        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>

      {/* ── Track ──────────────────────────────────────────────────────────── */}
      <div
        ref={track}
        // The negative margin lets the row bleed past the section padding on
        // the right, so the next card is cut by the viewport rather than
        // stopping short of it.
        className="no-scrollbar -mr-5 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 sm:-mr-8 lg:-mr-16"
      >
        {children.map((card, i) => (
          // Two layers on purpose. The outer one carries a solid surface so a
          // dimmed card keeps its shape against the page; the inner one fades,
          // which greys the card's contents rather than making the whole card
          // disappear into the background.
          <div
            key={i}
            data-index={i}
            className="w-[300px] flex-none snap-start rounded-[22px] bg-surface sm:w-[340px]"
          >
            <div
              className="h-full transition-opacity duration-500"
              style={{ opacity: i === active ? 1 : 0.45 }}
            >
              {card}
            </div>
          </div>
        ))}

        {/* Trailing room so the *last* card can scroll all the way to the
            leading position and sit alone, rather than the track stopping as
            soon as its right edge meets the container's. Without this the last
            card can never become the current one. */}
        <div
          aria-hidden="true"
          className="w-[calc(100%-300px)] flex-none sm:w-[calc(100%-340px)]"
        />
      </div>
    </div>
  );
}

function ArrowButton({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`press grid size-12 place-items-center rounded-xl transition ${
        disabled
          ? 'cursor-not-allowed bg-surface-2 text-ink-5'
          : 'bg-ink text-white hover:bg-[#1a2130]'
      }`}
    >
      <Icon name={direction === 'left' ? 'arrow_back' : 'arrow_forward'} size={21} />
    </button>
  );
}
