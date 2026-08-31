/**
 * The interrogation, out loud, on the big screen.
 *
 * Same rule as the score: the screen is the room's only speaker, so this runs
 * on that surface alone, and the score ducks underneath whoever is speaking.
 *
 * The unit here is the **exchange**, not the line. A question and its answer
 * are made at different moments — the question the instant it is asked, the
 * answer once the model has written it — so a queue that simply appended each
 * new recording played the first question, then the second question, then the
 * first answer, whenever the room asked faster than the model could reply. A
 * busy interrogation came out shuffled.
 *
 * Playback now walks the questions in the order they were asked and plays each
 * one through before starting the next, waiting for a piece that has not
 * arrived rather than stepping over it. It waits only so long: a recording that
 * never comes must not silence every exchange behind it.
 *
 * The written text is on screen throughout, so a missing voice costs the room
 * nothing but the sound of it.
 */
import { useEffect, useRef, useState } from 'react';
import { setDucked } from './music.js';
import { speak, stopSpeaking } from './speaker.js';

export interface Exchange {
  id: string;
  /** Who is answering, so the room can be shown who is speaking. */
  suspectId: string;
  /** The question, in the asker's character voice. */
  askUrl?: string | undefined;
  /** The suspect's reply. */
  voiceUrl?: string | undefined;
}

/**
 * How long to hold an exchange open for a recording that has not arrived. Long
 * enough for the model to write a reply and for that reply to be spoken; short
 * enough that one failure does not mute the rest of the act.
 */
const WAIT_FOR_MISSING_MS = 25_000;

/**
 * @returns the suspect currently answering, or null. A big screen shows five
 * portraits and plays one voice, and without this the room has to work out
 * which of the five it is listening to.
 */
export function useSuspectVoices(
  exchanges: readonly Exchange[],
  enabled: boolean,
  isMuted: boolean,
): string | null {
  // The driver is a loop, not a render, so its state lives in refs.
  const live = useRef<readonly Exchange[]>(exchanges);
  live.current = exchanges;

  const askedFor = useRef(new Set<string>());
  const answered = useRef(new Set<string>());
  const speaking = useRef(false);
  const waitingSince = useRef(new Map<string, number>());
  const timer = useRef<number | undefined>(undefined);
  const pump = useRef<() => void>(() => undefined);
  const [answering, setAnswering] = useState<string | null>(null);

  useEffect(() => {
    if (isMuted) {
      stopSpeaking();
      speaking.current = false;
      setAnswering(null);
      setDucked('suspect-voice', false);
    }
  }, [isMuted]);

  pump.current = () => {
    if (speaking.current || !enabled || isMuted) return;
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }

    /** `who` is set only for a reply — a question is the player's, not theirs. */
    const play = (url: string, mark: () => void, who: string | null) => {
      mark();
      speaking.current = true;
      setAnswering(who);
      setDucked('suspect-voice', true);
      void speak(url).then(() => {
        speaking.current = false;
        setAnswering(null);
        pump.current();
      });
    };

    /** Hold this exchange open a little longer, then come back and give up. */
    const hold = (key: string): boolean => {
      const since = waitingSince.current.get(key) ?? Date.now();
      waitingSince.current.set(key, since);
      const left = WAIT_FOR_MISSING_MS - (Date.now() - since);
      if (left <= 0) return false;
      timer.current = window.setTimeout(
        () => {
          pump.current();
        },
        Math.min(left, 1500),
      );
      return true;
    };

    for (const exchange of live.current) {
      if (!askedFor.current.has(exchange.id)) {
        if (exchange.askUrl !== undefined) {
          play(exchange.askUrl, () => askedFor.current.add(exchange.id), null);
          return;
        }
        // Wait for the question's recording — but only for this exchange, and
        // only for a while, or one failure stalls the whole act behind it.
        if (hold(`ask-${exchange.id}`)) return;
        askedFor.current.add(exchange.id);
      }

      if (!answered.current.has(exchange.id)) {
        if (exchange.voiceUrl !== undefined) {
          play(exchange.voiceUrl, () => answered.current.add(exchange.id), exchange.suspectId);
          return;
        }
        if (hold(exchange.id)) return;
        answered.current.add(exchange.id);
      }
    }

    setAnswering(null);
    setDucked('suspect-voice', false);
  };

  // Re-drive whenever a recording arrives, or the room joins, or muting changes.
  useEffect(() => {
    pump.current();
  }, [exchanges, enabled, isMuted]);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      stopSpeaking();
      setDucked('suspect-voice', false);
    },
    [],
  );

  return answering;
}
