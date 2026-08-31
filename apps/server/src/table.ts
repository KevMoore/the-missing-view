/**
 * One house: the game state of a single team, and everything that belongs only
 * to that team.
 *
 * A session may run one house or two (D38). Two houses play the same case at the
 * same time and are compared at the end, and the thing that makes the comparison
 * worth anything is that neither can see the other's work. That is guaranteed
 * here by construction rather than by filtering: a house owns its own state, its
 * own bots, its own interrogation history and its own reveal, and there is no
 * field in any of them that refers to the other house.
 *
 * What lives in `Room` instead is everything the two houses genuinely share —
 * the room code, the case, the sockets, the big screen, and the facilitator's
 * clock.
 */
import {
  applyFacilitator,
  applyMove,
  createGame,
  IllegalMove,
  type CasePack,
  type FacilitatorAction,
  type GameState,
  type Move,
  type Seat,
} from '@tmv/core';
import { BotDriver, type BotOptions } from './bots.js';
import { askSuspect, speakAnswer, speakQuestion } from './llm.js';
import { buildReveal, type RevealBundle } from './reveal.js';

/** The closing stretch of an act, where a stalled house is worth prompting. */
const NUDGE_WINDOW_MS = 5 * 60_000;
/** How long nothing may happen before the house counts as quiet. */
const NUDGE_SILENCE_MS = 90_000;

/** What a table needs from its Room. Narrow on purpose — easy to fake. */
export interface TableHost {
  /** A new seat in the lobby, in this house. Used by the bot driver. */
  seat: (name: string, houseId: string) => string;
  /** Something changed and the views are stale. */
  changed: () => void;
  /** Audio, keyed globally; the table prefixes its own keys. */
  putVoice: (key: string, audio: Buffer) => void;
  hasVoice: (key: string) => boolean;
}

export class Table {
  readonly id: string;
  name: string;
  state: GameState | null = null;
  reveal: RevealBundle | null = null;
  /** The clue this house is being nudged about, and who holds it. */
  nudge: { clueId: string; title: string; holder: string } | null = null;

  private readonly pack: CasePack;
  private readonly host: TableHost;
  private readonly bots: BotDriver;
  /**
   * What each suspect has already said, to this house.
   *
   * Deliberately per house. The two houses interrogate the same suspects, and
   * a shared history would mean one house's questions steering the answers the
   * other one gets — the clearest leak there is, and an unfair one, since the
   * house that asked first would never know it had helped.
   */
  private readonly qaHistory = new Map<string, { question: string; answer: string }[]>();
  /** Acts already nudged, so a house is prompted once rather than nagged. */
  private readonly nudged = new Set<number>();

  constructor(
    id: string,
    name: string,
    pack: CasePack,
    host: TableHost,
    botOptions: BotOptions = {},
  ) {
    this.id = id;
    this.name = name;
    this.pack = pack;
    this.host = host;
    this.bots = new BotDriver(
      {
        snapshot: () => ({ caseId: pack.id, state: this.state }),
        joinPlayer: (n) => host.seat(n, id),
        handleMove: (m) => this.handleMove(m),
      },
      pack,
      botOptions,
    );
  }

  // ---- bots ----

  addBot(): { id: string; name: string } {
    return this.bots.add();
  }

  isBot(playerId: string): boolean {
    return this.bots.has(playerId);
  }

  get botIds(): ReadonlySet<string> {
    return this.bots.ids;
  }

  get botCount(): number {
    return this.bots.count;
  }

  stopBots(): void {
    this.bots.stop();
  }

  async tickBots(): Promise<void> {
    await this.bots.tick();
  }

  // ---- flow ----

  /** Deal this house in. `reserved` is what the other house already took. */
  start(roster: Seat[], seed: number, reserved: readonly string[]): void {
    this.state = createGame(this.pack, roster, seed, reserved);
  }

  async facilitate(action: FacilitatorAction['type'], at: number): Promise<void> {
    if (!this.state) throw new IllegalMove('no players joined yet');
    this.state = applyFacilitator(this.pack, this.state, { type: action }, at);
    if (this.state.phase === 'reveal' && !this.reveal)
      this.reveal = await buildReveal(this.pack, this.state, this.bots.ids);
    this.nudge = null;
  }

  async handleMove(move: Move, at = Date.now()): Promise<void> {
    if (!this.state) throw new IllegalMove('game not started');
    this.state = applyMove(this.pack, this.state, move, at);
    if (this.nudge && this.state.board.some((t) => t.clueId === this.nudge?.clueId))
      this.nudge = null;
    this.host.changed();
    if (move.type === 'ask-suspect') await this.answerSuspect(move);
  }

