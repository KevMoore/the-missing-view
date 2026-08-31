/**
 * One live session: the case, the sockets, the big screen, and the one or two
 * houses playing (D38).
 *
 * The server owns the rules (D20); clients only render and send intents. What
 * a house owns is in `Table`; what is here is everything the houses share — the
 * room code, the lobby, the clients, the prologue, the act clock and the audio.
 */
import { randomBytes, randomInt } from 'node:crypto';
import {
  compareHouses,
  computeMetrics,
  createSession,
  summariseMetrics,
  IllegalMove,
  MAX_PLAYERS,
  MAX_SESSION_PLAYERS,
  MIN_PLAYERS,
  type CasePack,
  type FacilitatorAction,
  type GameState,
  type HouseResult,
  type Move,
  type SessionMode,
} from '@tmv/core';
import type { ConsoleView, PhoneView, ScreenView, ServerMessage } from './protocol.js';
import { narrate } from './llm.js';
import { Table } from './table.js';
import type { BotOptions } from './bots.js';

export interface Client {
  role: 'phone' | 'screen' | 'console';
  playerId?: string;
  /**
   * For a screen: the one house it is showing. Filtered here rather than in the
   * browser — a view that reaches a client has reached it, whatever the CSS
   * does about it afterwards (D20, D40).
   */
  houseId?: string;
  send: (msg: ServerMessage) => void;
}

interface PendingPlayer {
  id: string;
  name: string;
  connected: boolean;
  /** Which house. Assigned by the facilitator; defaulted at start. */
  houseId?: string;
  /** The character the facilitator chose for them, if they chose one (D37). */
  characterId?: string;
}

const DEFAULT_HOUSE_NAMES = ['House One', 'House Two'];

export class Room {
  readonly code: string;
  readonly mode: SessionMode;
  private readonly pack: CasePack;
  /** Never empty: one house, or two. Typed so `tables[0]` needs no assertion. */
  private readonly tables: [Table, ...Table[]];
  private readonly lobby: PendingPlayer[] = [];
  private readonly clients = new Set<Client>();
  /** Spoken audio by key. Capped: a long game must not grow without bound. */
  private readonly voices = new Map<string, Buffer>();
  /** True while the opening sequence is on the big screen. */
  private prologuePlaying = false;
  /** Narration generated once per room and reused if it is played again. */
  private narrationReady = false;
  private started = false;
  /**
   * Random per room, so two games of the same case deal and cast differently.
   * Overridable only so tests can pin a table rather than hope for one — a
   * suite that depends on the draw is a suite that fails one run in two hundred.
   */
  private readonly seed: number;
  private readonly emails: { playerId: string; email: string }[] = [];

  constructor(pack: CasePack, botOptions: BotOptions & { seed?: number; mode?: SessionMode } = {}) {
    this.seed = botOptions.seed ?? randomInt(1, 2 ** 31);
    this.pack = pack;
    this.mode = botOptions.mode ?? 'one-house';
    this.code = randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars, unguessable enough for a room (D21)
    const host = {
      seat: (name: string, houseId: string) => this.joinPlayer(name, undefined, houseId),
      changed: () => {
        this.pushViews();
      },
      putVoice: (key: string, audio: Buffer) => {
        this.putVoice(key, audio);
      },
      hasVoice: (key: string) => this.voices.has(key),
    };
    const house = (i: number) =>
      new Table(
        `h${String(i + 1)}`,
        DEFAULT_HOUSE_NAMES[i] ?? `House ${String(i + 1)}`,
        pack,
        host,
        botOptions,
      );
    this.tables = this.mode === 'two-houses' ? [house(0), house(1)] : [house(0)];
  }

  /** How many people this room can hold — a full house, or two of them. */
  get capacity(): number {
    return this.mode === 'two-houses' ? MAX_SESSION_PLAYERS : MAX_PLAYERS;
  }

  // ---- houses ----

  private table(id: string): Table {
    const t = this.tables.find((x) => x.id === id);
    if (!t) throw new IllegalMove(`no house ${id}`);
    return t;
  }

  /** The house a player is in. Falls back to the first, which is all there is
   *  in one-house play and the only sane default before assignment. */
  private tableOf(playerId: string): Table {
    const houseId = this.lobby.find((p) => p.id === playerId)?.houseId;
    return this.tables.find((t) => t.id === houseId) ?? this.tables[0];
  }

