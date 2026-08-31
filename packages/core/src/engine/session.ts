/**
 * A session: one case, one facilitator, one or two houses playing it.
 *
 * The shape of this file is the whole design decision (D38). A house is not a
 * field inside a game and not a filter over one — **a house IS a GameState**.
 * Two houses playing head to head are two independent games of the same case,
 * run side by side, compared at the end.
 *
 * The alternative was a `teamId` on every player, and then a `teamId` on every
 * clue, board entry, theory, question, commitment and accusation, plus a filter
 * at every read. That change touches every line of the engine and every view,
 * and it can be got wrong quietly — one unfiltered read leaks the other house's
 * board and the competition is over. This way the leak is impossible to write:
 * there is nothing in a house's state that belongs to the other one.
 *
 * What the two houses share is the case pack — the same murder, the same
 * suspects, the same solution — and the facilitator's clock. What they do not
 * share is anything either house discovered.
 */
import { MAX_PLAYERS } from '../case/validate.js';
import type { CasePack } from '../case/types.js';
import { createGame } from './engine.js';
import type { GameState, Seat } from './types.js';

export type SessionMode = 'one-house' | 'two-houses';

export interface House {
  id: string;
  /** The facilitator names these, so they can be the real teams in the room. */
  name: string;
  game: GameState;
}

export interface SessionState {
  caseId: string;
  seed: number;
  mode: SessionMode;
  houses: House[];
}

/**
 * Two full houses. MIN_PLAYERS and MAX_PLAYERS are unchanged and still describe
 * one house: a house is a whole game, so what makes a game playable has not
 * moved. Only the room got bigger.
 */
export const MAX_SESSION_PLAYERS = MAX_PLAYERS * 2;

/**
 * A house's own seed, derived from the session's.
 *
 * Both houses must be dealt differently — dealing the same hands to both makes
 * the head-to-head a typing race rather than a comparison — but the session
 * must still replay exactly from one number. The constant is the mixing
 * multiplier from murmur3's finaliser; nothing about it is load-bearing beyond
 * scattering adjacent indices to unrelated seeds.
 */
export function houseSeed(seed: number, index: number): number {
  return (seed ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0;
}

/**
 * Open a session.
 *
 * Rosters are per house and are already final: assigning people to houses is
 * the facilitator's job and happens in the lobby, before this is called. Casting
 * runs house by house, each told what the earlier ones took, so no character is
 * played at both tables — two Lady Margarets in one room is confusing on the
 * big screen and worse in the debrief.
 */
export function createSession(
  pack: CasePack,
  mode: SessionMode,
  rosters: { name: string; players: Seat[] }[],
  seed: number,
): SessionState {
  if (rosters.length !== (mode === 'two-houses' ? 2 : 1))
    throw new Error(`${mode} needs ${mode === 'two-houses' ? '2' : '1'} rosters`);

  const taken: string[] = [];
  const houses = rosters.map((roster, i) => {
    const game = createGame(pack, roster.players, houseSeed(seed, i), taken);
    taken.push(...game.players.map((p) => p.characterId));
    return { id: `h${String(i + 1)}`, name: roster.name, game };
  });
  return { caseId: pack.id, seed, mode, houses };
}

/** How the two houses compare. Only ever shown after both have finished. */
export interface HouseResult {
  id: string;
  name: string;
  solved: boolean;
  culpritId?: string;
  /** Minutes from the first move to the accusation, or to the last move. */
  minutes: number;
  cluesTabled: number;
  theoriesProposed: number;
  questionsAsked: number;
}

export function compareHouses(session: SessionState): HouseResult[] {
  return session.houses.map((h) => {
    const times = h.game.log.map((e) => e.at);
    const end = h.game.accusation?.at ?? (times.length > 0 ? Math.max(...times) : 0);
    const start = times.length > 0 ? Math.min(...times) : 0;
    const count = (t: string) => h.game.log.filter((e) => e.move.type === t).length;
    return {
      id: h.id,
      name: h.name,
      solved: h.game.accusation?.correct ?? false,
      ...(h.game.accusation ? { culpritId: h.game.accusation.culpritId } : {}),
      minutes: times.length > 1 ? Math.round((end - start) / 60_000) : 0,
      cluesTabled: h.game.board.length,
      theoriesProposed: count('propose-theory'),
      questionsAsked: count('ask-suspect'),
    };
  });
}
