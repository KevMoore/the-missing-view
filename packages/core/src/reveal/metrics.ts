/**
 * What a finished game tells us about itself (PRD §19).
 *
 * Everything here is derived from the state at the reveal — no extra
 * instrumentation, no events fired during play, nothing that could slow a room
 * down. It is the same move stream the reveal is built from, counted for a
 * different reader.
 *
 * The success criteria in §18 are not "did they solve it". A room that got the
 * wrong culprit having reached seven of the eight moments had a better session
 * than one that guessed right in twenty minutes, and these numbers are chosen so
 * that shows up rather than hides.
 */
import type { CasePack } from '../case/types.js';
import type { GameState } from '../engine/types.js';
import { DELIBERATION } from '../engine/types.js';
import { computeMoments } from './moments.js';

export interface GameMetrics {
  caseId: string;
  players: number;
  /** Excludes AI players, so a solo playtest does not look like a full room. */
  humanPlayers: number;
  /** Wall-clock from the first logged move to the last, in minutes. */
  durationMinutes: number;
  reachedReveal: boolean;
  accused: boolean;
  solved: boolean;
  cluesTabled: number;
  cluesAvailable: number;
  questionsAsked: number;
  theoriesProposed: number;
  challengesRaised: number;
  whispersSent: number;
  /** Of the eight the case was built around. The headline team number. */
  momentsReached: number;
  momentsOffered: number;
  /** Offered and ignored — the failure a room cannot see in itself. */
  momentsPassedOver: number;
  /**
   * How lopsided participation was: 0 when everyone moved equally, 1 when one
   * person did everything. §12 says a team should not be able to win by having
   * one dominant player, so this is the number that says whether it happened.
   */
  dominance: number;
}

export function computeMetrics(
  pack: CasePack,
  state: GameState,
  botIds: ReadonlySet<string> = new Set(),
): GameMetrics {
  const moments = computeMoments(pack, state);
  const times = state.log.map((e) => e.at);
  // Investigation only. A unanimous accusation is up to eight moves inside a
  // few seconds, and counting them would tell the facilitator that whoever
  // tapped fastest dominated the room.
  const acted = state.log.filter((e) => !DELIBERATION.includes(e.move.type));
  const counts = state.players.map((p) => acted.filter((e) => e.move.playerId === p.id).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const type = (t: string) => state.log.filter((e) => e.move.type === t).length;

  return {
    caseId: pack.id,
    players: state.players.length,
    humanPlayers: state.players.filter((p) => !botIds.has(p.id)).length,
    durationMinutes:
      times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 60_000) : 0,
    reachedReveal: state.phase === 'reveal',
    accused: state.accusation !== undefined,
    solved: state.accusation?.correct ?? false,
    cluesTabled: state.board.length,
    cluesAvailable: pack.clues.length,
    questionsAsked: type('ask-suspect'),
    theoriesProposed: type('propose-theory'),
    challengesRaised: type('challenge-theory'),
    whispersSent: type('whisper'),
    momentsReached: moments.filter((m) => m.offered && m.landed).length,
    momentsOffered: moments.filter((m) => m.offered).length,
    momentsPassedOver: moments.filter((m) => m.offered && !m.landed).length,
    dominance: dominance(counts, total),
  };
}

/**
 * Normalised so that an even spread reads 0 and one person doing everything
 * reads 1, whatever the head count.
 */
function dominance(counts: number[], total: number): number {
  if (total === 0 || counts.length < 2) return 0;
  const share = Math.max(...counts) / total;
  const even = 1 / counts.length;
  return Math.round(((share - even) / (1 - even)) * 100) / 100;
}

/** One line for the server log, so a session is legible without a database. */
export function summariseMetrics(m: GameMetrics): string {
  return [
    `[metrics] ${m.caseId}`,
    `${String(m.humanPlayers)}/${String(m.players)} human`,
    `${String(m.durationMinutes)}min`,
    m.solved ? 'solved' : m.accused ? 'wrong' : 'no accusation',
    `moments ${String(m.momentsReached)}/8 reached`,
    m.momentsPassedOver > 0 ? `${String(m.momentsPassedOver)} passed over` : '',
    `board ${String(m.cluesTabled)}/${String(m.cluesAvailable)}`,
    `dominance ${m.dominance.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
