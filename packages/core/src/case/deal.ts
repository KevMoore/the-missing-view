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
export function dealClues(
  pack: CasePack,
  playerCount: number,
  seed: number,
  act: 1 | 2 | 3 = 1,
  previous?: readonly (readonly string[])[],
): Deal {
  const pool = pack.clues.filter((c) => c.act === act);
  const rng = mulberry32(seed + act);
  const shuffled = shuffle(pool, rng);
  // Key clues first so they are placed before the filler competes for seats.
  shuffled.sort((a, b) => Number(b.key) - Number(a.key));

  if (playerCount < 1) throw new Error('playerCount must be at least 1');
  const hands: string[][] = Array.from({ length: playerCount }, () => []);
  const firstHand = hands[0];
  if (!firstHand) throw new Error('unreachable: hands is non-empty');
  const apart = new Map<string, Set<string>>();
  for (const [a, b] of pack.deal.neverSameHolder) {
    (apart.get(a) ?? apart.set(a, new Set()).get(a))?.add(b);
    (apart.get(b) ?? apart.set(b, new Set()).get(b))?.add(a);
  }

  // Seat order is shuffled per act, and is the tie-break below. Without it the
  // sort is stable on index, so the smallest hand is always the lowest-numbered
  // one and every key clue lands on seats 0, 1, 2 — at every seed, at every head
  // count, leaving everyone else holding nothing that bears on the answer.
  const seats = shuffle(
    Array.from({ length: playerCount }, (_, i) => i),
    mulberry32(seed * 31 + act),
  );
  const seatRank = new Map(seats.map((seat, rank) => [seat, rank]));

  const proven = new Set(pack.solution.provenBy);
  /** Does this seat already hold something that bears on the solution? */
  const holdsProof = (i: number): boolean =>
    (hands[i] ?? []).some((id) => proven.has(id)) ||
    (previous?.[i] ?? []).some((id) => proven.has(id));

  for (const clue of shuffled) {
    const banned = apart.get(clue.id);
    const candidates = hands
      .map((hand, i) => ({ hand, i }))
      .filter(({ hand }) => !banned || !hand.some((id) => banned.has(id)))
      .sort((x, y) => {
        // A probative clue goes to someone who has none yet, so the proof
        // reaches as many seats as there are probative clues to give.
        if (proven.has(clue.id)) {
          const d = Number(holdsProof(x.i)) - Number(holdsProof(y.i));
          if (d !== 0) return d;
        }
        return x.hand.length - y.hand.length || (seatRank.get(x.i) ?? 0) - (seatRank.get(y.i) ?? 0);
      });
    const target = candidates[0] ?? { hand: firstHand, i: 0 };
    target.hand.push(clue.id);
  }
  return { hands };
}

export function keyHolderCount(pack: CasePack, deal: Deal): number {
  const proven = new Set(pack.solution.provenBy);
  return deal.hands.filter((hand) => hand.some((id) => proven.has(id))).length;
}

/**
 * Cast the room from the character pool, reproducibly for a given seed.
 *
 * Assignment used to be by index, so a case with twenty characters always dealt
 * the first five to a table of five and the rest never appeared. Shuffling on
 * the game seed means a pool bigger than the table is worth having: the same
 * case casts differently every session, and the same seed replays exactly.
 */
export function castCharacters<T extends { botLean?: string }>(
  characters: readonly T[],
  playerCount: number,
  seed: number,
): T[] {
  if (characters.length === 0) return [];
  const pool = shuffle(characters, mulberry32(seed ^ 0x9e3779b9));

  // Spread the lenses. A shuffle alone leaves better than one table in six with
  // two perspectives or fewer between four people, which is a poor game — the
  // premise is that everyone sees it differently — and, when the table is bots,
  // a dull one to playtest against. Take the shuffled order, but prefer a
  // leaning nobody at the table has yet.
  const cast: T[] = [];
  const remaining = [...pool];
  const leans = new Set<string>();
  const leanOf = (c: T) => c.botLean ?? 'detail';

  while (cast.length < playerCount) {
    if (remaining.length === 0) {
      // Pool smaller than the table: repeat rather than leave anyone uncast.
      remaining.push(...pool);
      leans.clear();
    }
    const fresh = remaining.findIndex((c) => !leans.has(leanOf(c)));
    const [chosen] = remaining.splice(fresh >= 0 ? fresh : 0, 1);
    if (chosen === undefined) break;
    leans.add(leanOf(chosen));
    cast.push(chosen);
  }
  return cast;
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
