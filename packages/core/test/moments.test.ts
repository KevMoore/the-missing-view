/**
 * The eight team moments were authored on every clue and gated by D17 from the
 * start, and nothing read them until now. These tests are what stops that
 * happening again.
 */
import { describe, expect, it } from 'vitest';
import { blackwoodHall as pack } from '../src/cases/blackwood-hall.js';
import { computeMoments, MOMENT_LABEL, MOMENT_ORDER } from '../src/reveal/moments.js';
import type { GameState, LoggedMove } from '../src/engine/types.js';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

function game(board: { clueId: string; by: string; at: number }[], log: LoggedMove[]): GameState {
  return {
    caseId: pack.id,
    seed: 1,
    phase: 'reveal',
    act: 3,
    accusationVotes: {},
    excused: [],
    motive: '',
    players: [
      { id: 'p1', name: 'Ana', characterId: 'pc-inspector', hand: [] },
      { id: 'p2', name: 'Ben', characterId: 'pc-journalist', hand: [] },
    ],
    board,
    theories: [],
    questions: [],
    commitments: [],
    log,
  };
}

const tabled = (clueId: string, by: string, at: number) => ({ clueId, by, at });
const move = (type: string, playerId: string, at: number): LoggedMove =>
  ({ act: 1, at, move: { type, playerId } }) as unknown as LoggedMove;

describe('the eight moments', () => {
  it('covers every moment the case authored', () => {
    const records = computeMoments(pack, game([], []));
    expect(records).toHaveLength(8);
    expect(records.map((r) => r.moment)).toEqual(MOMENT_ORDER);
    for (const r of records) expect(MOMENT_LABEL[r.moment]).toBeTruthy();
  });

  it('reports nothing offered when nothing reached the board', () => {
    const records = computeMoments(pack, game([], []));
    expect(records.every((r) => !r.offered && !r.landed)).toBe(true);
  });

  it('credits a moment to whoever tabled its clue', () => {
    const diary = pack.clues.find((c) => c.id === 'c-diary')!;
    const state = game([tabled('c-diary', 'p1', T0)], []);
    const record = computeMoments(pack, state).find((r) => r.moment === diary.moment)!;
    expect(record.offered).toBe(true);
    expect(record.byPlayerId).toBe('p1');
    expect(record.clueTitle).toBe(diary.title);
  });

  it('counts it as landed when someone else acts on it soon after', () => {
    const state = game([tabled('c-diary', 'p1', T0)], [move('propose-theory', 'p2', T0 + MIN)]);
    const r = computeMoments(pack, state).find((x) => x.offered)!;
    expect(r.landed).toBe(true);
    expect(r.response).toBe('a theory');
  });

  it('does not count the tabler reacting to their own clue', () => {
    const state = game([tabled('c-diary', 'p1', T0)], [move('propose-theory', 'p1', T0 + MIN)]);
    expect(computeMoments(pack, state).find((x) => x.offered)?.landed).toBe(false);
  });

  it('does not count a response that arrives far too late', () => {
    const state = game(
      [tabled('c-diary', 'p1', T0)],
      [move('propose-theory', 'p2', T0 + 20 * MIN)],
    );
    expect(computeMoments(pack, state).find((x) => x.offered)?.landed).toBe(false);
  });

  it('ignores the commitment vote, which everyone makes regardless', () => {
    const state = game([tabled('c-diary', 'p1', T0)], [move('commit-vote', 'p2', T0 + MIN)]);
    expect(computeMoments(pack, state).find((x) => x.offered)?.landed).toBe(false);
  });

  it('credits the first person to open a moment, not a later one', () => {
    // Two act-1 clues both carry 'detail'; the earlier tabling owns the record.
    const detail = pack.clues.filter((c) => c.moment === 'detail');
    expect(detail.length).toBeGreaterThan(1);
    const state = game(
      [tabled(detail[1]!.id, 'p2', T0 + 5 * MIN), tabled(detail[0]!.id, 'p1', T0)],
      [],
    );
    const r = computeMoments(pack, state).find((x) => x.moment === 'detail')!;
    expect(r.byPlayerId).toBe('p1');
    expect(r.clueTitle).toBe(detail[0]!.title);
  });

  it('is deterministic — the same board gives the same reading twice', () => {
    const state = game([tabled('c-diary', 'p1', T0)], [move('challenge-theory', 'p2', T0 + MIN)]);
    expect(computeMoments(pack, state)).toEqual(computeMoments(pack, state));
  });
});
