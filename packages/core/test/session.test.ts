/**
 * Two houses playing one case.
 *
 * The point of the model is that a house is a whole GameState, so the test that
 * matters most is the negative one: nothing either house does can reach the
 * other. Everything else here is bookkeeping around that.
 */
import { describe, expect, it } from 'vitest';
import {
  applyFacilitator,
  applyMove,
  compareHouses,
  createSession,
  houseSeed,
  type Seat,
} from '../src/index.js';
import { testCase } from './fixtures.js';

const pack = testCase();
const seats = (prefix: string, n: number): Seat[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${String(i + 1)}`,
    name: `${prefix}${String(i + 1)}`,
  }));

const twoHouses = () =>
  createSession(
    pack,
    'two-houses',
    [
      { name: 'Sales', players: seats('a', 4) },
      { name: 'Support', players: seats('b', 4) },
    ],
    99,
  );

describe('createSession', () => {
  it('opens one house for the classic game', () => {
    const s = createSession(pack, 'one-house', [{ name: 'The House', players: seats('p', 5) }], 7);
    expect(s.houses).toHaveLength(1);
    expect(s.houses[0]!.game.players).toHaveLength(5);
  });

  it('refuses a roster count that does not match the mode', () => {
    expect(() =>
      createSession(pack, 'two-houses', [{ name: 'Only', players: seats('p', 4) }], 7),
    ).toThrow();
  });

  it('deals the two houses differently from one session seed', () => {
    const s = twoHouses();
    const hands = s.houses.map((h) => h.game.players.map((p) => p.hand.join(',')).join('|'));
    expect(hands[0], 'both houses were dealt the same hands').not.toEqual(hands[1]);
    expect(houseSeed(99, 0)).not.toBe(houseSeed(99, 1));
  });

  it('replays exactly from the same seed', () => {
    const a = twoHouses();
    const b = twoHouses();
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('never casts one character at both tables', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = createSession(
        pack,
        'two-houses',
        [
          { name: 'A', players: seats('a', 4) },
          { name: 'B', players: seats('b', 4) },
        ],
        seed,
      );
      const cast = s.houses.flatMap((h) => h.game.players.map((p) => p.characterId));
      expect(new Set(cast).size, `seed ${String(seed)} double-cast somebody`).toBe(cast.length);
    }
  });

  it('honours a character the facilitator assigned', () => {
    const chosen = pack.characters[3]!.id;
    const roster = seats('p', 4);
    roster[0] = { ...roster[0]!, characterId: chosen };
    const s = createSession(pack, 'one-house', [{ name: 'The House', players: roster }], 7);
    expect(s.houses[0]!.game.players[0]!.characterId).toBe(chosen);
    // And nobody else was handed the same one.
    const all = s.houses[0]!.game.players.map((p) => p.characterId);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('the houses are sealed off from each other', () => {
  it('keeps a tabled clue inside the house that tabled it', () => {
    const s = twoHouses();
    const [one, two] = s.houses;
    const started = applyFacilitator(pack, one!.game, { type: 'start' }, 1000);
    const player = started.players[0]!;
    const after = applyMove(
      pack,
      started,
      { type: 'table', playerId: player.id, clueId: player.hand[0]! },
      2000,
    );
    expect(after.board).toHaveLength(1);
    expect(two!.game.board).toHaveLength(0);
    // There is no shared structure to leak through in the first place.
    expect(one!.game).not.toBe(two!.game);
  });
});

describe('compareHouses', () => {
  it('reports each house on its own terms', () => {
    const s = twoHouses();
    const rows = compareHouses(s);
    expect(rows.map((r) => r.name)).toEqual(['Sales', 'Support']);
    expect(rows.every((r) => !r.solved)).toBe(true);
    expect(rows.every((r) => r.cluesTabled === 0)).toBe(true);
  });
});
