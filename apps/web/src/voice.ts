/**
 * The suspects, out loud, on the big screen.
 *
 * Same rule as the score (D-music): the screen is the room's only speaker, so
 * this runs on that surface alone. Replies are spoken strictly in the order
 * they were answered — two suspects talking over each other is worse than
 * silence — and the score ducks underneath whoever is speaking.
 *
 * The written answer is already on the screen before any of this begins, so a
 * missing or refused voice costs the room nothing.
 */
import { useEffect, useRef } from 'react';
import { setDucked } from './music.js';
import { speak, stopSpeaking } from './speaker.js';

/** Autoplay is refused until the page has been gestured at; the stage-take covers us. */
export function useSuspectVoices(
  urls: readonly string[],
  enabled: boolean,
  isMuted: boolean,
): void {
  const played = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const speaking = useRef(false);

  // Muting the screen must silence a line already in flight, not just the score.
  useEffect(() => {
    if (isMuted) {
      stopSpeaking();
      queue.current = [];
      speaking.current = false;
      setDucked('suspect-voice', false);
    }
  }, [isMuted]);

  useEffect(() => {
    if (!enabled || isMuted) return;

    for (const url of urls) {
      if (played.current.has(url)) continue;
      played.current.add(url);
      queue.current.push(url);
    }

    const next = (): void => {
      const url = queue.current.shift();
      if (url === undefined) {
        speaking.current = false;
        setDucked('suspect-voice', false);
        return;
      }
      speaking.current = true;
      setDucked('suspect-voice', true);
      // Resolves on end, on failure, or immediately if audio was never
      // unlocked — a line that cannot play must not strand the queue behind it.
      void speak(url).then(next);
    };

    if (!speaking.current) next();
  }, [urls, enabled, isMuted]);

  useEffect(
    () => () => {
      stopSpeaking();
      setDucked('suspect-voice', false);
    },
    [],
  );
}
