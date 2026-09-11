/**
 * A recording, played in place.
 *
 * `<audio controls>` is a different widget in every browser — Chrome's is a
 * grey slab the better part of forty pixels tall — and none of them belong
 * beside the rest of this product. This is the smallest thing that does the
 * job: play, a thin line showing where you are, and how long is left.
 *
 * Nothing is fetched until the first play. A wall of thirty notes must not
 * open thirty connections to the storage provider on mount, which is why the
 * length is passed in from the record rather than read off the file — and why
 * the bar can show a full duration before a single byte has been requested.
 *
 * That stored length is also the only reliable one. A clip recorded by
 * `MediaRecorder` is a WebM stream with no duration in its header, so browsers
 * report `Infinity` for it until the whole thing has been played through. The
 * recorder counted the seconds; we kept them; we use them.
 */
import { useEffect, useRef, useState } from 'react';
import { clock } from '../../lib/format';
import { Icon } from './Icon';

export function AudioPlayer({
  src,
  seconds,
  className = '',
}: {
  src: string;
  /** Length as recorded. See the note above on why this is not read off the file. */
  seconds?: number | null | undefined;
  className?: string;
}) {
  const element = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(seconds ?? 0);

  // A new src is a different recording: rewind rather than leave the old
  // position under it.
  useEffect(() => {
    setAt(0);
    setPlaying(false);
    setLength(seconds ?? 0);
  }, [src, seconds]);

  // Leaving the page mid-clip should not leave it playing.
  useEffect(() => {
    const audio = element.current;
    return () => audio?.pause();
  }, []);

  function toggle() {
    const audio = element.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }

  function seek(to: number) {
    const audio = element.current;
    setAt(to);
    if (audio) audio.currentTime = to;
  }

  const filled = length > 0 ? Math.min(100, (at / length) * 100) : 0;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <audio
        ref={element}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
        onLoadedMetadata={(e) => {
          // Only when the file actually knows — see the header note.
          const real = e.currentTarget.duration;
          if (Number.isFinite(real) && real > 0) setLength(real);
        }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play recording'}
        className="grid size-8 flex-none cursor-pointer place-items-center rounded-full bg-brand-deep text-white transition hover:brightness-110"
      >
        <Icon name={playing ? 'pause' : 'play_arrow'} size={18} />
      </button>

      {/* A range input rather than a styled div: dragging, arrow keys and a
          screen-reader announcement all come with it. */}
      <input
        type="range"
        min={0}
        max={length || 1}
        step={0.01}
        value={at}
        disabled={length === 0}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
        className="scrubber min-w-0 flex-1"
        style={{
          background: `linear-gradient(to right, var(--color-brand) ${filled}%, var(--color-line-2) ${filled}%)`,
        }}
      />

      <span className="flex-none font-mono text-[11.5px] tabular text-ink-3">
        {clock(playing || at > 0 ? at : length)}
      </span>
    </div>
  );
}
