import type { GameState } from '../engine/types.js';

/**
 * Deterministic behaviour counters per player (D9/D10).
 * The LLM may phrase these; it may never alter or invent them.
 * Every number is traceable to logged moves.
 */
export interface PlayerCounters {
  playerId: string;
  cluesTabled: number;
  /** Tabled within 3 minutes of receiving the act's deal — early sharer. */
  earlyTables: number;
  whispersSent: number;
  theoriesProposed: number;
  theoriesBacked: number;
  challengesRaised: number;
  questionsAsked: number;
  /** Distinct suspects this player questioned. */
  suspectsProbed: number;
  /** Changed their vote within a single commitment. */
  voteChanges: number;
  /** First player to table a clue proving the solution. */
  firstKeyTable: boolean;
}

const EARLY_MS = 3 * 60 * 1000;

export function computeCounters(state: GameState, provenBy: string[]): PlayerCounters[] {
  const proven = new Set(provenBy);
  const actStarts = new Map<number, number>();
  for (const entry of state.log) {
    if (!actStarts.has(entry.act)) actStarts.set(entry.act, entry.at);
  }
  const firstKey = state.board.filter((t) => proven.has(t.clueId)).sort((a, b) => a.at - b.at)[0];

  return state.players.map((p) => {
    const mine = state.log.filter((e) => e.move.playerId === p.id);
    const votesSeen = new Map<string, number>();
    for (const e of mine) {
      if (e.move.type === 'commit-vote')
        votesSeen.set(e.move.commitmentId, (votesSeen.get(e.move.commitmentId) ?? 0) + 1);
    }
    return {
      playerId: p.id,
      cluesTabled: mine.filter((e) => e.move.type === 'table').length,
      earlyTables: mine.filter(
        (e) => e.move.type === 'table' && e.at - (actStarts.get(e.act) ?? e.at) <= EARLY_MS,
      ).length,
      whispersSent: mine.filter((e) => e.move.type === 'whisper').length,
      theoriesProposed: mine.filter((e) => e.move.type === 'propose-theory').length,
      theoriesBacked: mine.filter((e) => e.move.type === 'back-theory').length,
      challengesRaised: mine.filter((e) => e.move.type === 'challenge-theory').length,
      questionsAsked: mine.filter((e) => e.move.type === 'ask-suspect').length,
      suspectsProbed: new Set(
        mine.flatMap((e) => (e.move.type === 'ask-suspect' ? [e.move.suspectId] : [])),
      ).size,
      voteChanges: [...votesSeen.values()].reduce((sum, n) => sum + Math.max(0, n - 1), 0),
      firstKeyTable: firstKey?.by === p.id,
    };
  });
}

/** The strength headline each player gets on the shared screen (D11). */
export type Strength =
  'investigator' | 'connector' | 'challenger' | 'driver' | 'quiet-catalyst' | 'organiser';

export function headlineStrength(c: PlayerCounters, team: PlayerCounters[]): Strength {
  const top = (pick: (x: PlayerCounters) => number) =>
    pick(c) > 0 && pick(c) >= Math.max(...team.map(pick));
  if (top((x) => x.challengesRaised)) return 'challenger';
  if (top((x) => x.questionsAsked + x.suspectsProbed)) return 'investigator';
  if (top((x) => x.theoriesProposed)) return 'driver';
  if (c.firstKeyTable || top((x) => x.whispersSent)) return 'quiet-catalyst';
  if (top((x) => x.cluesTabled + x.earlyTables)) return 'organiser';
  return 'connector';
}
