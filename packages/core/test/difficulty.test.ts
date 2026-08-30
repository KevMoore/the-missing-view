/**
 * Structural guards on how the case actually plays, as opposed to whether it
 * merely validates. Both of these were real defects.
 */
import { describe, expect, it } from 'vitest';
import { blackwoodHall as pack } from '../src/cases/blackwood-hall.js';
import { dealClues } from '../src/case/deal.js';

const culprit = pack.suspects.find((s) => s.id === pack.solution.culpritId)!;
/** "Miss Evelyn Cross" -> the parts a clue would actually print. */
const namesCulprit = (text: string) =>
  culprit.name
    .split(' ')
    .filter((w) => w.length > 3 && w !== 'Miss')
    .some((w) => text.includes(w));

const fullDeal = (n: number, seed: number) => {
  let hands: string[][] = Array.from({ length: n }, () => []);
  for (const act of [1, 2, 3] as const) {
    const d = dealClues(pack, n, seed, act, hands);
    hands = hands.map((h, i) => [...h, ...(d.hands[i] ?? [])]);
  }
  return hands;
};

describe('the shape of the mystery', () => {
  it('never names the culprit in act 1', () => {
    const named = pack.clues.filter((c) => c.act === 1 && namesCulprit(c.text)).map((c) => c.id);
    expect(named, 'act 1 must build suspicion, not answer the question').toEqual([]);
  });

  it('points act 1 at someone other than the culprit', () => {
    const others = pack.suspects.filter((s) => s.id !== culprit.id);
    const act1 = pack.clues.filter((c) => c.act === 1);
    const misdirected = act1.filter((c) =>
      others.some((s) => s.name.split(' ').some((w) => w.length > 3 && c.text.includes(w))),
    );
    expect(misdirected.length).toBeGreaterThanOrEqual(3);
  });

  it('turns toward the culprit in act 2 and proves it in act 3', () => {
    for (const act of [2, 3] as const) {
      const naming = pack.clues.filter((c) => c.act === act && namesCulprit(c.text));
      expect(naming.length, `act ${String(act)} must name the culprit`).toBeGreaterThan(0);
    }
  });
});

describe('every player matters', () => {
  it('gives a probative clue to as many seats as there are probative clues', () => {
    const proven = new Set(pack.solution.provenBy);
    for (let n = 4; n <= 8; n++) {
      const want = Math.min(n, proven.size);
      for (let seed = 0; seed < 60; seed++) {
        const holders = fullDeal(n, seed).filter((h) => h.some((id) => proven.has(id))).length;
        expect(holders, `n=${String(n)} seed=${String(seed)}`).toBe(want);
      }
    }
  });

  it('does not always give the proof to the same seats', () => {
    const proven = new Set(pack.solution.provenBy);
    // With 8 players and 7 probative clues exactly one seat misses out; over
    // many games it must not be the same seat every time.
    const missed = new Set<number>();
    for (let seed = 0; seed < 80; seed++) {
      fullDeal(8, seed).forEach((h, i) => {
        if (!h.some((id) => proven.has(id))) missed.add(i);
      });
    }
    expect(missed.size, 'the same seat is always left out').toBeGreaterThan(4);
  });

  it('still never lets one player hold the whole solution', () => {
    for (let n = 4; n <= 8; n++)
      for (let seed = 0; seed < 60; seed++)
        for (const hand of fullDeal(n, seed))
          expect(pack.solution.provenBy.every((id) => hand.includes(id))).toBe(false);
  });
});

describe('the field narrows', () => {
  const clearedBy = (act: 1 | 2 | 3) => {
    const out = new Set<string>();
    for (const c of pack.clues.filter((x) => x.act <= act))
      for (const id of c.exonerates ?? []) out.add(id);
    return out;
  };

  it('rules nobody out in act 1', () => {
    expect([...clearedBy(1)], 'act 1 gathers; it does not eliminate').toEqual([]);
  });

  it('clears at least one suspect by the end of act 2', () => {
    expect(clearedBy(2).size).toBeGreaterThan(0);
  });

  it('leaves only the culprit by the end of act 3', () => {
    const left = pack.suspects.map((s) => s.id).filter((id) => !clearedBy(3).has(id));
    expect(left).toEqual([pack.solution.culpritId]);
  });

  it('is not provable before act 3', () => {
    const byId = new Map(pack.clues.map((c) => [c.id, c]));
    for (const upto of [1, 2] as const) {
      const out = new Set<string>();
      for (const id of pack.solution.provenBy) {
        const c = byId.get(id)!;
        if (c.act <= upto) for (const x of c.exonerates ?? []) out.add(x);
      }
      const left = pack.suspects.filter((s) => !out.has(s.id));
      expect(left.length, `provable by act ${String(upto)}`).toBeGreaterThan(1);
    }
  });
});
