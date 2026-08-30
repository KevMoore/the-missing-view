/**
 * One live game room: authoritative state, connected sockets, role-scoped views.
 * The server owns the rules (D20); clients only render and send intents.
 */
import { randomBytes, randomInt } from 'node:crypto';
import {
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
import { askSuspect, speakAnswer } from './llm.js';
import { BotDriver, type BotOptions } from './bots.js';

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
  private readonly seed = randomInt(1, 2 ** 31);
  private readonly emails: { playerId: string; email: string }[] = [];
  private readonly bots: BotDriver;

  constructor(pack: CasePack, botOptions: BotOptions = {}) {
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
    this.pushViews();
  }

  async handleMove(move: Move): Promise<void> {
    if (!this.state) throw new IllegalMove('game not started');
    this.state = applyMove(this.pack, this.state, move, Date.now());
    this.pushViews();
    if (move.type === 'ask-suspect') await this.answerSuspect(move);
    if (this.state.accusation && this.state.phase !== 'reveal') {
      // Accusation lands -> facilitator will trigger the reveal; nothing automatic.
    }
  }

  private async answerSuspect(move: Extract<Move, { type: 'ask-suspect' }>): Promise<void> {
    const history = this.qaHistory.get(move.suspectId) ?? [];
    const { answer, fromBank } = await askSuspect(this.pack, move.suspectId, move.text, history);
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

  private async speak(questionId: string, suspectId: string, answer: string): Promise<void> {
    const audio = await speakAnswer(this.pack, suspectId, answer);
    if (!audio) return;
    this.voices.set(questionId, audio);
    for (const [oldest] of this.voices) {
      if (this.voices.size <= 20) break;
      this.voices.delete(oldest);
    }
    this.pushViews();
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
        .map((p) => ({
          id: p.id,
          name: names.get(p.id) ?? p.id,
          characterName: this.pack.characters.find((c) => c.id === p.characterId)?.name ?? '',
        }))
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
        ...(this.voices.has(q.id) ? { voiceUrl: `/voice/${this.code}/${q.id}.mp3` } : {}),
      })),
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
      screenConnected: [...this.clients].some((c) => c.role === 'screen'),
      ...(s?.phase === 'reveal' && this.reveal ? { teamReveal: this.reveal.teamShape } : {}),
    };
  }

  /** For persistence after the game. */
  snapshot(): { caseId: string; state: GameState | null } {
    return { caseId: this.pack.id, state: this.state };
  }
}
