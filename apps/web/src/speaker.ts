/**
 * One audio element for every spoken line, unlocked at the moment the stage is
 * taken.
 *
 * iOS will not play audio from an element it has never seen a user gesture
 * touch, and it judges that per *element*, not per page. The score survived
 * because its element is built moments after the join click. The suspects did
 * not: a reply arrives twenty minutes later, `new Audio(url)` builds a fresh
 * element with no history, and Safari refuses it silently. On an iPad — the
 * most likely thing to be pointed at a room — the house went quiet.
 *
 * So there is exactly one speech element for the life of the page. It is played
 * once, silently, inside the click handler, which is what buys the permission.
 * Everything after that swaps `src` on the element Safari has already agreed to.
 *
 * The score keeps its own element: it has to keep playing underneath the
 * speech, and one element cannot do both.
 */

/** A valid, empty WAV. Playing it costs nothing and buys the permission. */
const SILENCE =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YQAAAAA=';

let el: HTMLAudioElement | null = null;
let unlocked = false;
/** Resolves whatever line is currently playing, so the queue cannot overlap. */
let finish: (() => void) | null = null;

/**
 * Call this synchronously inside a click or submit handler. Anywhere else and
 * it does nothing useful, because the permission is granted to the gesture.
 */
export function unlockSpeech(): void {
  if (el) return;
  const audio = new Audio();
  audio.preload = 'auto';
  audio.dataset.role = 'speech';
  audio.hidden = true;
  document.body.appendChild(audio);
  audio.addEventListener('ended', settle);
  audio.addEventListener('error', settle);
  el = audio;

  audio.src = SILENCE;
  audio.play().then(
    () => {
      unlocked = true;
    },
    () => {
      // Refused even here. The game plays on in writing, as it always could.
      unlocked = false;
    },
  );
}

function settle(): void {
  const done = finish;
  finish = null;
  done?.();
}

/** True when a line can actually be heard, for anything that wants to know. */
export function speechUnlocked(): boolean {
  return unlocked;
}

/**
 * Play one line and resolve when it ends — or immediately, if audio was never
 * unlocked. Callers wait on this to sequence, so it must always resolve.
 */
export function speak(url: string): Promise<void> {
  const audio = el;
  if (!audio) return Promise.resolve();
  return new Promise<void>((resolve) => {
    settle(); // whatever was playing is superseded
    finish = resolve;
    audio.src = url;
    audio.currentTime = 0;
    audio.play().catch(() => {
      settle();
    });
  });
}

/**
 * For a screen that resumed rather than being clicked into — a reload
 * mid-game, which this project already goes out of its way to survive. There
 * was no gesture to hang the permission on, so take the next one, whatever it
 * is. Nothing on the platform can do better than that; a page nobody has
 * touched cannot make a sound.
 */
export function armSpeechUnlock(): () => void {
  if (el) return () => undefined;
  const events = ['pointerdown', 'keydown', 'touchend'] as const;
  const once = () => {
    unlockSpeech();
    for (const e of events) document.removeEventListener(e, once);
  };
  for (const e of events) document.addEventListener(e, once, { once: true });
  return () => {
    for (const e of events) document.removeEventListener(e, once);
  };
}

/** Cut the current line short — muting, or leaving the surface. */
export function stopSpeaking(): void {
  el?.pause();
  settle();
}
