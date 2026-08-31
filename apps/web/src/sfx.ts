/**
 * Small sounds for things that happen on the big screen.
 *
 * Synthesised rather than downloaded. Four short noises do not justify four
 * network requests over venue wifi, they are trivially tuneable when one turns
 * out to be too loud in a real room, and there is nothing to lose or forget to
 * deploy. If they are ever replaced by recordings, only this file changes.
 *
 * They are deliberately *small*. The screen already has a score and up to two
 * speaking voices, and a fifth thing competing for the room's attention would
 * be the one to cut. Nothing here plays while somebody is talking: a clue
 * landing under a suspect's answer is worse than no sound at all.
 */

export type Sound =
  /** A clue reaches the evidence board. */
  | 'table'
  /** A theory is put to the room. */
  | 'theory'
  /** Somebody backs a theory. */
  | 'back'
  /** Somebody challenges one. */
  | 'challenge';

let ctx: AudioContext | null = null;
let muted = false;
let suppressed = false;

/** Quiet on purpose. This is punctuation, not a score. */
const MASTER = 0.16;

/**
 * Call inside a click handler, alongside the speech unlock. A browser will not
 * start an AudioContext without a gesture any more than it will play a file.
 */
export function unlockSfx(): void {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    void ctx.resume();
  } catch {
    // No Web Audio. The screen is no less playable for being silent.
    ctx = null;
  }
}

export function setSfxMuted(next: boolean): void {
  muted = next;
}

/** Held down while a voice is speaking, so nothing lands on top of a line. */
export function setSfxSuppressed(next: boolean): void {
  suppressed = next;
}

export function play(sound: Sound): void {
  if (!ctx || muted || suppressed) return;
  const now = ctx.currentTime;
  switch (sound) {
    // A card set down on baize: a low body, and a brief edge of paper.
    case 'table':
      thump(now, 96, 58, 0.55, 0.22);
      noise(now, 1800, 0.12, 0.05);
      break;
    // Softer and higher — something offered rather than something placed.
    case 'theory':
      thump(now, 150, 120, 0.32, 0.16);
      noise(now, 3200, 0.06, 0.035);
      break;
    // A small warm agreement. Two notes a fifth apart, which reads as assent.
    case 'back':
      bell(now, 523.25, 0.3, 0.34);
      bell(now + 0.05, 783.99, 0.22, 0.3);
      break;
    // Darker, and a semitone of grit in it. Doubt, not disaster.
    case 'challenge':
      bell(now, 349.23, 0.32, 0.4);
      bell(now + 0.04, 466.16, 0.24, 0.36);
      break;
  }
}

/** A pitched body that falls away — the weight of an object being put down. */
function thump(at: number, from: number, to: number, gain: number, seconds: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + seconds);
  amp.gain.setValueAtTime(gain * MASTER, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + seconds + 0.02);
}

/** A filtered tick of noise: the paper, the card edge, the physical part. */
function noise(at: number, hz: number, gain: number, seconds: number): void {
  if (!ctx) return;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = hz;
  band.Q.value = 1.2;
  const amp = ctx.createGain();
  amp.gain.value = gain * MASTER;
  src.connect(band).connect(amp).connect(ctx.destination);
  src.start(at);
}

/** A struck note with a long tail, for the two social sounds. */
function bell(at: number, hz: number, gain: number, seconds: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = hz;
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain * MASTER, at + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  osc.connect(amp).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + seconds + 0.02);
}
