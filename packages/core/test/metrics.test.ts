/**
 * PRD §18: success is not "did they solve the murder". These numbers exist so a
 * room that got the culprit wrong having reached seven moments reads better
 * than one that guessed right in twenty minutes.
 */
import { describe, expect, it } from 'vitest';
import { blackwoodHall as pack } from '../src/cases/blackwood-hall.js';
import { computeMetrics, summariseMetrics } from '../src/reveal/metrics.js';
import type { GameState, LoggedMove } from '../src/engine/types.js';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

const move = (type: string, playerId: string, at: number): LoggedMove =>
  ({ act: 1, at, move: { type, playerId } }) as unknown as LoggedMove;

function game(over: Partial<GameState> = {}): GameState {
  return {
    caseId: pack.id,
    seed: 1,
    phase: 'reveal',
    act: 3,
    players: [
      { id: 'p1', name: 'Ana', characterId: 'pc-inspector', hand: [] },
      { id: 'p2', name: 'Ben', characterId: 'pc-journalist', hand: [] },
      { id: 'p3', name: 'Bot', characterId: 'pc-vicar', hand: [] },
    ],
    board: [],
    accusationVotes: {},
    excused: [],
    motive: '',
    theories: [],
    questions: [],
    commitments: [],
    log: [],
    ...over,
  };
}

describe('game metrics', () => {
  it('separates humans from bots, so a solo playtest is not a full room', () => {
    const m = computeMetrics(pack, game(), new Set(['p3']));
    expect(m.players).toBe(3);
    expect(m.humanPlayers).toBe(2);
  });

  it('measures duration from the move stream, not the clock', () => {
    const m = computeMetrics(
      pack,
      game({ log: [move('table', 'p1', T0), move('table', 'p2', T0 + 47 * MIN)] }),
    );
    expect(m.durationMinutes).toBe(47);
  });

  it('records a wrong accusation as played but not solved', () => {
    const m = computeMetrics(
      pack,
      game({
        accusation: {
          culpritId: 's-ashworth',
          motive: 'the blood',
          committedBy: ['p1'],
          at: T0,
          correct: false,
        },
      }),
    );
    expect(m.accused).toBe(true);
    expect(m.solved).toBe(false);
    expect(m.reachedReveal).toBe(true);
  });

  it('reads dominance as 0 when everyone moved equally', () => {
    const m = computeMetrics(
      pack,
      game({ log: [move('table', 'p1', T0), move('table', 'p2', T0), move('table', 'p3', T0)] }),
    );
    expect(m.dominance).toBe(0);
  });

  it('reads dominance as 1 when one player did everything (PRD §12)', () => {
    const m = computeMetrics(
      pack,
      game({ log: [move('table', 'p1', T0), move('table', 'p1', T0), move('table', 'p1', T0)] }),
    );
    expect(m.dominance).toBe(1);
  });

  it('counts the moments the room reached and the ones it walked past', () => {
    const state = game({
      board: [{ clueId: 'c-diary', by: 'p1', at: T0 }],
      log: [move('propose-theory', 'p2', T0 + MIN)],
    });
    const m = computeMetrics(pack, state);
    expect(m.momentsOffered).toBe(1);
    expect(m.momentsReached).toBe(1);
    expect(m.momentsPassedOver).toBe(0);
  });

  it('summarises a session in one readable line', () => {
    const line = summariseMetrics(computeMetrics(pack, game(), new Set(['p3'])));
    expect(line).toContain('[metrics]');
    expect(line).toContain('2/3 human');
    expect(line).toContain('no accusation');
    expect(line).toContain('moments 0/8 reached');
  });
});
