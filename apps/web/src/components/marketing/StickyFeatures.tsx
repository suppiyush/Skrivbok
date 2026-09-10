/**
 * The pinned-illustration feature scroller.
 *
 * One media pane stays put while the text blocks beside it scroll past, and
 * the pane's content swaps to whichever block you are level with. The pattern
 * is Brevo's, and their implementation is the plain CSS one rather than a
 * scroll-jacking library: two equal columns over a track N screens tall, the
 * text column holding N stacked blocks and the media column holding a single
 * `position: sticky` box the same height as one block.
 *
 * Nothing here hijacks the scroll. The page scrolls at its normal speed and
 * `position: sticky` does the pinning, so trackpad, wheel, keyboard and
 * scrollbar all behave exactly as the user expects.
 *
 * Below the `lg` breakpoint the whole conceit is dropped: there is no room for
 * two columns, so each item simply shows its own illustration above its text.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Motion';

export interface StickyFeature {
  /** Small caps label above the heading. */
  eyebrow: string;
  title: string;
  text: string;
  /** The illustration for this step. */
  media: ReactNode;
  link: { label: string; to: string };
}

/** Height of one text block and of the pinned pane. Also the scroll distance
 *  it takes to advance one step, so it governs the pace of the whole section. */
const BLOCK = 460;

export function StickyFeatures({ items }: { items: StickyFeature[] }) {
  const [active, setActive] = useState(0);
  // One entry per text block, so the observer can report which is centred.
  const blocks = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Several blocks can straddle the band at once during a fast scroll;
        // the most visible one wins, so the pane never flickers between two.
        let best: { index: number; ratio: number } | null = null;

        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset['index']);
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index, ratio: entry.intersectionRatio };
          }
        }

        if (best) setActive(best.index);
      },
      // A band across the middle of the viewport: a block counts as current
      // once it reaches the centre, which is where the pinned pane sits.
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.01, 0.5, 1] },
    );

    for (const block of blocks.current) if (block) observer.observe(block);
    return () => observer.disconnect();
  }, [items.length]);

  return (
    <>
      {/* ── Desktop: pinned media, scrolling text ─────────────────────────── */}
      <div className="mt-16 hidden gap-x-16 lg:grid lg:grid-cols-2">
        {/* Media column. The sticky child is centred by offsetting half its
            own height from the middle of the viewport. */}
        <div className="relative">
          <div
            className="sticky flex items-center"
            style={{ top: `calc(50vh - ${BLOCK / 2}px)`, height: BLOCK }}
          >
            <div className="relative w-full">
              {items.map((item, i) => (
                <div
                  key={i}
                  aria-hidden={i !== active}
                  className="transition-all duration-500"
                  style={{
                    // All panes are stacked in the same place; only the active
                    // one is visible. Keeping them mounted means the crossfade
                    // has something to fade between, and no image reloads.
                    position: i === 0 ? 'relative' : 'absolute',
                    inset: i === 0 ? undefined : 0,
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? 'none' : 'translateY(12px) scale(0.985)',
                    pointerEvents: i === active ? 'auto' : 'none',
                  }}
                >
                  {item.media}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Text column. */}
        <div>
          {items.map((item, i) => (
            <div
              key={i}
              data-index={i}
              ref={(node) => {
                blocks.current[i] = node;
              }}
              className="flex flex-col justify-center"
              style={{ minHeight: BLOCK }}
            >
              <FeatureCopy item={item} dimmed={i !== active} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile: one illustration per item, no pinning ─────────────────── */}
      <div className="mt-12 flex flex-col gap-14 lg:hidden">
        {items.map((item, i) => (
          <Reveal key={i}>
            <div className="flex flex-col gap-6">
              {item.media}
              <FeatureCopy item={item} dimmed={false} />
            </div>
          </Reveal>
        ))}
      </div>
    </>
  );
}

/**
 * The copy beside the pane.
 *
 * Inactive blocks fade back rather than disappearing: they are still readable
 * as you scroll toward them, but the eye is drawn to the one the illustration
 * belongs to.
 */
function FeatureCopy({ item, dimmed }: { item: StickyFeature; dimmed: boolean }) {
  return (
    <div
      className="transition-opacity duration-500"
      style={{ opacity: dimmed ? 0.42 : 1 }}
    >
      <p className="text-[12.5px] font-bold tracking-[0.1em] text-brand uppercase">
        {item.eyebrow}
      </p>
      <h3 className="mt-3 text-[clamp(26px,3.2vw,38px)] leading-[1.12] font-extrabold tracking-[-0.035em]">
        {item.title}
      </h3>
      <p className="mt-4 max-w-[46ch] text-[15.5px] leading-[1.7] text-ink-3">{item.text}</p>

      <Link
        to={item.link.to}
        className="group mt-6 inline-flex items-center gap-2 border-b-2 border-ink pb-1 text-[15px] font-bold text-ink transition-colors hover:border-brand hover:text-brand"
      >
        {item.link.label}
        <Icon
          name="arrow_forward"
          size={19}
          className="transition-transform duration-300 group-hover:translate-x-1"
        />
      </Link>
    </div>
  );
}