  private membersOf(houseId: string): PendingPlayer[] {
    if (this.mode === 'one-house') return this.lobby;
    return this.lobby.filter((p) => p.houseId === houseId);
  }

  nameHouse(houseId: string, name: string): void {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    this.table(houseId).name = trimmed;
    this.pushViews();
  }

  /**
   * Put a person in a house, in a character, or both.
   *
   * Lobby only. After the deal a character is attached to a hand of clues and a
   * house is a whole game, so moving anybody would mean redealing — which would
   * take clues out of hands the rest of the house has already been told about.
   */
  assign(playerId: string, houseId?: string, characterId?: string): void {
    if (this.started) throw new IllegalMove('the game has already been dealt');
    const player = this.lobby.find((p) => p.id === playerId);
    if (!player) throw new IllegalMove('no such player');
    if (houseId !== undefined) {
      this.table(houseId); // throws on an unknown house
      if (this.membersOf(houseId).length >= MAX_PLAYERS && player.houseId !== houseId)
        throw new IllegalMove('that house is full');
      player.houseId = houseId;
    }
    if (characterId !== undefined) {
      if (characterId === '') delete player.characterId;
      else {
        if (!this.pack.characters.some((c) => c.id === characterId))
          throw new IllegalMove('no such character');
        if (this.lobby.some((p) => p.id !== playerId && p.characterId === characterId))
          throw new IllegalMove('somebody already has that character');
        player.characterId = characterId;
      }
    }
    this.pushViews();
  }

  // ---- bots ----

  /** Seat an AI player. They join the lobby and are dealt a character like anyone. */
  addBot(houseId?: string): { id: string; name: string } {
    const table = houseId === undefined ? this.emptiestTable() : this.table(houseId);
    return table.addBot();
  }

  /** Bots fill up the house that needs them most, so a two-house test is even. */
  private emptiestTable(): Table {
    let best = this.tables[0];
    for (const t of this.tables)
      if (this.membersOf(t.id).length < this.membersOf(best.id).length) best = t;
    return best;
  }

  isBot(playerId: string): boolean {
    return this.tables.some((t) => t.isBot(playerId));
  }

  get botCount(): number {
    return this.tables.reduce((n, t) => n + t.botCount, 0);
  }

  /** Called when the room is torn down, so an abandoned room stops ticking. */
  stopBots(): void {
    for (const t of this.tables) t.stopBots();
  }

  /** Drives one round of bot behaviour. Exposed so tests need no wall clock. */
  async tickBots(): Promise<void> {
    for (const t of this.tables) await t.tickBots();
  }

