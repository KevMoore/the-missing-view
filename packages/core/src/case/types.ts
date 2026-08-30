/**
 * The case pack: everything a published mystery contains.
 *
 * Design rules this schema enforces (see docs/decisions.md):
 * - D13: suspect prompts are built ONLY from `KnowledgeSheet`; the solution is a
 *   separate branch that must never reach an LLM context or a client before the reveal.
 * - D15: every suspect carries a pre-generated answer bank used as network fallback.
 * - D16: clues are a pool with ownership constraints, dealt at game start.
 * - D17: `validateCase` gates publication on solvability and fairness for 4..8 players.
 */

export interface CasePack {
  id: string;
  title: string;
  /** e.g. "A snowbound country house, winter 1926." */
  setting: string;
  /** Read aloud / shown on the big screen before Act 1. */
  synopsis: string;
  victim: Victim;
  suspects: Suspect[];
  /** Investigator personas dealt to players; at least 8 so any head count casts fully. */
  characters: PlayerCharacter[];
  clues: Clue[];
  acts: [Act, Act, Act];
  /**
   * Art direction and sound. Optional: a case with no theme still plays, the
   * screen simply stays plain.
   */
  theme?: Theme;
  deal: DealConstraints;
  solution: Solution;
}

/**
 * The look and sound of a case. A theme is deliberately coarser than a case:
 * the scenes and music of "a 1920s country house" suit any mystery set in one,
 * so a second case in the same theme reuses these and ships only its own cast.
 *
 * Asset convention, so a new theme is a folder rather than a code change:
 *   /art/<theme.id>/scene/*.jpg   backdrops, shared by every case in the theme
 *   /art/<case.id>/cast/*.jpg     portraits, specific to one case
 *   /music/<theme.id>/*.mp3       the theme's music
 */
export interface Theme {
  /** Stable id, and the asset folder name. */
  id: string;
  /** Human label for the authoring tool, e.g. "1920s country house". */
  name: string;
  scenes?: Scenes;
  music?: Music;
}

/**
 * Big-screen music. Played on the screen surface only — phones and the console
 * stay silent, or eight handsets play the same track a beat apart.
 */
export interface Music {
  /** Loops under the lobby. */
  menu?: string;
  /** Played in sequence through the acts, under the room's conversation. */
  inGame?: string[];
}

/**
 * Backdrop art for the big screen, one image per beat of the flow. Every field
 * is optional; the server falls back act -> lobby so a partially-arted theme
 * never blanks the stage mid-game.
 */
export interface Scenes {
  /** Before the game starts, behind the join code. */
  lobby?: string;
  /** One per act, behind the evidence board. */
  act1?: string;
  act2?: string;
  act3?: string;
  /** While the house votes on the act commitment. */
  commitment?: string;
  /** While the accusation stands. */
  accusation?: string;
  /** Behind the reveal. */
  reveal?: string;
}

export interface Victim {
  id: string;
  name: string;
  description: string;
  portraitAsset?: string;
  /** How the body is found — the opening image of the game. */
  discovery: string;
}

export interface Suspect {
  id: string;
  name: string;
  /** Shown on the big screen; safe for all players to see at any time. */
  publicBio: string;
  portraitAsset?: string;
  knowledge: KnowledgeSheet;
  /** Fallback answers served on LLM timeout or network loss (D15). */
  answerBank: BankedAnswer[];
  /** Voice/manner notes for the LLM: diction, class, tics. Never facts. */
  persona: string;
  /**
   * Which synthesised voice speaks this character aloud on the big screen. An
   * OpenAI speech voice — 'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable',
   * 'onyx', 'nova', 'sage', 'shimmer'. The `persona` above doubles as the
   * delivery instruction, so the manner is authored once. Omit for silence.
   */
  voice?: string;
}

/**
 * The ONLY material a suspect's LLM prompt may be built from (D13).
 * The culprit's own sheet contains a denial, never a confession.
 */
export interface KnowledgeSheet {
  /** True facts this character will share if asked well. */
  knows: string[];
  /** Things this character believes but that may be wrong. */
  believes: string[];
  /** True facts this character conceals unless confronted with evidence. */
  hides: string[];
  /** Direct lies this character tells, each paired with the trigger topic. */
  liesAbout: { topic: string; lie: string }[];
}

export interface BankedAnswer {
  /** Topic patterns matched against an incoming question (lowercased substrings). */
  topics: string[];
  answer: string;
}

export interface PlayerCharacter {
  id: string;
  name: string;
  /** e.g. "the visiting doctor" — a reason to be in the house and to investigate. */
  role: string;
  briefing: string;
  portraitAsset?: string;
  /**
   * How an AI player holding this character leans when it acts. Kept in the case
   * rather than the server so a new case brings its own personalities instead of
   * inheriting Blackwood Hall's. Unset behaves as 'detail'.
   */
  botLean?: BotLean;
}

/**
 * The five ways an AI player can be useful to a room. Each maps to a different
 * pressure on the human: evidence, narrative, doubt, precision, or agreement.
 */
export type BotLean =
  | 'interrogate' // puts questions to the suspects
  | 'theorise' // proposes readings of the evidence
  | 'challenge' // pushes back on other people's theories
  | 'detail' // gets clues onto the board
  | 'listen'; // backs what others say, and says little

export interface Clue {
  id: string;
  title: string;
  /** The text shown in a player's private dossier. */
  text: string;
  /** True if the solution cannot be reached without it. */
  key: boolean;
  /** Which team moment this clue is designed to trigger, if any. */
  moment?: TeamMoment;
  /** Act in which this clue is dealt (1-based). Act 1 clues arrive in the opening deal. */
  act: 1 | 2 | 3;
}

export type TeamMoment =
  | 'detail'
  | 'big-picture'
  | 'challenge'
  | 'leadership'
  | 'listening'
  | 'conflict'
  | 'synthesis'
  | 'decision';

export interface Act {
  number: 1 | 2 | 3;
  title: string;
  /** Suggested duration in minutes; the facilitator may extend (D4). */
  minutes: number;
  /** Narration shown/read at the top of the act. */
  opening: string;
  /** The forced team commitment closing the act (D5). */
  commitment: Commitment;
}

export interface Commitment {
  id: string;
  /** e.g. "Who is your prime suspect?" */
  prompt: string;
  /** 'suspect' renders the cast as options; 'theory' renders authored options. */
  kind: 'suspect' | 'theory';
  options?: { id: string; label: string }[];
}

export interface DealConstraints {
  /** Pairs of clue ids that must never be dealt to the same player. */
  neverSameHolder: [string, string][];
  /** Minimum distinct holders across the solution's key clues (D17: >= 3). */
  minKeyHolders: number;
}

/**
 * Quarantined branch: never serialised to clients before the reveal,
 * never included in any LLM suspect context (D13).
 */
export interface Solution {
  culpritId: string;
  motive: string;
  method: string;
  /** Clue ids that together establish the solution. */
  provenBy: string[];
  /** The full narrative read at the reveal. */
  narrative: string;
  /** Statements no suspect reply may ever contain; checked server-side before display. */
  forbiddenFacts: string[];
}
