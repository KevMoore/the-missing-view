/**
 * One live game room: authoritative state, connected sockets, role-scoped views.
 * The server owns the rules (D20); clients only render and send intents.
 */
import { randomBytes, randomInt } from 'node:crypto';
import {
  computeMetrics,
  summariseMetrics,
  applyFacilitator,
  applyMove,
  createGame,
  IllegalMove,
  type CasePack,
  type FacilitatorAction,
  type GameState,
  type Move,
} from '@tmv/core';
import type { ConsoleView, PhoneView, ScreenView, ServerMessage } from './protocol.js';
import { buildReveal, type RevealBundle } from './reveal.js';
import { askSuspect, narrate, speakAnswer, speakQuestion } from './llm.js';
import { BotDriver, type BotOptions } from './bots.js';

/** The closing stretch of an act, where a stalled room is worth prompting. */
const NUDGE_WINDOW_MS = 5 * 60_000;
/** How long nothing may happen before the house counts as quiet. */
const NUDGE_SILENCE_MS = 90_000;

export interface Client {
  role: 'phone' | 'screen' | 'console';
  playerId?: string;
  send: (msg: ServerMessage) => void;
}

interface PendingPlayer {
  id: string;
  name: string;
  connected: boolean;
}

export class Room {
  readonly code: string;
  private readonly pack: CasePack;
  private state: GameState | null = null;
  private readonly lobby: PendingPlayer[] = [];
  private readonly clients = new Set<Client>();
  private reveal: RevealBundle | null = null;
  private readonly qaHistory = new Map<string, { question: string; answer: string }[]>();
  /** Spoken replies by question id. Capped: a long game must not grow without bound. */
  private readonly voices = new Map<string, Buffer>();
  /** True while the opening sequence is on the big screen. */
  private prologuePlaying = false;
  /** The clue the house is currently being nudged about, and who holds it. */
  private nudge: { clueId: string; title: string; holder: string } | null = null;
  /** Acts already nudged, so the room is prompted once rather than nagged. */
  private readonly nudged = new Set<number>();
  /** Narration generated once per room and reused if it is played again. */
  private narrationReady = false;
  /**
   * Random per room, so two games of the same case deal and cast differently.
   * Overridable only so tests can pin a table rather than hope for one — a
   * suite that depends on the draw is a suite that fails one run in two hundred.
   */
  private readonly seed: number;
  private readonly emails: { playerId: string; email: string }[] = [];
  private readonly bots: BotDriver;

  constructor(pack: CasePack, botOptions: BotOptions & { seed?: number } = {}) {
    this.seed = botOptions.seed ?? randomInt(1, 2 ** 31);
    this.pack = pack;
    this.code = randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars, unguessable enough for a room (D21)
    this.bots = new BotDriver(this, pack, botOptions);
  }

  /** Seat an AI player. They join the lobby and are dealt a character like anyone. */
  addBot(): { id: string; name: string } {
    return this.bots.add();
  }

  isBot(playerId: string): boolean {
    return this.bots.has(playerId);
  }

  get botCount(): number {
    return this.bots.count;
  }

  /** Called when the room is torn down, so an abandoned room stops ticking. */
  stopBots(): void {
    this.bots.stop();
  }

  /** Drives one round of bot behaviour. Exposed so tests need no wall clock. */
  async tickBots(): Promise<void> {
    await this.bots.tick();
  }

