/** Runtime game state and the moves that mutate it. All timestamps are epoch ms. */

export type Phase = 'lobby' | 'act' | 'commitment' | 'reveal' | 'ended';

export interface Player {
  id: string;
  name: string;
  characterId: string;
  /** Clue ids in this player's private dossier. */
  hand: string[];
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
  submittedBy: string;
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
  | { type: 'accuse'; playerId: string; culpritId: string; motive: string };

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
