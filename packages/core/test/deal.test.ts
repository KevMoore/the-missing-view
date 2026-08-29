import { describe, expect, it } from 'vitest';
import { dealClues, keyHolderCount } from '../src/index.js';
import { testCase } from './fixtures.js';

describe('dealClues', () => {
  const pack = testCase();

  it('deals every act-1 clue exactly once', () => {
    const deal = dealClues(pack, 6, 42);
    const dealt = deal.hands.flat().sort();
    const expected = pack.clues
      .filter((c) => c.act === 1)
      .map((c) => c.id)
      .sort();
    expect(dealt).toEqual(expected);
  });

  it('keeps hands balanced within one clue', () => {
    for (let n = 4; n <= 8; n++) {
      const sizes = dealClues(pack, n, 7).hands.map((h) => h.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it('never puts a neverSameHolder pair in one hand', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      for (const hand of dealClues(pack, 4, seed).hands) {
        expect(hand.includes('c1') && hand.includes('c2')).toBe(false);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    expect(dealClues(pack, 6, 99)).toEqual(dealClues(pack, 6, 99));
  });

  it('spreads key clues across at least minKeyHolders players', () => {
    for (let n = 4; n <= 8; n++) {
      const deal = dealClues(pack, n, 3);
      expect(keyHolderCount(pack, deal)).toBeGreaterThanOrEqual(pack.deal.minKeyHolders);
    }
  });
});