  /**
   * Pacing (D12). In the closing minutes of an act, if nothing has happened for
   * a while, point the room at something one of them is still holding.
   *
   * Deterministic, and it never hands anything over: the clue is named, its
   * contents are not, and neither is the person holding it. A room that has to
   * ask "who has the grey thread?" is a room doing the thing the game is about.
   * Once per act — a second prompt is nagging, and nagging is not pacing.
   */
  considerNudge(now = Date.now()): void {
    const s = this.state;
    if (s?.phase !== 'act' || this.nudged.has(s.act)) return;
    const started = s.actStartedAt;
    if (started === undefined) return;

    const ends = started + this.actDef(s.act).minutes * 60_000;
    const left = ends - now;
    if (left > NUDGE_WINDOW_MS || left < 0) return;

    // Quiet means quiet: a vote is not a contribution for this purpose.
    const lastMove = [...s.log].reverse().find((e) => e.move.type !== 'commit-vote')?.at;
    if (lastMove !== undefined && now - lastMove < NUDGE_SILENCE_MS) return;

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
      this.pushViews();
      return;
    }
  }

  // ---- membership ----

  addClient(client: Client): void {
    this.clients.add(client);
    this.pushViews();
  }

  removeClient(client: Client): void {
    this.clients.delete(client);
    const player = this.lobby.find((p) => p.id === client.playerId);
    if (player) player.connected = false;
    this.pushViews();
  }

  /** Join (or reconnect) a player. Returns their stable id. */
  joinPlayer(name: string, existingId?: string): string {
    const existing = this.lobby.find((p) => p.id === existingId);
    if (existing) {
      existing.connected = true;
      return existing.id;
    }
    if (this.state) throw new IllegalMove('game already started');
    if (this.lobby.length >= 8) throw new IllegalMove('room is full');
    const id = `p-${randomBytes(4).toString('hex')}`;
    this.lobby.push({ id, name, connected: true });
    return id;
  }

  recordEmail(playerId: string, email: string): void {
    this.emails.push({ playerId, email });
  }

  get emailOptIns(): readonly { playerId: string; email: string }[] {
    return this.emails;
  }

  // ---- game flow ----

  async facilitate(action: FacilitatorAction['type']): Promise<void> {
    if (action === 'start' && !this.state) {
      this.state = createGame(this.pack, this.lobby, this.seed);
    }
    if (!this.state) throw new IllegalMove('no players joined yet');
    this.state = applyFacilitator(this.pack, this.state, { type: action }, Date.now());
    if (this.state.phase === 'reveal' && !this.reveal) {
      this.reveal = await buildReveal(this.pack, this.state);
    }
    this.nudge = null;
    this.pushViews();
    // Not awaited: the act begins now, and the voice catches up with the card.
    if (this.state.phase === 'act') void this.narrateAct(this.state.act);
  }

  /**
   * `at` is overridable for the same reason `seed` is: pacing is a function of
   * time, and a test that cannot say when something happened cannot test it.
   */
  async handleMove(move: Move, at = Date.now()): Promise<void> {
    if (!this.state) throw new IllegalMove('game not started');
    this.state = applyMove(this.pack, this.state, move, at);
    if (this.nudge && this.state.board.some((t) => t.clueId === this.nudge?.clueId))
      this.nudge = null;
    this.pushViews();
    if (move.type === 'ask-suspect') await this.answerSuspect(move);
    if (this.state.accusation && this.state.phase !== 'reveal') {
      // Accusation lands -> facilitator will trigger the reveal; nothing automatic.
    }
  }

  private async answerSuspect(move: Extract<Move, { type: 'ask-suspect' }>): Promise<void> {
    // Started first and not waited on: the question's words are known now, and
    // the room can be hearing them while the model writes the reply.
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
    this.broadcast({
      type: 'suspect-answer',
      questionId: move.questionId,
      suspectId: move.suspectId,
      answer,
      fromBank,
    });
    this.pushViews();
    // The written answer is already on the screen, so the voice is chased
    // separately: the room reads it while the speech is still being made.
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
    this.voices.set(`ask-${questionId}`, audio);
    this.pushViews();
  }

  private async speak(questionId: string, suspectId: string, answer: string): Promise<void> {
    const audio = await speakAnswer(this.pack, suspectId, answer);
    if (!audio) return;
    this.voices.set(questionId, audio);
    for (const [oldest] of this.voices) {
      if (this.voices.size <= 20) break;
      // Narration is made once and may be replayed; only answers age out.
      if (oldest.startsWith('prologue-')) continue;
      this.voices.delete(oldest);
    }
    this.pushViews();
  }

  /**
   * Start or stop the narrated opening. The narration is made once and kept, so
   * a facilitator who plays it twice — a latecomer, a false start — waits only
   * the first time. The screen is handed the beats and does the rest.
   */
  /**
   * The act's opening lines, spoken. Made once when the act begins, so the
   * break card has a voice by the time the room is looking at it.
   */
  private async narrateAct(act: 1 | 2 | 3): Promise<void> {
    const key = `act-${String(act)}`;
    if (this.voices.has(key)) return;
    const audio = await narrate(this.pack, this.actDef(act).opening);
    if (!audio) return;
    this.voices.set(key, audio);
    this.pushViews();
  }

  async setPrologue(playing: boolean): Promise<void> {
    const prologue = this.pack.prologue;
    if (!prologue?.beats.length) return;
    this.prologuePlaying = playing;
    this.pushViews();
    if (!playing || this.narrationReady) return;
    this.narrationReady = true;
    // Sequential, not parallel: the screen plays them in order anyway, and the
    // first beat should start while the last is still being made.
    for (const [i, beat] of prologue.beats.entries()) {
      const audio = await narrate(this.pack, beat.text);
      if (!audio) continue;
      this.voices.set(`prologue-${String(i)}`, audio);
      this.pushViews();
    }
  }

  /** The mp3 for one answer, for the HTTP route the big screen fetches. */
  voice(questionId: string): Buffer | undefined {
    return this.voices.get(questionId);
  }

  // ---- views ----

  broadcast(msg: ServerMessage): void {
    for (const c of this.clients) c.send(msg);
  }

  pushViews(): void {
    for (const c of this.clients) {
      if (c.role === 'screen') c.send(this.screenView());
      else if (c.role === 'console') c.send(this.consoleView());
      else if (c.playerId) {
        const view = this.phoneView(c.playerId);
        if (view) c.send(view);
      }
    }
  }

  private actDef(actNumber: 1 | 2 | 3) {
    const def = this.pack.acts[actNumber - 1];
    if (!def) throw new IllegalMove(`no act ${String(actNumber)}`);
    return def;
  }

  /**
   * The backdrop for the current beat of the flow (D20: the server decides,
   * the screen only renders what it is handed). Falls back act -> lobby so a
   * partially-arted case never shows a blank stage mid-game.
   */
  private sceneAsset(): string | undefined {
    const scenes = this.pack.theme?.scenes;
    if (!scenes) return undefined;
    const s = this.state;
    const phase = s?.phase ?? 'lobby';
    if (phase === 'lobby') return scenes.lobby;
    if (phase === 'reveal') return scenes.reveal ?? scenes.act3;
    const forAct = [scenes.act1, scenes.act2, scenes.act3][(s?.act ?? 1) - 1];
    if (s?.accusation) return scenes.accusation ?? forAct;
    if (phase === 'commitment') return scenes.commitment ?? forAct;
    return forAct ?? scenes.lobby;
  }

  private names(): Map<string, string> {
    const m = new Map(this.lobby.map((p) => [p.id, p.name]));
    return m;
  }

  screenView(): ScreenView {
    const s = this.state;
    const names = this.names();
    const clueById = new Map(this.pack.clues.map((c) => [c.id, c]));
    const suspectName = (id: string) => this.pack.suspects.find((x) => x.id === id)?.name ?? id;
    const act = this.actDef(s?.act ?? 1);
    const scene = this.sceneAsset();
    return {
      type: 'screen-view',
      roomCode: this.code,
      phase: s?.phase ?? 'lobby',
      act: s?.act ?? 1,
      ...(s?.actStartedAt !== undefined ? { actStartedAt: s.actStartedAt } : {}),
      actMinutes: act.minutes,
      caseTitle: this.pack.title,
      synopsis: this.pack.synopsis,
      ...(scene ? { sceneAsset: scene } : {}),
      ...(this.pack.theme?.music ? { music: this.pack.theme.music } : {}),
      victim: {
        name: this.pack.victim.name,
        ...(this.pack.victim.portraitAsset
          ? { portraitAsset: this.pack.victim.portraitAsset }
          : {}),
      },
      players: (s?.players ?? [])
        .map((p) => {
          const character = this.pack.characters.find((c) => c.id === p.characterId);
          return {
            id: p.id,
            name: names.get(p.id) ?? p.id,
            characterName: character?.name ?? '',
            ...(character?.portraitAsset ? { portraitAsset: character.portraitAsset } : {}),
          };
        })
        .concat(s ? [] : this.lobby.map((p) => ({ id: p.id, name: p.name, characterName: '' }))),
      suspects: this.pack.suspects.map(({ id, name, publicBio, portraitAsset }) => ({
        id,
        name,
        publicBio,
        ...(portraitAsset ? { portraitAsset } : {}),
      })),
      board: (s?.board ?? []).map((t) => {
        const clue = clueById.get(t.clueId);
        return {
          ...t,
          title: clue?.title ?? '',
          text: clue?.text ?? '',
          byName: names.get(t.by) ?? t.by,
        };
      }),
      theories: (s?.theories ?? []).map((t) => ({ ...t, byName: names.get(t.by) ?? t.by })),
      questions: (s?.questions ?? []).slice(-12).map((q) => ({
        ...q,
        byName: names.get(q.by) ?? q.by,
        suspectName: suspectName(q.suspectId),
        ...(this.voices.has(`ask-${q.id}`)
          ? { askUrl: `/voice/${this.code}/ask-${q.id}.mp3` }
          : {}),
        ...(this.voices.has(q.id) ? { voiceUrl: `/voice/${this.code}/${q.id}.mp3` } : {}),
      })),
      ...(this.prologuePlaying && this.pack.prologue
        ? {
            prologue: {
              ...(this.pack.prologue.videoAsset
                ? { videoAsset: this.pack.prologue.videoAsset }
                : {}),
              beats: this.pack.prologue.beats.map((b, i) => ({
                ...b,
                ...(this.voices.has(`prologue-${String(i)}`)
                  ? { voiceUrl: `/voice/${this.code}/prologue-${String(i)}.mp3` }
                  : {}),
              })),
            },
          }
        : {}),
      ...(s ? { actTitle: act.title, actOpening: act.opening } : {}),
      ...(s && this.voices.has(`act-${String(s.act)}`)
        ? { actOpeningUrl: `/voice/${this.code}/act-${String(s.act)}.mp3` }
        : {}),
      ...(s ? this.lastDecision(s) : {}),
      ...(this.nudge
        ? {
            nudge: `The house has gone quiet. Somebody here is still holding “${this.nudge.title}”.`,
          }
        : {}),
      ...(s?.phase === 'commitment'
        ? {
            commitmentPrompt: act.commitment.prompt,
            commitmentOptions:
              act.commitment.kind === 'suspect'
                ? this.pack.suspects.map((x) => ({ id: x.id, label: x.name }))
                : (act.commitment.options ?? []),
          }
        : {}),
      ...(s?.accusation
        ? { accusation: { ...s.accusation, culpritName: suspectName(s.accusation.culpritId) } }
        : {}),
      ...(s?.phase === 'reveal' && this.reveal ? { reveal: this.reveal.shared } : {}),
    };
  }

  phoneView(playerId: string): PhoneView | null {
    const s = this.state;
    const names = this.names();
    const clueById = new Map(this.pack.clues.map((c) => [c.id, c]));
    const player = s?.players.find((p) => p.id === playerId);
    const character = player
      ? this.pack.characters.find((c) => c.id === player.characterId)
      : undefined;
    const act = this.actDef(s?.act ?? 1);
    const tabled = new Set((s?.board ?? []).map((t) => t.clueId));
    const commitment = s?.commitments.at(-1);
    return {
      type: 'phone-view',
      playerId,
      roomCode: this.code,
      phase: s?.phase ?? 'lobby',
      act: s?.act ?? 1,
      character: {
        name: character?.name ?? names.get(playerId) ?? '',
        role: character?.role ?? '',
        briefing: character?.briefing ?? 'Waiting for the facilitator to begin…',
        ...(character?.portraitAsset ? { portraitAsset: character.portraitAsset } : {}),
      },
      hand: (player?.hand ?? []).map((id) => {
        const clue = clueById.get(id);
        return { id, title: clue?.title ?? '', text: clue?.text ?? '', tabled: tabled.has(id) };
      }),
      players: this.lobby.filter((p) => p.id !== playerId).map((p) => ({ id: p.id, name: p.name })),
      suspects: this.pack.suspects.map(({ id, name, publicBio, portraitAsset }) => ({
        id,
        name,
        publicBio,
        ...(portraitAsset ? { portraitAsset } : {}),
      })),
      theories: (s?.theories ?? []).map((t) => ({ ...t, byName: names.get(t.by) ?? t.by })),
      ...(s?.phase === 'commitment' && commitment && !commitment.closedAt
        ? {
            commitment: {
              id: commitment.commitmentId,
              prompt: act.commitment.prompt,
              options:
                act.commitment.kind === 'suspect'
                  ? this.pack.suspects.map((x) => ({ id: x.id, label: x.name }))
                  : (act.commitment.options ?? []),
              ...(commitment.votes[playerId] ? { myChoice: commitment.votes[playerId] } : {}),
            },
          }
        : {}),
      ...(this.nudge?.holder === playerId
        ? {
            nudge: `You are still holding “${this.nudge.title}”. The house has gone quiet — this may be the moment.`,
          }
        : {}),
      canAccuse: s?.act === 3 && s.phase === 'act' && !s.accusation,
      ...(s?.phase === 'reveal' && this.reveal
        ? {
            privateReveal: this.reveal.privates.get(playerId) ?? {
              headline: '',
              strength: '',
              evidence: [],
              quieterSide: '',
            },
          }
        : {}),
    };
  }

  /** The most recent closed commitment, as a sentence the room will recognise. */
  private lastDecision(s: GameState): Pick<ScreenView, 'lastDecision'> {
    const closed = s.commitments.filter((c) => c.closedAt !== undefined).at(-1);
    if (!closed) return {};
    const def = this.pack.acts.find((a) => a.commitment.id === closed.commitmentId)?.commitment;
    const counts = new Map<string, number>();
    for (const choice of Object.values(closed.votes))
      counts.set(choice, (counts.get(choice) ?? 0) + 1);
    const [winner, votes] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    if (!winner) return {};
    const label =
      def?.options?.find((o) => o.id === winner)?.label ??
      this.pack.suspects.find((x) => x.id === winner)?.name ??
      winner;
    return {
      lastDecision: {
        prompt: def?.prompt ?? '',
        choice: label,
        votes,
        of: Object.keys(closed.votes).length,
      },
    };
  }

  consoleView(): ConsoleView {
    const s = this.state;
    const act = this.actDef(s?.act ?? 1);
    return {
      type: 'console-view',
      roomCode: this.code,
      phase: s?.phase ?? 'lobby',
      act: s?.act ?? 1,
      ...(s?.actStartedAt !== undefined ? { actStartedAt: s.actStartedAt } : {}),
      actMinutes: act.minutes,
      players: this.lobby.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        moveCount: (s?.log ?? []).filter((e) => e.move.playerId === p.id).length,
        bot: this.bots.has(p.id),
      })),
      boardCount: s?.board.length ?? 0,
      questionCount: s?.questions.length ?? 0,
      accusationMade: Boolean(s?.accusation),
      ...(s?.phase === 'commitment'
        ? {
            votesIn: {
              voted: Object.keys(s.commitments.at(-1)?.votes ?? {}).length,
              of: s.players.length,
            },
          }
        : {}),
      screenConnected: [...this.clients].some((c) => c.role === 'screen'),
      prologuePlaying: this.prologuePlaying,
      hasPrologue: Boolean(this.pack.prologue?.beats.length),
      ...(s?.phase === 'reveal' && this.reveal ? { teamReveal: this.reveal.teamShape } : {}),
    };
  }

  /** For persistence after the game. */
  snapshot(): { caseId: string; state: GameState | null } {
    return { caseId: this.pack.id, state: this.state };
  }

  /**
   * What this session tells us about itself (PRD §19). Logged as one line as
   * well as stored, so a room is legible from the Render log with no database.
   */
  metrics(): ReturnType<typeof computeMetrics> | null {
    if (!this.state) return null;
    const m = computeMetrics(this.pack, this.state, this.bots.ids);
    console.log(summariseMetrics(m));
    return m;
  }

  /** Which player this connection is, for attributing a debrief answer. */
  hasPlayer(playerId: string): boolean {
    return this.lobby.some((p) => p.id === playerId);
  }
}
