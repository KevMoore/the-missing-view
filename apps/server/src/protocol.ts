/**
 * WebSocket wire protocol. Server-authoritative (D20): clients send intents,
 * the server sends role-scoped views. The solution never appears in any view
 * before the reveal (D21).
 */
import type {
  Accusation,
  Move,
  Music,
  Phase,
  SuspectQuestion,
  TabledClue,
  Theory,
} from '@tmv/core';

export type { Music } from '@tmv/core';

// ---- client -> server ----

export type ClientMessage =
  | { type: 'join'; role: 'phone'; roomCode: string; name: string; playerId?: string }
  | { type: 'join'; role: 'screen' | 'console'; roomCode: string }
  | { type: 'create-room'; caseId: string }
  | { type: 'move'; move: Move }
  | { type: 'facilitator'; action: 'start' | 'open-commitment' | 'next-act' | 'trigger-reveal' }
  | { type: 'prologue'; playing: boolean }
  | {
      /**
       * The post-game questions (PRD §19). Kept to three taps and one optional
       * line: a room that has just finished will not fill in a survey, and the
       * one number that matters is lost entirely if we ask for six.
       */
      type: 'debrief';
      /** Did they know it was about the team before the reveal? */
      knewBefore: 'no' | 'suspected' | 'yes';
      /** Did it show them something about how the team works? */
      sawSomething: boolean;
      /** Would they play another? */
      wouldPlayAgain: boolean;
      /** "What will you do differently in your next team meeting?" — optional. */
      willChange?: string;
    }
  | { type: 'add-bot' }
  | { type: 'email-optin'; email: string };

// ---- server -> client views ----

export interface PublicSuspect {
  id: string;
  name: string;
  publicBio: string;
  portraitAsset?: string;
}

/** Everything the big screen may show. */
export interface ScreenView {
  type: 'screen-view';
  roomCode: string;
  phase: Phase;
  act: 1 | 2 | 3;
  actStartedAt?: number;
  actMinutes: number;
  caseTitle: string;
  synopsis: string;
  /** Backdrop for the current beat of the flow, resolved server-side. */
  sceneAsset?: string;
  /** The theme's tracks; the big screen is the room's only speaker. */
  music?: Music;
  victim?: { name: string; portraitAsset?: string };
  /**
   * The room's own cast. The portrait is here so the big screen can put a face
   * against a contribution — the paintings existed and only the phone that owned
   * one ever saw it.
   */
  players: { id: string; name: string; characterName: string; portraitAsset?: string }[];
  suspects: PublicSuspect[];
  board: (TabledClue & { title: string; text: string; byName: string; imageAsset?: string })[];
  theories: (Theory & { byName: string })[];
  questions: (SuspectQuestion & {
    byName: string;
    suspectName: string;
    /** The question, in the asker's own character voice. Plays before the reply. */
    askUrl?: string;
    /** Where to fetch this reply spoken aloud. Absent until the audio exists. */
    voiceUrl?: string;
  })[];
  /** The act's opening lines, and them narrated, for the break card. */
  actTitle?: string;
  actOpening?: string;
  actOpeningUrl?: string;
  /** What the house settled on last time it was asked. Absent before act 2. */
  lastDecision?: { prompt: string; choice: string; votes: number; of: number };
  commitmentPrompt?: string;
  commitmentOptions?: { id: string; label: string }[];
  accusation?: Accusation & { culpritName: string };
  /** Only present in phase 'reveal'. */
  reveal?: SharedReveal;
  /**
   * A pacing nudge, when an act is running out and the room has gone quiet
   * (D12). Names the clue but never who is holding it — the room asking "who
   * has that?" is the point, and exposing somebody is not.
   */
  nudge?: string;
  /** The narrated opening, while the facilitator is playing it. */
  prologue?: {
    videoAsset?: string;
    beats: {
      text: string;
      sceneAsset?: string;
      videoAsset?: string;
      holdMs?: number;
      voiceUrl?: string;
    }[];
  };
}