  /** Pacing (D12). Each house is nudged on its own quiet, not the room's. */
  considerNudge(now = Date.now()): void {
    let changed = false;
    for (const t of this.tables)
      if (t.considerNudge(now, (act) => this.actDef(act).minutes)) changed = true;
    if (changed) this.pushViews();
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
  joinPlayer(name: string, existingId?: string, houseId?: string): string {
    const existing = this.lobby.find((p) => p.id === existingId);
    if (existing) {
      existing.connected = true;
      return existing.id;
    }
    if (this.started) throw new IllegalMove('game already started');
    if (this.lobby.length >= this.capacity) throw new IllegalMove('room is full');
    const id = `p-${randomBytes(4).toString('hex')}`;
    // Everyone lands somewhere. With two houses the facilitator will move them,
    // but a player with no house at all has no phone view to be sent.
    this.lobby.push({
      id,
      name,
      connected: true,
      houseId: houseId ?? this.emptiestTable().id,
    });
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
    if (action === 'start' && !this.started) this.deal();
    const at = Date.now();
    for (const t of this.tables) await t.facilitate(action, at);
    this.pushViews();
    // Not awaited: the act begins now, and the voice catches up with the card.
    const phase = this.tables[0].state?.phase;
    const act = this.tables[0].state?.act;
    if (phase === 'act' && act !== undefined) void this.narrateAct(act);
  }

  /**
   * Deal every house in, at once.
   *
   * Casting runs house by house and each is told what the earlier one took, so
   * no character is played at both tables — two Lady Margarets in one room is
   * confusing on the big screen and worse in the debrief.
   */
  private deal(): void {
    const rosters = this.tables.map((t) => ({
      name: t.name,
      players: this.membersOf(t.id).map((p) => ({
        id: p.id,
        name: p.name,
        ...(this.isBot(p.id) ? { bot: true as const } : {}),
        ...(p.characterId !== undefined ? { characterId: p.characterId } : {}),
      })),
    }));
    for (const [i, roster] of rosters.entries())
      if (roster.players.length < MIN_PLAYERS)
        throw new IllegalMove(
          `${this.tables[i]?.name ?? 'a house'} has ${String(roster.players.length)} players, and needs at least ${String(MIN_PLAYERS)}`,
        );

    // Validated as a session first, so a bad roster throws before any house has
    // been dealt — half a dealt session is not a state anything can recover to.
    const session = createSession(this.pack, this.mode, rosters, this.seed);
    for (const [i, table] of this.tables.entries()) table.state = session.houses[i]?.game ?? null;
    this.started = true;
  }

  /**
   * `at` is overridable for the same reason `seed` is: pacing is a function of
   * time, and a test that cannot say when something happened cannot test it.
   */
  async handleMove(move: Move, at = Date.now()): Promise<void> {
    await this.tableOf(move.playerId).handleMove(move, at);
    this.pushViews();
  }

  // ---- the spoken layer ----

  private putVoice(key: string, audio: Buffer): void {
    this.voices.set(key, audio);
    for (const [oldest] of this.voices) {
      if (this.voices.size <= 20 * this.tables.length) break;
      // Narration is made once and may be replayed; only answers age out.
      if (oldest.includes('prologue-') || oldest.includes('act-')) continue;
      this.voices.delete(oldest);
    }
  }

  /**
   * The act's opening lines, spoken. Made once when the act begins, so the
   * break card has a voice by the time the room is looking at it. Shared: there
   * is one big screen, and both houses are in the same act.
   */
  private async narrateAct(act: 1 | 2 | 3): Promise<void> {
    const key = `act-${String(act)}`;
    if (this.voices.has(key)) return;
    const audio = await narrate(this.pack, this.actDef(act).opening);
    if (!audio) return;
    this.putVoice(key, audio);
    this.pushViews();
  }

  /**
   * Start or stop the narrated opening. The narration is made once and kept, so
   * a facilitator who plays it twice — a latecomer, a false start — waits only
   * the first time. The screen is handed the beats and does the rest.
   */
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
      this.putVoice(`prologue-${String(i)}`, audio);
      this.pushViews();
    }
  }

  /** The mp3 for one answer, for the HTTP route the big screen fetches. */
  voice(key: string): Buffer | undefined {
    return this.voices.get(key);
  }

  // ---- views ----

  broadcast(msg: ServerMessage): void {
    for (const c of this.clients) c.send(msg);
  }

  pushViews(): void {
    for (const c of this.clients) {
      if (c.role === 'screen') c.send(this.screenView(c.houseId));
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

  /** The lead house, which sets the phase and act for the shared screen. */
  private get lead(): GameState | null {
    return this.tables[0].state;
  }

  /**
   * The backdrop for the current beat of the flow (D20: the server decides,
   * the screen only renders what it is handed). Falls back act -> lobby so a
   * partially-arted case never shows a blank stage mid-game.
   */
  private sceneAsset(): string | undefined {
    const scenes = this.pack.theme?.scenes;
    if (!scenes) return undefined;
    const s = this.lead;
    const phase = s?.phase ?? 'lobby';
    if (phase === 'lobby') return scenes.lobby;
    if (phase === 'reveal') return scenes.reveal ?? scenes.act3;
    const forAct = [scenes.act1, scenes.act2, scenes.act3][(s?.act ?? 1) - 1];
    if (this.tables.some((t) => t.state?.accusation)) return scenes.accusation ?? forAct;
    if (phase === 'commitment') return scenes.commitment ?? forAct;
    return forAct ?? scenes.lobby;
  }

  private names(): Map<string, string> {
    return new Map(this.lobby.map((p) => [p.id, p.name]));
  }

  private suspectName(id: string): string {
    return this.pack.suspects.find((x) => x.id === id)?.name ?? id;
  }

  private castOf(playerId: string, s: GameState | null) {
    const characterId = s?.players.find((p) => p.id === playerId)?.characterId;
    return this.pack.characters.find((c) => c.id === characterId);
  }

  /** One house's cast, for the big screen. */
  private housePlayers(table: Table) {
    const names = this.names();
    return (table.state?.players ?? []).map((p) => {
      const character = this.castOf(p.id, table.state);
      return {
        id: p.id,
        name: names.get(p.id) ?? p.id,
        characterName: character?.name ?? '',
        ...(character?.portraitAsset ? { portraitAsset: character.portraitAsset } : {}),
      };
    });
  }

  private houseBoard(table: Table) {
    const names = this.names();
    const clueById = new Map(this.pack.clues.map((c) => [c.id, c]));
    return (table.state?.board ?? []).map((t) => {
      const clue = clueById.get(t.clueId);
      return {
        ...t,
        title: clue?.title ?? '',
        text: clue?.text ?? '',
        byName: names.get(t.by) ?? t.by,
        ...(clue?.imageAsset ? { imageAsset: clue.imageAsset } : {}),
      };
    });
  }

  private houseTheories(table: Table) {
    const names = this.names();
    return (table.state?.theories ?? []).map((t) => ({ ...t, byName: names.get(t.by) ?? t.by }));
  }

  /** Both houses' questions, newest last, each tagged with who asked. */
  private allQuestions(from: readonly Table[] = this.tables) {
    // The tag says which house asked, and is worth nothing on a screen that is
    // only ever showing one.
    const tag = this.mode === 'two-houses' && from.length > 1;
    const names = this.names();
    const rows = from.flatMap((table) =>
      (table.state?.questions ?? []).map((q) => ({
        ...q,
        byName: names.get(q.by) ?? q.by,
        suspectName: this.suspectName(q.suspectId),
        ...(tag ? { houseName: table.name } : {}),
        ...(this.voices.has(table.voiceKey(`ask-${q.id}`))
          ? { askUrl: `/voice/${this.code}/${table.voiceKey(`ask-${q.id}`)}.mp3` }
          : {}),
        ...(this.voices.has(table.voiceKey(q.id))
          ? { voiceUrl: `/voice/${this.code}/${table.voiceKey(q.id)}.mp3` }
          : {}),
      })),
    );
    return rows.sort((a, b) => a.at - b.at).slice(-12);
  }

  /** Only once every house has finished: a live scoreboard is a copying aid. */
  private comparison(): HouseResult[] | undefined {
    if (this.mode !== 'two-houses') return undefined;
    const houses = this.tables.flatMap((t) => {
      const game = t.state;
      return game?.phase === 'reveal' ? [{ id: t.id, name: t.name, game }] : [];
    });
    if (houses.length !== this.tables.length) return undefined;
    return compareHouses({ caseId: this.pack.id, seed: this.seed, mode: this.mode, houses });
  }

  /**
   * @param watching the one house this screen shows. Undefined shows them all,
   * which is right for one-house play and for a facilitator's own monitor.
   */
  screenView(watching?: string): ScreenView {
    const shown =
      watching === undefined ? this.tables : this.tables.filter((t) => t.id === watching);
    const s = this.lead;
    const act = this.actDef(s?.act ?? 1);
    const scene = this.sceneAsset();
    const first = shown[0] ?? this.tables[0];
    const comparison = this.comparison();
    const nudge = shown.find((t) => t.nudge)?.nudge;
    return {
      type: 'screen-view',
      roomCode: this.code,
      mode: this.mode,
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
      // The flat fields describe the lead house, which in one-house play is the
      // only one. A two-house screen reads `houses` and ignores these.
      players: this.started
        ? this.housePlayers(first)
        : this.lobby.map((p) => ({ id: p.id, name: p.name, characterName: '' })),
      ...(this.mode === 'two-houses'
        ? { houseChoices: this.tables.map((t) => ({ id: t.id, name: t.name })) }
        : {}),
      ...(watching !== undefined ? { watching } : {}),
      houses: shown.map((t) => ({
        id: t.id,
        name: t.name,
        players: this.housePlayers(t),
        board: this.houseBoard(t),
        theories: this.houseTheories(t),
        ...(t.state?.act === 3
          ? {
              committed: {
                count: Object.keys(t.state.accusationVotes).length,
                of: t.state.players.filter((p) => !p.bot).length,
              },
            }
          : {}),
        ...(t.state?.accusation
          ? {
              accusation: {
                ...t.state.accusation,
                culpritName: this.suspectName(t.state.accusation.culpritId),
              },
            }
          : {}),
      })),
      ...(comparison ? { comparison } : {}),
      suspects: this.pack.suspects.map(({ id, name, publicBio, portraitAsset }) => ({
        id,
        name,
        publicBio,
        ...(portraitAsset ? { portraitAsset } : {}),
      })),
      board: this.houseBoard(first),
      theories: this.houseTheories(first),
      questions: this.allQuestions(shown),
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
      ...(nudge
        ? { nudge: `The house has gone quiet. Somebody here is still holding “${nudge.title}”.` }
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
      ...(first.state?.accusation
        ? {
            accusation: {
              ...first.state.accusation,
              culpritName: this.suspectName(first.state.accusation.culpritId),
            },
          }
        : {}),
      ...(s?.phase === 'reveal' && first.reveal ? { reveal: first.reveal.shared } : {}),
    };
  }

  phoneView(playerId: string): PhoneView | null {
    const table = this.tableOf(playerId);
    const s = table.state;
    const names = this.names();
    const clueById = new Map(this.pack.clues.map((c) => [c.id, c]));
    const player = s?.players.find((p) => p.id === playerId);
    const character = this.castOf(playerId, s);
    const act = this.actDef(s?.act ?? 1);
    const tabled = new Set((s?.board ?? []).map((t) => t.clueId));
    const commitment = s?.commitments.at(-1);
    const deciding = (s?.players ?? []).filter((p) => !p.bot);
    return {
      type: 'phone-view',
      playerId,
      roomCode: this.code,
      phase: s?.phase ?? 'lobby',
      act: s?.act ?? 1,
      ...(this.mode === 'two-houses' ? { houseName: table.name } : {}),
      character: {
        name: character?.name ?? names.get(playerId) ?? '',
        role: character?.role ?? '',
        briefing: character?.briefing ?? 'Waiting for the facilitator to begin…',
        ...(character?.portraitAsset ? { portraitAsset: character.portraitAsset } : {}),
      },
      hand: (player?.hand ?? []).map((id) => {
        const clue = clueById.get(id);
        return {
          id,
          title: clue?.title ?? '',
          text: clue?.text ?? '',
          tabled: tabled.has(id),
          ...(clue?.imageAsset ? { imageAsset: clue.imageAsset } : {}),
        };
      }),
      // Only this house. The whisper list is how a player names somebody, and
      // naming somebody in the other house would be a move that cannot land.
      players: this.membersOf(table.id)
        .filter((p) => p.id !== playerId)
        .map((p) => ({ id: p.id, name: p.name })),
      suspects: this.pack.suspects.map(({ id, name, publicBio, portraitAsset }) => ({
        id,
        name,
        publicBio,
        ...(portraitAsset ? { portraitAsset } : {}),
      })),
      theories: this.houseTheories(table),
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
      ...(table.nudge?.holder === playerId
        ? {
            nudge: `You are still holding “${table.nudge.title}”. The house has gone quiet — this may be the moment.`,
          }
        : {}),
      ...(s && (s.act === 3 || s.accusation)
        ? {
            accusation: {
              ...(s.accusationVotes[playerId] ? { myChoice: s.accusationVotes[playerId] } : {}),
              votes: deciding.map((p) => {
                const choice = s.accusationVotes[p.id];
                return {
                  playerId: p.id,
                  name: names.get(p.id) ?? p.id,
                  ...(choice ? { culpritId: choice, culpritName: this.suspectName(choice) } : {}),
                };
              }),
              motive: s.motive,
              ...(s.accusation
                ? { locked: { culpritName: this.suspectName(s.accusation.culpritId) } }
                : {}),
            },
          }
        : {}),
      canAccuse: s?.act === 3 && s.phase === 'act' && !s.accusation,
      ...(s?.phase === 'reveal' && table.reveal
        ? {
            privateReveal: table.reveal.privates.get(playerId) ?? {
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
    const s = this.lead;
    const act = this.actDef(s?.act ?? 1);
    const comparison = this.comparison();
    const taken = new Map<string, string>();
    for (const p of this.lobby) if (p.characterId !== undefined) taken.set(p.characterId, p.name);
    return {
      type: 'console-view',
      roomCode: this.code,
      mode: this.mode,
      phase: s?.phase ?? 'lobby',
      act: s?.act ?? 1,
      ...(s?.actStartedAt !== undefined ? { actStartedAt: s.actStartedAt } : {}),
      actMinutes: act.minutes,
      players: this.lobby.map((p) => {
        const table = this.tableOf(p.id);
        const dealt = table.state?.players.find((x) => x.id === p.id)?.characterId;
        const characterId = p.characterId ?? dealt;
        return {
          id: p.id,
          name: p.name,
          connected: p.connected,
          moveCount: (table.state?.log ?? []).filter((e) => e.move.playerId === p.id).length,
          bot: this.isBot(p.id),
          ...(p.houseId !== undefined ? { houseId: p.houseId } : {}),
          ...(characterId !== undefined
            ? {
                characterId,
                characterName:
                  this.pack.characters.find((c) => c.id === characterId)?.name ?? characterId,
              }
            : {}),
        };
      }),
      houses: this.tables.map((t) => {
        const n = this.membersOf(t.id).length;
        return { id: t.id, name: t.name, playerCount: n, ready: n >= MIN_PLAYERS };
      }),
      ...(this.started
        ? {}
        : {
            characters: this.pack.characters.map((c) => {
              const takenBy = taken.get(c.id);
              return {
                id: c.id,
                name: c.name,
                role: c.role,
                lean: c.botLean ?? 'detail',
                ...(c.voiceDirection ? { voiceDirection: c.voiceDirection } : {}),
                ...(c.portraitAsset ? { portraitAsset: c.portraitAsset } : {}),
                ...(takenBy !== undefined ? { takenBy } : {}),
              };
            }),
          }),
      ...(comparison ? { comparison } : {}),
      boardCount: this.tables.reduce((n, t) => n + (t.state?.board.length ?? 0), 0),
      questionCount: this.tables.reduce((n, t) => n + (t.state?.questions.length ?? 0), 0),
      accusationMade: this.tables.every((t) => Boolean(t.state?.accusation)),
      ...(s?.phase === 'commitment'
        ? {
            votesIn: {
              voted: this.tables.reduce(
                (n, t) => n + Object.keys(t.state?.commitments.at(-1)?.votes ?? {}).length,
                0,
              ),
              of: this.tables.reduce((n, t) => n + (t.state?.players.length ?? 0), 0),
            },
          }
        : {}),
      screenConnected: [...this.clients].some((c) => c.role === 'screen'),
      prologuePlaying: this.prologuePlaying,
      hasPrologue: Boolean(this.pack.prologue?.beats.length),
      ...(s?.phase === 'reveal' && this.tables[0].reveal
        ? { teamReveal: this.tables[0].reveal.teamShape }
        : {}),
    };
  }

  /** For persistence after the game. One row per house. */
  snapshot(): { caseId: string; state: GameState | null } {
    return { caseId: this.pack.id, state: this.lead };
  }

  /** Every house's finished state, for the store and the debrief. */
  snapshots(): { houseId: string; houseName: string; state: GameState }[] {
    return this.tables.flatMap((t) => {
      const state = t.state;
      return state ? [{ houseId: t.id, houseName: t.name, state }] : [];
    });
  }

  /**
   * What this session tells us about itself (PRD §19). Logged as one line as
   * well as stored, so a room is legible from the Render log with no database.
   */
  metrics(): ReturnType<typeof computeMetrics> | null {
    const s = this.lead;
    if (!s) return null;
    const bots = new Set(this.tables.flatMap((t) => [...t.botIds]));
    const m = computeMetrics(this.pack, s, bots);
    console.log(summariseMetrics(m));
    return m;
  }

  /** Which player this connection is, for attributing a debrief answer. */
  hasPlayer(playerId: string): boolean {
    return this.lobby.some((p) => p.id === playerId);
  }
}
