/**
 * How a player decides, as opposed to what they contribute (PRD §6).
 *
 * The framework asks for four categories. Three were already covered by the
 * strength headline — information gathering, interaction, execution. Decision
 * making was not, and it was the one the game already had the data for and
 * threw away: three forced commitments under incomplete information (D5) is
 * about as clean a decision-making instrument as a game gets.
 *
 * Deliberately a *second* read rather than a replacement. §6 is explicit that
 * these are not good or bad, and §12 that nobody may be exposed as bad at
 * teamwork, so every style here is a way of being useful and the line each one
 * carries says so.
 */
import type { GameState } from '../engine/types.js';

export type DecisionStyle =
  /** Committed early and stayed committed. */
  | 'decisive'
  /** Changed their mind when the evidence moved. */
  | 'revising'
  /** Waited, watched the room, then chose. */
  | 'considered'
  /** Went where the room was not. */
  | 'independent'
  /** Moved toward what others had already backed. */
  | 'consensual';

export interface DecisionRead {
  playerId: string;
  style: DecisionStyle;
  /** How many of the three commitments they voted in at all. */
  votedIn: number;
  changedMind: number;
  /** Commitments where they were among the first half of the room to vote. */
  votedEarly: number;
  /** Commitments where their choice was the minority one. */
  wentAgainst: number;
}

export const DECISION_LABEL: Record<DecisionStyle, string> = {
  decisive: 'Decisive',
  revising: 'Open to being wrong',
  considered: 'Considered',
  independent: 'Independent-minded',
  consensual: 'Consensus-building',
};

/** Never a criticism. §6: different strengths are useful in different situations. */
export const DECISION_LINE: Record<DecisionStyle, string> = {
  decisive:
    'You committed early and held. Rooms stall without someone willing to be first, and be wrong.',
  revising:
    'You changed your mind when the evidence moved. That is the rarest thing in this list and the hardest to do out loud.',
  considered:
    'You waited, listened, and then chose. The room got a vote that had heard the others first.',
  independent:
    'You went where the room was not. A team that only ever agrees with itself finds nothing.',
  consensual:
    'You moved toward what the room was building. Somebody has to close the gap or nothing is ever decided.',
};

export function computeDecisions(state: GameState): DecisionRead[] {
  const voteTimes = new Map<string, { playerId: string; at: number }[]>();
  for (const e of state.log) {
    if (e.move.type !== 'commit-vote') continue;
    const list = voteTimes.get(e.move.commitmentId) ?? [];
    list.push({ playerId: e.move.playerId, at: e.at });
    voteTimes.set(e.move.commitmentId, list);
  }

  return state.players.map((p) => {
    let votedIn = 0;
    let changedMind = 0;
    let votedEarly = 0;
    let wentAgainst = 0;

    for (const commitment of state.commitments) {
      const choice = commitment.votes[p.id];
      if (choice === undefined) continue;
      votedIn++;

      // Repeated votes in one commitment are a mind changed in public.
      const mine = (voteTimes.get(commitment.commitmentId) ?? []).filter(
        (v) => v.playerId === p.id,
      );
      if (mine.length > 1) changedMind++;

      // First half of the room to put anything down.
      const order = (voteTimes.get(commitment.commitmentId) ?? [])
        .filter((v, i, a) => a.findIndex((x) => x.playerId === v.playerId) === i)
        .sort((a, b) => a.at - b.at);
      const rank = order.findIndex((v) => v.playerId === p.id);
      if (rank >= 0 && rank < Math.ceil(order.length / 2)) votedEarly++;

      // Minority of the votes actually cast in that commitment.
      const tally = Object.values(commitment.votes).filter((c) => c === choice).length;
      const most = Math.max(...Object.values(countBy(commitment.votes)));
      if (tally < most) wentAgainst++;
    }

    return {
      playerId: p.id,
      style: style(changedMind, votedEarly, wentAgainst, votedIn),
      votedIn,
      changedMind,
      votedEarly,
      wentAgainst,
    };
  });
}

/**
 * Ordered by how much each says. Changing your mind in public is the strongest
 * signal in the set and the one most worth naming, so it wins outright.
 */
function style(
  changedMind: number,
  votedEarly: number,
  wentAgainst: number,
  votedIn: number,
): DecisionStyle {
  if (changedMind > 0) return 'revising';
  if (wentAgainst > 0) return 'independent';
  if (votedIn > 0 && votedEarly === votedIn) return 'decisive';
  if (votedEarly === 0 && votedIn > 0) return 'considered';
  return 'consensual';
}

function countBy(votes: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const choice of Object.values(votes)) out[choice] = (out[choice] ?? 0) + 1;
  return out;
}