/** One player's private view. */
export interface PhoneView {
  type: 'phone-view';
  playerId: string;
  roomCode: string;
  phase: Phase;
  act: 1 | 2 | 3;
  character: { name: string; role: string; briefing: string; portraitAsset?: string };
  hand: { id: string; title: string; text: string; tabled: boolean; imageAsset?: string }[];
  players: { id: string; name: string }[];
  suspects: PublicSuspect[];
  theories: (Theory & { byName: string })[];
  commitment?: {
    id: string;
    prompt: string;
    options: { id: string; label: string }[];
    myChoice?: string;
  };
  canAccuse: boolean;
  /** Shown only to the player still holding the clue the house is missing. */
  nudge?: string;
  privateReveal?: PrivateReveal;
}

export interface ConsoleView {
  type: 'console-view';
  roomCode: string;
  phase: Phase;
  act: 1 | 2 | 3;
  actStartedAt?: number;
  actMinutes: number;
  players: { id: string; name: string; connected: boolean; moveCount: number; bot: boolean }[];
  boardCount: number;
  questionCount: number;
  accusationMade: boolean;
  /**
   * How the open commitment is filling up. A count, never who voted for what:
   * the facilitator is closing an act, not auditing the room (D11).
   */
  votesIn?: { voted: number; of: number };
  /** The art, the music and the QR code all live on /screen; the console nags until it is open. */
  screenConnected: boolean;
  /** True while the opening sequence is on the big screen. */
  prologuePlaying: boolean;
  /** False when the case ships no opening, so the console hides the control. */
  hasPrologue: boolean;
  /** Team shape only — never per-person profiles (D11). */
  teamReveal?: TeamShapeReveal;
}

export interface SharedReveal {
  solved: boolean;
  narrative: string;
  /** One named strength per player, with cited evidence. Nobody is exposed. */
  strengths: { playerId: string; name: string; strength: string; line: string }[];
  /** The team moments the room reached, credited by name. Celebratory only. */
  moments: { moment: string; label: string; byName: string; clueTitle: string; landed: boolean }[];
}

export interface PrivateReveal {
  /** How you decided, as opposed to what you contributed (PRD §6). */
  decision?: { label: string; line: string };
  headline: string;
  strength: string;
  /** Every line cites a real logged act (D10). */
  evidence: string[];
  quieterSide: string;
}

export interface TeamShapeReveal {
  shape: string;
  /**
   * How the session actually went, for the facilitator to talk through
   * (PRD §11, §14). Aggregate only — the debrief answers are counted, never
   * attributed, and the free text is unsigned (D11).
   */
  postMortem?: {
    solved: boolean;
    accused?: string;
    culprit: string;
    minutes: number;
    cluesTabled: number;
    cluesTotal: number;
    questionsAsked: number;
    theoriesProposed: number;
    challengesRaised: number;
    /** 0 when everyone contributed equally, 1 when one player did everything. */
    dominance: number;
  };
  missingViews: string[];
  debriefPrompts: string[];
  /**
   * Every authored moment and what became of it. Yours alone (D11): the room
   * sees what it reached, you also see what it never did and what it walked past.
   */
  moments: {
    moment: string;
    label: string;
    clueTitle: string;
    offered: boolean;
    landed: boolean;
    response?: string;
    absentNote?: string;
    /** No `byName`, and not by oversight: see D11. Who did what is on the big
     * screen, in front of the room. It does not also go in the facilitator's
     * private notes. */
  }[];
}

/** Sent to a console the moment it connects, so it can offer a choice. */
export interface CaseList {
  type: 'cases';
  cases: { id: string; title: string; setting: string; players: string; minutes: number }[];
}

export type ServerMessage =
  | CaseList
  | ScreenView
  | PhoneView
  | ConsoleView
  | { type: 'joined'; playerId: string; roomCode: string }
  | { type: 'room-created'; roomCode: string }
  | {
      type: 'suspect-answer';
      questionId: string;
      suspectId: string;
      answer: string;
      fromBank: boolean;
    }
  | { type: 'gm-nudge'; text: string }
  | { type: 'error'; message: string };
