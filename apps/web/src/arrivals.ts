/**
 * What just changed on the big screen.
 *
 * The screen is handed a whole new view several times a second and re-renders
 * the lot, so "a clue has arrived" is not something it otherwise knows — every
 * card looks equally new every time. This compares each item's signature with
 * the one before and reports only what moved, which is what both the animation
 * and the sound need.
 *
 * The first sighting never counts. A screen that reloads mid-act receives a
 * full board at once, and lighting up twelve cards and playing twelve sounds
 * would announce nothing except that somebody had refreshed the page.
 */
import { useEffect, useRef, useState } from 'react';

/** How long a thing stays lit after it changes. */
const FLASH_MS = 1500;

export interface Arrivals {
  /** Ids whose signature changed since the previous view. */
  changed: ReadonlySet<string>;
  /** Ids seen for the very first time, which is a subset of `changed`. */
  arrived: ReadonlySet<string>;
}

/**
 * @param signatures id -> a string that changes when the item does. For a clue
 * that is just its id; for a theory it should fold in the backer and challenger
 * counts, so being backed reads as a change.
 * @param onChange fired once per changed id, for the sound. Not called on the
 * first sighting.
 */
export function useArrivals(
  signatures: Record<string, string>,
  /**
   * False until the screen has actually been handed a view. Without this the
   * baseline is taken from the empty render before the first message arrives,
   * so a screen joining a game already in progress announces the whole board
   * as though every clue had just been played.
   */
  ready: boolean,
  onChange?: (id: string, isNew: boolean) => void,
): Arrivals {
  const previous = useRef<Record<string, string> | null>(null);
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  const [arrived, setArrived] = useState<ReadonlySet<string>>(new Set());
  const notify = useRef(onChange);
  notify.current = onChange;

  // A stable key, so this runs when the contents move rather than every render.
  const key = Object.entries(signatures)
    .map(([id, sig]) => `${id}=${sig}`)
    .sort()
    .join('|');

  useEffect(() => {
    if (!ready) return;
    const before = previous.current;
    previous.current = signatures;
    if (before === null) return; // first sighting: the board as it already was

    const moved = Object.keys(signatures).filter((id) => signatures[id] !== before[id]);
    if (moved.length === 0) return;

    const fresh = moved.filter((id) => !(id in before));
    setChanged(new Set(moved));
    setArrived(new Set(fresh));
    for (const id of moved) notify.current?.(id, !(id in before));

    const timer = window.setTimeout(() => {
      setChanged(new Set());
      setArrived(new Set());
    }, FLASH_MS);
    return () => {
      window.clearTimeout(timer);
    };
    // `signatures` is a fresh object every render; `key` is its identity.
  }, [key, ready]);

  return { changed, arrived };
}
