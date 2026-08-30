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
  holdMs?: number;
  voiceUrl?: string;
}

/** Long enough to read the line aloud in your head, if there is no voice to do it. */
const DEFAULT_HOLD_MS = 7000;

export function Prologue({ beats, onEnd }: { beats: PrologueBeat[]; onEnd: () => void }) {
  const [index, setIndex] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const beat = beats[index];

  // The screen re-renders every second for its clock, which hands us a fresh
  // onEnd each time. Held in a ref, or the beat timer below is torn down and
  // restarted once a second and no beat ever reaches its end.
  const end = useRef(onEnd);
  end.current = onEnd;

  useEffect(() => {
    setDucked(true);
    return () => {
      setDucked(false);
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
    const advance = () => {
      if (!cancelled) setIndex((i) => i + 1);
    };

    // A beat whose narration has not arrived yet still plays, on the fallback
    // hold — the room must never be left looking at a frozen frame.
    const timer = window.setTimeout(advance, beat.holdMs ?? DEFAULT_HOLD_MS);

    if (beat.voiceUrl !== undefined) {
      const el = new Audio(beat.voiceUrl);
      audio.current = el;
      const onDone = () => {
        window.clearTimeout(timer);
        advance();
      };
      el.addEventListener('ended', onDone);
      el.addEventListener('error', () => undefined);
      el.play().catch(() => undefined);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        el.removeEventListener('ended', onDone);
        el.pause();
      };
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Keyed on the beat itself, never on the caller's callback identity.
  }, [index, beats.length, beat?.voiceUrl, beat?.text, beat?.holdMs]);

  if (!beat) return null;

  return (
    <div className="prologue">
      {beats.map((b, i) =>
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
