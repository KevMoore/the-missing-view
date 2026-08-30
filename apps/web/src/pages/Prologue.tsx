/**
 * The narrated opening, on the big screen.
 *
 * Deliberately not three.js. The art direction is oil paint, and 3D primitives
 * would fight it; WebGL is also a failure mode on a borrowed venue laptop, and
 * this runs in rooms we do not control. A slow push on a painted still, a long
 * cross-dissolve and a caption read as more expensive than a rendered scene,
 * and cannot fail to draw.
 *
 * Each beat holds until its narration ends. With no audio — no key, a refusal,
 * a case with no voice — it falls back to a fixed hold, so the sequence always
 * runs to the end at roughly the right pace.
 */
import { useEffect, useRef, useState } from 'react';
import { fadeOutPrologue, setDucked } from '../music.js';

export interface PrologueBeat {
  text: string;
  sceneAsset?: string;
  videoAsset?: string;
  holdMs?: number;
  voiceUrl?: string;
}

/** Long enough to read the line aloud in your head, when there is no voice to do it. */
const DEFAULT_HOLD_MS = 7000;
/**
 * A narrated beat ends when the narration ends — never on a clock. This is only
 * a stall-breaker for audio that loads and then never fires 'ended', and it is
 * set far past any plausible line so it can never cut one short.
 */
const NARRATED_WATCHDOG_MS = 45_000;
/** A breath after the line lands, so the cut does not tread on the last word. */
const TAIL_MS = 900;

export function Prologue({
  beats,
  videoAsset,
  onEnd,
}: {
  beats: PrologueBeat[];
  videoAsset?: string | undefined;
  onEnd: () => void;
}) {
  const [index, setIndex] = useState(0);
  // A film that will not load or will not play drops us back to the paintings,
  // which is why they stay in the case pack even once a film exists.
  const [filmFailed, setFilmFailed] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const beat = beats[index];

  // The screen re-renders every second for its clock, which hands us a fresh
  // onEnd each time. Held in a ref, or the beat timer below is torn down and
  // restarted once a second and no beat ever reaches its end.
  const end = useRef(onEnd);
  end.current = onEnd;

  useEffect(() => {
    setDucked('prologue', true);
    return () => {
      setDucked('prologue', false);
      audio.current?.pause();
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    if (!beat) {
      end.current();
      return;
    }
    // Start the fade on the final beat, so the score runs out with the last
    // line rather than being cut off by the lobby appearing.
    if (index === beats.length - 1) fadeOutPrologue();
    let cancelled = false;
    let tail: number | undefined;
    const advance = () => {
      if (!cancelled) setIndex((i) => i + 1);
    };

    if (beat.voiceUrl !== undefined) {
      // Narrated: the line decides the length. The watchdog is long enough that
      // it can only ever rescue a stall, never truncate a reading.
      const timer = window.setTimeout(advance, NARRATED_WATCHDOG_MS);
      const el = new Audio(beat.voiceUrl);
      audio.current = el;
      const onDone = () => {
        window.clearTimeout(timer);
        tail = window.setTimeout(advance, TAIL_MS);
      };
      el.addEventListener('ended', onDone);
      // If it will not play at all, fall back to the written hold rather than
      // sitting on one frame for the length of the watchdog.
      const onBroken = () => {
        window.clearTimeout(timer);
        tail = window.setTimeout(advance, beat.holdMs ?? DEFAULT_HOLD_MS);
      };
      el.addEventListener('error', onBroken);
      el.play().catch(onBroken);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        if (tail !== undefined) window.clearTimeout(tail);
        el.removeEventListener('ended', onDone);
        el.removeEventListener('error', onBroken);
        el.pause();
      };
    }

    // Silent: the written hold is all we have.
    const timer = window.setTimeout(advance, beat.holdMs ?? DEFAULT_HOLD_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Keyed on the beat itself, never on the caller's callback identity.
  }, [index, beats.length, beat?.voiceUrl, beat?.text, beat?.holdMs]);

  if (!beat) return null;

  const film = filmFailed ? undefined : (beat.videoAsset ?? videoAsset);

  return (
    <div className="prologue">
      {film !== undefined && (
        <video
          className="prologue-film"
          // Keyed so a per-beat film swaps; one film for the whole opening keeps playing.
          key={film}
          src={film}
          autoPlay
          muted={false}
          playsInline
          onError={() => {
            setFilmFailed(true);
          }}
          aria-hidden
        />
      )}
      {film === undefined &&
        beats.map((b, i) =>
          b.sceneAsset === undefined ? null : (
            <div
              key={b.sceneAsset + String(i)}
              className={`prologue-plate${i === index ? ' on' : ''}`}
              style={{ backgroundImage: `url(${b.sceneAsset})` }}
              aria-hidden
            />
          ),
        )}
      <div className="prologue-vignette" aria-hidden />
      <p className="prologue-line" key={index}>
        {beat.text}
      </p>
      <div className="prologue-progress" aria-hidden>
        {beats.map((b, i) => (
          <span key={b.text} className={i <= index ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