  /**
   * Pacing (D12). In the closing minutes of an act, if nothing has happened for
   * a while, point the house at something one of them is still holding.
   *
   * Deterministic, and it never hands anything over: the clue is named, its
   * contents are not, and neither is the person holding it. A house that has to
   * ask "who has the grey thread?" is a house doing the thing the game is about.
   * Once per act — a second prompt is nagging, and nagging is not pacing.
   */
  considerNudge(now: number, actMinutes: (act: 1 | 2 | 3) => number): boolean {
    const s = this.state;
    if (s?.phase !== 'act' || this.nudged.has(s.act)) return false;
    const started = s.actStartedAt;
    if (started === undefined) return false;

    const left = started + actMinutes(s.act) * 60_000 - now;
    if (left > NUDGE_WINDOW_MS || left < 0) return false;

    // Quiet means quiet: a vote is not a contribution for this purpose.
    const lastMove = [...s.log].reverse().find((e) => e.move.type !== 'commit-vote')?.at;
    if (lastMove !== undefined && now - lastMove < NUDGE_SILENCE_MS) return false;

    // Something that actually matters, still in somebody's hand.
    const proven = new Set(this.pack.solution.provenBy);
    const onBoard = new Set(s.board.map((t) => t.clueId));
    for (const player of s.players) {
      const held = player.hand.find((id) => proven.has(id) && !onBoard.has(id));
      if (held === undefined) continue;
      const clue = this.pack.clues.find((c) => c.id === held);
      if (!clue) continue;
      this.nudged.add(s.act);
      this.nudge = { clueId: held, title: clue.title, holder: player.id };
      return true;
    }
    return false;
  }

  // ---- the suspects ----

  /**
   * Voice keys are namespaced by house, so two houses never fetch each other's
   * audio — they interrogate the same suspects and get different answers, and
   * question ids are only unique within a game.
   *
   * A path segment rather than a prefix: the house is part of the address, and
   * burying it in the id would leave `ask-` no longer at a readable position.
   */
  voiceKey(id: string): string {
    return `${this.id}/${id}`;
  }

  private async answerSuspect(move: Extract<Move, { type: 'ask-suspect' }>): Promise<void> {
    // Started first and not waited on: the question's words are known now, and
    // the house can be hearing them while the model writes the reply.
    void this.speakAsk(move.questionId, move.playerId, move.text);
    const history = this.qaHistory.get(move.suspectId) ?? [];
    const { answer, fromBank } = await askSuspect(
      this.pack,
      move.suspectId,
      move.text,
      history,
      this.describeAsker(move.playerId),
    );
    history.push({ question: move.text, answer });
    this.qaHistory.set(move.suspectId, history.slice(-10));
    if (this.state) {
      this.state = {
        ...this.state,
        questions: this.state.questions.map((q) =>
          q.id === move.questionId ? { ...q, answer, answeredAt: Date.now(), fromBank } : q,
        ),
      };
    }
    this.host.changed();
    // The written answer is already on the screen, so the voice is chased
    // separately: the house reads it while the speech is still being made.
    void this.speak(move.questionId, move.suspectId, answer);
  }

  /**
   * Who a suspect is talking to, in the suspect's own terms. The character's
   * vocal direction is used because it is the one field that states their sex
   * and age plainly, which is exactly what was being guessed at.
   */
  private describeAsker(playerId: string): string | undefined {
    const characterId = this.state?.players.find((p) => p.id === playerId)?.characterId;
    const c = this.pack.characters.find((x) => x.id === characterId);
    if (!c) return undefined;
    return [c.name, c.role, c.voiceDirection].filter(Boolean).join(' — ');
  }

  /** The asker's question, in the voice of the character they were dealt. */
  private async speakAsk(questionId: string, playerId: string, text: string): Promise<void> {
    const characterId = this.state?.players.find((p) => p.id === playerId)?.characterId;
    if (characterId === undefined) return;
    const audio = await speakQuestion(this.pack, characterId, text);
    if (!audio) return;
    this.host.putVoice(this.voiceKey(`ask-${questionId}`), audio);
    this.host.changed();
  }

  private async speak(questionId: string, suspectId: string, answer: string): Promise<void> {
    const audio = await speakAnswer(this.pack, suspectId, answer);
    if (!audio) return;
    this.host.putVoice(this.voiceKey(questionId), audio);
    this.host.changed();
  }
}
