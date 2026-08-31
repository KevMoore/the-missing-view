import { describe, expect, it } from 'vitest';
import {
  IllegalMove,
  applyFacilitator,
  applyMove,
  computeCounters,
  createGame,
  headlineStrength,
  type GameState,
} from '../src/index.js';
import { testCase } from './fixtures.js';

const pack = testCase();
const roster = Array.from({ length: 5 }, (_, i) => ({
  id: `p${String(i + 1)}`,
  name: `P${String(i + 1)}`,
}));

function started(): GameState {
  return applyFacilitator(pack, createGame(pack, roster, 42), { type: 'start' }, 1000);
}

describe('createGame', () => {
  it('casts characters and deals hands', () => {
    const g = createGame(pack, roster, 42);
    expect(g.players).toHaveLength(5);
    expect(g.players.every((p) => p.hand.length > 0)).toBe(true);
    expect(g.phase).toBe('lobby');
  });

  it('rejects head counts outside 4..8', () => {
    expect(() => createGame(pack, roster.slice(0, 3), 1)).toThrow(IllegalMove);
  });
});

describe('moves', () => {
  it('tables a held clue onto the board, credited and timestamped', () => {
    const g = started();
    const clue = g.players[0]!.hand[0]!;
    const g2 = applyMove(pack, g, { type: 'table', playerId: 'p1', clueId: clue }, 2000);
    expect(g2.board).toEqual([{ clueId: clue, by: 'p1', at: 2000 }]);
    expect(g2.log).toHaveLength(1);
  });

  it('refuses to table a clue the player does not hold', () => {
    const g = started();
    const other = g.players[1]!.hand[0]!;
    expect(() =>
      applyMove(pack, g, { type: 'table', playerId: 'p1', clueId: other }, 2000),
    ).toThrow(IllegalMove);
  });

  it('whisper shares a clue with exactly one recipient', () => {
    const g = started();
    const clue = g.players[0]!.hand[0]!;
    const g2 = applyMove(
      pack,
      g,
      { type: 'whisper', playerId: 'p1', toPlayerId: 'p2', clueId: clue },
      2000,
    );
    expect(g2.players[1]!.hand).toContain(clue);
    expect(g2.players[2]!.hand).not.toContain(clue);
  });

  it('back and challenge are mutually exclusive per player', () => {
    let g = started();
    g = applyMove(
      pack,
      g,
      { type: 'propose-theory', playerId: 'p1', theoryId: 't1', text: 'Money' },
      2000,
    );
    g = applyMove(pack, g, { type: 'back-theory', playerId: 'p2', theoryId: 't1' }, 2100);
    g = applyMove(pack, g, { type: 'challenge-theory', playerId: 'p2', theoryId: 't1' }, 2200);
    expect(g.theories[0]!.challengers).toEqual(['p2']);
    expect(g.theories[0]!.backers).toEqual(['p1']);
  });

  it('commitment votes only while a commitment is open, and changes are logged', () => {
    let g = started();
    expect(() =>
      applyMove(
        pack,
        g,
        { type: 'commit-vote', playerId: 'p1', commitmentId: 'a1', choice: 's1' },
        3000,
      ),
    ).toThrow(IllegalMove);
    g = applyFacilitator(pack, g, { type: 'open-commitment' }, 3000);
    g = applyMove(
      pack,
      g,
      { type: 'commit-vote', playerId: 'p1', commitmentId: 'a1', choice: 's1' },
      3100,
    );
    g = applyMove(
      pack,
      g,
      { type: 'commit-vote', playerId: 'p1', commitmentId: 'a1', choice: 's2' },
      3200,
    );
    expect(g.commitments[0]!.votes.p1).toBe('s2');
  });

  it('acts advance 1 -> 2 -> 3 -> reveal, dealing later-act clues', () => {
    let g = started();
    g = applyFacilitator(pack, g, { type: 'open-commitment' }, 3000);
    g = applyFacilitator(pack, g, { type: 'next-act' }, 4000);
    expect(g.act).toBe(2);
    expect(g.phase).toBe('act');
    g = applyFacilitator(pack, g, { type: 'open-commitment' }, 5000);
    g = applyFacilitator(pack, g, { type: 'next-act' }, 6000);
    g = applyFacilitator(pack, g, { type: 'open-commitment' }, 7000);
    g = applyFacilitator(pack, g, { type: 'next-act' }, 8000);
    expect(g.phase).toBe('reveal');
  });

  it('accusation only lands in act 3 and records correctness', () => {
    let g = started();
    expect(() =>
      applyMove(pack, g, { type: 'accuse-commit', playerId: 'p1', culpritId: 's2' }, 3000),
    ).toThrow(IllegalMove);
    g = toActThree(g);
    g = applyMove(pack, g, { type: 'set-motive', playerId: 'p1', text: 'Money' }, 6900);
    g = commitAll(g, 's2', 7000);
    expect(g.accusation?.correct).toBe(true);
    expect(g.accusation?.motive).toBe('Money');
    expect(() =>
      applyMove(pack, g, { type: 'accuse-commit', playerId: 'p2', culpritId: 's1' }, 7100),
    ).toThrow(IllegalMove);
  });

  it('holds the accusation until the whole house agrees on one name', () => {
    let g = toActThree(started());
    // Four of five commit, and the fifth disagrees. No accusation either way:
    // a majority is a vote, and a vote lets a team accuse over somebody's head.
    for (const id of ['p1', 'p2', 'p3', 'p4'])
      g = applyMove(pack, g, { type: 'accuse-commit', playerId: id, culpritId: 's2' }, 7000);
    expect(g.accusation).toBeUndefined();
    g = applyMove(pack, g, { type: 'accuse-commit', playerId: 'p5', culpritId: 's1' }, 7010);
    expect(g.accusation).toBeUndefined();

    // The holdout changing their mind is what makes the house accuse.
    g = applyMove(pack, g, { type: 'accuse-commit', playerId: 'p5', culpritId: 's2' }, 7020);
    expect(g.accusation?.culpritId).toBe('s2');
    expect(g.accusation?.committedBy).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('lets a player withdraw before the house is unanimous', () => {
    let g = toActThree(started());
    for (const id of ['p1', 'p2', 'p3', 'p4'])
      g = applyMove(pack, g, { type: 'accuse-commit', playerId: id, culpritId: 's2' }, 7000);
    g = applyMove(pack, g, { type: 'accuse-withdraw', playerId: 'p2' }, 7010);
    expect(g.accusationVotes.p2).toBeUndefined();
    g = applyMove(pack, g, { type: 'accuse-commit', playerId: 'p5', culpritId: 's2' }, 7020);
    expect(g.accusation, 'a withdrawn commitment still counted').toBeUndefined();
  });

  it('does not wait on bots, which investigate but do not decide', () => {
    const withBot = createGame(
      pack,
      [
        { id: 'p1', name: 'A' },
        { id: 'p2', name: 'B' },
        { id: 'p3', name: 'C' },
        { id: 'p4', name: 'D', bot: true },
      ],
      42,
    );
    let g = toActThree(applyFacilitator(pack, withBot, { type: 'start' }, 1000));
    for (const id of ['p1', 'p2', 'p3'])
      g = applyMove(pack, g, { type: 'accuse-commit', playerId: id, culpritId: 's2' }, 7000);
    expect(g.accusation?.committedBy).toEqual(['p1', 'p2', 'p3']);
  });

  it('refuses a name that is not a suspect', () => {
    const g = toActThree(started());
    expect(() =>
      applyMove(pack, g, { type: 'accuse-commit', playerId: 'p1', culpritId: 'nobody' }, 7000),
    ).toThrow(IllegalMove);
  });
});

/** Run the clock forward to act 3, where an accusation is legal. */
function toActThree(start: GameState): GameState {
  let g = applyFacilitator(pack, start, { type: 'open-commitment' }, 3000);
  g = applyFacilitator(pack, g, { type: 'next-act' }, 4000);
  g = applyFacilitator(pack, g, { type: 'open-commitment' }, 5000);
  return applyFacilitator(pack, g, { type: 'next-act' }, 6000);
}

/** Every human commits to the same name, which is what an accusation is. */
function commitAll(start: GameState, culpritId: string, at: number): GameState {
  let g = start;
  for (const p of start.players.filter((x) => !x.bot))
    g = applyMove(pack, g, { type: 'accuse-commit', playerId: p.id, culpritId }, at);
  return g;
}

describe('reveal counters', () => {
  it('counts moves per player and finds the first key table', () => {
    let g = started();
    const keyClue = pack.solution.provenBy.find((id) => g.players[0]!.hand.includes(id));
    let expectFirstKey = false;
    if (keyClue) {
      g = applyMove(pack, g, { type: 'table', playerId: 'p1', clueId: keyClue }, 2000);
      expectFirstKey = true;
    }
    g = applyMove(
      pack,
      g,
      { type: 'ask-suspect', playerId: 'p2', questionId: 'q1', suspectId: 's1', text: 'Where?' },
      2500,
    );
    const counters = computeCounters(g, pack.solution.provenBy);
    const p2 = counters.find((c) => c.playerId === 'p2')!;
    expect(p2.questionsAsked).toBe(1);
    expect(p2.suspectsProbed).toBe(1);
    if (expectFirstKey) expect(counters.find((c) => c.playerId === 'p1')!.firstKeyTable).toBe(true);
  });

  it('every player receives a strength, never a judgement', () => {
    const g = started();
    const counters = computeCounters(g, pack.solution.provenBy);
    for (const c of counters) expect(headlineStrength(c, counters)).toBeTruthy();
  });
});
