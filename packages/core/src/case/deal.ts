import type { CasePack, Clue } from './types.js';

export interface Deal {
  /** playerIndex -> clue ids, for the players actually in the room. */
  hands: string[][];
}

/**
 * Deterministic deal of the act-1 clue pool to `playerCount` players (D16).
 *
 * `seed` makes the deal reproducible per game. Constraints:
 * - every player receives at least one key clue where possible;
 * - `neverSameHolder` pairs are kept apart;
 * - hands stay balanced (sizes differ by at most one).
 *
 * Later-act clues are dealt by the same routine when their act opens.
 */
export function dealClues(pack: CasePack, playerCount: number, seed: number, act: 1 | 2 | 3 = 1): Deal {
  const pool = pack.clues.filter((c) => c.act === act);
  const rng = mulberry32(seed + act);
  const shuffled = shuffle(pool, rng);
  // Key clues first so they spread across the most players.
  shuffled.sort((a, b) => Number(b.key) - Number(a.key));

  const hands: string[][] = Array.from({ length: playerCount }, () => []);
  const apart = new Map<string, Set<string>>();
  for (const [a, b] of pack.deal.neverSameHolder) {
    (apart.get(a) ?? apart.set(a, new Set()).get(a))?.add(b);
    (apart.get(b) ?? apart.set(b, new Set()).get(b))?.add(a);
  }

  for (const clue of shuffled) {
    const banned = apart.get(clue.id);
    const candidates = hands
      .map((hand, i) => ({ hand, i }))
      .filter(({ hand }) => !banned || !hand.some((id) => banned.has(id)))
      .sort((x, y) => x.hand.length - y.hand.length);
    const target = candidates[0] ?? { hand: hands[0] as string[], i: 0 };
    target.hand.push(clue.id);
  }
  return { hands };
}

export function keyHolderCount(pack: CasePack, deal: Deal): number {
  const proven = new Set(pack.solution.provenBy);
  return deal.hands.filter((hand) => hand.some((id) => proven.has(id))).length;
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Small, dependency-free seeded PRNG. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type { Clue };
