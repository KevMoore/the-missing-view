/**
 * PRD §6 asks for four categories. Three were covered by the strength headline;
 * decision making was not, though the game already had the data — three forced
 * commitments under incomplete information (D5).
 *
 * §6 and §12 both insist none of these is better than another, so every style
 * here has to be a way of being useful.
 */
import { describe, expect, it } from 'vitest';
import { computeDecisions, DECISION_LINE, DECISION_LABEL } from '../src/reveal/decisions.js';
import type { CommitmentRecord, GameState, LoggedMove } from '../src/engine/types.js';

const T0 = 1_700_000_000_000;
const vote = (playerId: string, commitmentId: string, at: number): LoggedMove =>
  ({
    act: 1,
    at,
    move: { type: 'commit-vote', playerId, commitmentId, choice: 'x' },
  }) as unknown as LoggedMove;

function game(commitments: CommitmentRecord[], log: LoggedMove[]): GameState {
  return {
    caseId: 'blackwood-hall',
    seed: 1,
    phase: 'reveal',
    act: 3,
    players: ['p1', 'p2', 'p3'].map((id) => ({ id, name: id, characterId: 'c', hand: [] })),
    board: [],
    accusationVotes: {},
    excused: [],
    motive: '',
    theories: [],
    questions: [],
    commitments,
    log,
  };
}

const read = (state: GameState, id: string) =>
  computeDecisions(state).find((d) => d.playerId === id)!;

describe('decision style', () => {
  it('never describes a style as a failing', () => {
    for (const [style, line] of Object.entries(DECISION_LINE)) {
      expect(DECISION_LABEL[style as keyof typeof DECISION_LABEL]).toBeTruthy();
      for (const word of ['failed', 'should have', 'too slow', 'weak', 'passive'])
        expect(line.toLowerCase(), style).not.toContain(word);
    }
  });

  it('calls changing your mind out, above everything else', () => {
    const state = game(
      [{ commitmentId: 'a1', votes: { p1: 'x', p2: 'y', p3: 'y' } }],
      [
        vote('p1', 'a1', T0),
        vote('p1', 'a1', T0 + 1000),
        vote('p2', 'a1', T0),
        vote('p3', 'a1', T0),
      ],
    );
    const r = read(state, 'p1');
    expect(r.style).toBe('revising');
    expect(r.changedMind).toBe(1);
  });

  it('recognises going against the room', () => {
    const state = game(
      [{ commitmentId: 'a1', votes: { p1: 'lonely', p2: 'y', p3: 'y' } }],
      [vote('p1', 'a1', T0 + 5000), vote('p2', 'a1', T0), vote('p3', 'a1', T0 + 1000)],
    );
    expect(read(state, 'p1').style).toBe('independent');
    expect(read(state, 'p1').wentAgainst).toBe(1);
  });

  it('recognises committing first and holding', () => {
    const state = game(
      [{ commitmentId: 'a1', votes: { p1: 'x', p2: 'x', p3: 'x' } }],
      [vote('p1', 'a1', T0), vote('p2', 'a1', T0 + 5000), vote('p3', 'a1', T0 + 9000)],
    );
    expect(read(state, 'p1').style).toBe('decisive');
  });

  it('recognises waiting for the room before choosing', () => {
    const state = game(
      [{ commitmentId: 'a1', votes: { p1: 'x', p2: 'x', p3: 'x' } }],
      [vote('p2', 'a1', T0), vote('p3', 'a1', T0 + 1000), vote('p1', 'a1', T0 + 9000)],
    );
    expect(read(state, 'p1').style).toBe('considered');
  });

  it('gives a read to someone who never voted, without calling it a fault', () => {
    const state = game([{ commitmentId: 'a1', votes: { p2: 'x' } }], [vote('p2', 'a1', T0)]);
    const r = read(state, 'p1');
    expect(r.votedIn).toBe(0);
    expect(DECISION_LINE[r.style]).toBeTruthy();
  });

  it('is deterministic', () => {
    const state = game(
      [{ commitmentId: 'a1', votes: { p1: 'x', p2: 'y', p3: 'y' } }],
      [vote('p1', 'a1', T0), vote('p2', 'a1', T0), vote('p3', 'a1', T0)],
    );
    expect(computeDecisions(state)).toEqual(computeDecisions(state));
  });
});
