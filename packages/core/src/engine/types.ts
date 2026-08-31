/** Runtime game state and the moves that mutate it. All timestamps are epoch ms. */

export type Phase = 'lobby' | 'act' | 'commitment' | 'reveal' | 'ended';

export interface Player {
  id: string;
  name: string;
  characterId: string;
  /**
   * An AI player. The engine used to know nothing about bots, and did not need
   * to; the collective accusation changed that. A bot investigates, but it does
   * not decide, so it is not counted in unanimity (D36).
   */
  bot?: boolean;
  /** Clue ids in this player's private dossier. */
  hand: string[];
}

/** A player about to be seated. `characterId` set means the facilitator chose. */
export interface Seat {
  id: string;
  name: string;
  bot?: boolean;
  characterId?: string;
}

export interface TabledClue {
  clueId: string;
  by: string;
  at: number;
}

export interface Theory {
  id: string;
  /** Free text, entered from a phone. */
  text: string;
  by: string;
  at: number;
  backers: string[];
  challengers: string[];
}

export interface SuspectQuestion {
  id: string;
  suspectId: string;
  by: string;
  text: string;
  at: number;
  answer?: string;
  answeredAt?: number;
  /** True when the answer came from the banked fallback (D15). */
  fromBank?: boolean;
}

export interface CommitmentRecord {
  commitmentId: string;
  /** playerId -> chosen option (suspect id or theory option id). */
  votes: Record<string, string>;
  closedAt?: number;
}

export interface Accusation {
  culpritId: string;
  motive: string;
  /**
   * Everyone who committed, sorted. Replaces `submittedBy`: recording whoever
   * happened to tap last would attribute a decision the whole team made to one
   * person, which is the opposite of what the mechanic is for.
   */
  committedBy: string[];
  at: number;
  correct: boolean;
}

export interface GameState {
  caseId: string;
  seed: number;
  phase: Phase;
  act: 1 | 2 | 3;
  actStartedAt?: number;
  players: Player[];
  board: TabledClue[];
  /** playerId -> the suspect they have committed to. Cleared on withdrawal. */
  accusationVotes: Record<string, string>;
  /** The motive the room agreed, written by anyone before it locks. */
  motive: string;
  theories: Theory[];
  questions: SuspectQuestion[];
  commitments: CommitmentRecord[];
  accusation?: Accusation;
  /** Append-only record of every move — the reveal's raw material (D9/D10). */
  log: LoggedMove[];
}

export type Move =
  | { type: 'table'; playerId: string; clueId: string }
  | { type: 'whisper'; playerId: string; toPlayerId: string; clueId: string }
  | { type: 'propose-theory'; playerId: string; theoryId: string; text: string }
  | { type: 'back-theory'; playerId: string; theoryId: string }
  | { type: 'challenge-theory'; playerId: string; theoryId: string }
  | { type: 'ask-suspect'; playerId: string; questionId: string; suspectId: string; text: string }
  | { type: 'commit-vote'; playerId: string; commitmentId: string; choice: string }
  /**
   * The accusation is the team's, so there is deliberately no move that makes
   * one. Each player commits to a name; the accusation exists only once every
   * player who can commit has committed to the SAME name (D8, D36).
   */
  | { type: 'accuse-commit'; playerId: string; culpritId: string }
  | { type: 'accuse-withdraw'; playerId: string }
  /** The motive the room agreed. Anyone may write it; it is not a vote. */
  | { type: 'set-motive'; playerId: string; text: string };

/**
 * Moves that are the room deciding rather than the room investigating.
 *
 * Excluded wherever activity is measured, because a unanimous accusation is up
 * to eight moves inside a few seconds: they would land inside the response
 * window of every act-3 clue and make every act-3 team moment "land" for free
 * (D29), and they would skew the dominance figure the facilitator reads.
 */
export const DELIBERATION: Move['type'][] = ['commit-vote', 'accuse-commit', 'accuse-withdraw'];

export type FacilitatorAction =
  | { type: 'start' }
  | { type: 'open-commitment' }
  | { type: 'next-act' }
  | { type: 'trigger-reveal' };

export interface LoggedMove {
  at: number;
  act: 1 | 2 | 3;
  move: Move;
}
