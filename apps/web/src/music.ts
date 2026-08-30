/**
 * Big-screen music. The screen is the room's only speaker: phones and the
 * console stay silent, or eight handsets play the same track a beat apart.
 *
 * Browsers block autoplay until a user gesture, so `useMusic` only ever starts
 * once the screen has been taken (the join submit). Before that the element is
 * never constructed, and a blocked `play()` is swallowed — music is decoration,
 * it must never break the game.
 */
import { useEffect } from 'react';
import type { Music } from './ws.js';

/** In-game sits under the menu theme: the room is talking over it. */
const MENU_VOLUME = 0.55;
const IN_GAME_VOLUME = 0.3;
/** The opening carries the room on its own, so it sits above the lobby theme. */
const PROLOGUE_VOLUME = 0.62;
const FADE_MS = 1200;
/** The last beat lands, then the score goes with it rather than being cut. */
const PROLOGUE_OUT_MS = 3500;

export type MusicCue = 'menu' | 'prologue' | 'game' | null;

let el: HTMLAudioElement | null = null;
let cue: MusicCue = null;
let tracks: Music = {};
let track = 0;
let muted = false;
let ducked = false;
let fadeTimer: number | null = null;

/** How far the score drops while a suspect is speaking. */
const DUCK = 0.25;

function fadeTo(target: number, ms: number, done?: () => void): void {
  const node = el;
  if (!node) return;
  if (fadeTimer !== null) window.clearInterval(fadeTimer);
  const from = node.volume;
  const started = performance.now();
  fadeTimer = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - started) / ms);
    node.volume = Math.max(0, Math.min(1, from + (target - from) * t));
    if (t >= 1) {
      if (fadeTimer !== null) window.clearInterval(fadeTimer);
      fadeTimer = null;
      done?.();
    }
  }, 40);
}

function volumeFor(which: MusicCue): number {
  if (muted || which === null) return 0;
  const base =
    which === 'menu' ? MENU_VOLUME : which === 'prologue' ? PROLOGUE_VOLUME : IN_GAME_VOLUME;
  // The narration must sit on top of its own score, not fight it.
  return ducked ? base * DUCK : base;
}

/**
 * Drop the score under a speaking suspect and lift it again after. The screen
 * is the room's only speaker, so without this the music competes with the very
 * line everyone is straining to hear.
 */
export function setDucked(next: boolean): void {
  if (next === ducked) return;
  ducked = next;
  if (el && !el.paused) fadeTo(volumeFor(cue), next ? 350 : 900);
}

function load(): void {
  if (!el || cue === null) return;
  const inGame = tracks.inGame ?? [];
  const src =
    cue === 'menu'
      ? tracks.menu
      : cue === 'prologue'
        ? (tracks.prologue ?? tracks.menu)
        : inGame[track % (inGame.length || 1)];
  if (src === undefined) return; // this theme has no music for the current cue
  el.src = src;
  el.loop = cue === 'menu';
  el.volume = 0;
  el.play().then(
    () => {
      fadeTo(volumeFor(cue), FADE_MS);
    },
    () => {
      /* autoplay refused — the room simply plays without music */
    },
  );
}

/**
 * Fade the opening's score away over a few seconds rather than cutting it. Used
 * when the last beat lands, so the music ends with the story instead of being
 * chopped off by the next screen.
 */
export function fadeOutPrologue(): void {
  if (cue !== 'prologue' || !el) return;
  const node = el;
  fadeTo(0, PROLOGUE_OUT_MS, () => {
    node.pause();
  });
}

/** Advance through the in-game tracks; the menu theme loops on its own. */
function onEnded(): void {
  if (cue !== 'game') return;
  track += 1;
  load();
}

/**
 * The theme's tracks, from the screen view.
 *
 * The stage is taken before that view arrives, so the first `setCue` almost
 * always runs with no tracks at all and loads nothing — and it never runs
 * again, because the cue has not changed. Start the moment they turn up.
 */
export function setTracks(next: Music | undefined): void {
  tracks = next ?? {};
  if (cue !== null && el && !el.src) load();
}

export function setCue(next: MusicCue): void {
  if (next === cue) return;
  cue = next;
  if (next === null) {
    const node = el;
    if (node)
      fadeTo(0, 900, () => {
        node.pause();
      });
    return;
  }
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
    el.addEventListener('ended', onEnded);
    load();
    return;
  }
  if (el.paused) load();
  else fadeTo(0, 700, load);
}

export function setMuted(next: boolean): void {
  if (next === muted) return;
  muted = next;
  if (el && !el.paused) fadeTo(volumeFor(cue), 400);
}

/** Stops and releases the element. Exported for teardown and tests. */
export function stopMusic(): void {
  if (fadeTimer !== null) window.clearInterval(fadeTimer);
  fadeTimer = null;
  if (el) {
    el.removeEventListener('ended', onEnded);
    el.pause();
    el = null;
  }
  cue = null;
  track = 0;
}

export function useMusic(next: MusicCue, isMuted: boolean, themeMusic: Music | undefined): void {
  // The view is a fresh object every push, so key on the track list itself.
  const trackKey = `${themeMusic?.menu ?? ''}|${(themeMusic?.inGame ?? []).join(',')}`;
  useEffect(() => {
    setTracks(themeMusic);
  }, [trackKey]);
  useEffect(() => {
    setCue(next);
  }, [next]);
  useEffect(() => {
    setMuted(isMuted);
  }, [isMuted]);
  useEffect(() => stopMusic, []);
}
