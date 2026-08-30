/**
 * AI players, so one person can play a game built for four to eight.
 *
 * They are ordinary players: they join the lobby, are dealt a private hand and
 * an investigator character by the same seeded deal, and act only through
 * `Room.handleMove`. Nothing in the engine, the views, or the reveal knows a bot
 * from a human — which is the point, because the reveal counts their moves too
 * and a solo playtest should produce a realistic board.
 *
 * A bot's personality is its dealt `PlayerCharacter`, not a separate invention:
 * the Retired Inspector interrogates, the Journalist theorises, the American
 * Heiress challenges. `botLean` in the case pack picks the behaviour; the
 * character's own briefing shapes the words (via `phraseBotLine`, with a
 * deterministic fallback so bots work with no API key at all).
 *
 * Two things they deliberately never do:
 * - **Accuse.** Ending the game is the human's call, always.
 * - **Whisper.** A private nudge to a bot goes nowhere and would waste the move.
 */
import type { BotLean, CasePack, GameState, Move, PlayerCharacter } from '@tmv/core';
import { IllegalMove } from '@tmv/core';
import { phraseBotLine } from './llm.js';

/** Period first names, so the lobby list reads like a guest list. */
const BOT_NAMES = [
  'Hobbes',
  'Prudence',
  'Ellery',
  'Marple',
  'Wimsey',
  'Tuppence',
  'Fen',
  'Bramble',
];

export interface BotOptions {
  /** How often a bot considers acting. */
  tickMs?: number;
  /** How long a bot waits before voting, so the room sees the prompt first. */
  voteDelayMs?: number;
}

const DEFAULTS = { tickMs: 25_000, voteDelayMs: 6_000 };

/** What a bot needs from its Room. Narrow on purpose — easy to fake in a test. */
export interface BotHost {
  snapshot: () => { caseId: string; state: GameState | null };
  joinPlayer: (name: string) => string;
  handleMove: (move: Move) => Promise<void>;
}

export class BotDriver {
  private readonly host: BotHost;
  private readonly pack: CasePack;
  private readonly opts: Required<BotOptions>;
  /** Read by the room so metrics can separate a real table from a solo playtest. */
  readonly ids = new Set<string>();
  /** Commitments already voted in, so a bot votes once however often we tick. */
  private readonly voted = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private cursor = 0;

  constructor(host: BotHost, pack: CasePack, opts: BotOptions = {}) {
    this.host = host;
    this.pack = pack;
    this.opts = { ...DEFAULTS, ...opts };
  }

  get count(): number {
    return this.ids.size;
  }

  has(playerId: string): boolean {
    return this.ids.has(playerId);
  }

  /** Seat one AI player. Throws through `joinPlayer` if the room is full. */
  add(): { id: string; name: string } {
    const name = BOT_NAMES[this.ids.size % BOT_NAMES.length] ?? `Guest ${String(this.ids.size)}`;
    const id = this.host.joinPlayer(name);
    this.ids.add(id);
    this.ensureRunning();
    return { id, name };
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private ensureRunning(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.opts.tickMs);
    // Node should not stay alive just to run bots in an abandoned room.
    this.timer.unref();
  }

  /** Exposed for tests: one round of bot behaviour, awaited. */
  async tick(): Promise<void> {
    const { state } = this.host.snapshot();
    if (!state || this.ids.size === 0) return;
    if (state.phase === 'commitment') {
      await this.voteAll(state);
      return;
    }
    if (state.phase !== 'act') return;
    // One bot acts per tick, round-robin, so the board fills at a human pace.
    const seated = state.players.filter((p) => this.ids.has(p.id));
    const player = seated[this.cursor++ % seated.length];
    if (player) await this.act(state, player.id);
  }

  private character(state: GameState, playerId: string): PlayerCharacter | undefined {
    const player = state.players.find((p) => p.id === playerId);
    return this.pack.characters.find((c) => c.id === player?.characterId);
  }

  /** Clue titles and text already on the shared board — all a bot may reason from. */
  private visibleEvidence(state: GameState): string[] {
    return state.board.flatMap((t) => {
      const clue = this.pack.clues.find((c) => c.id === t.clueId);
      return clue ? [`- ${clue.title}: ${clue.text}`] : [];
    });
  }

  private async voteAll(state: GameState): Promise<void> {
    const commitment = state.commitments.at(-1);
    if (!commitment || commitment.closedAt) return;
    if (this.voted.has(commitment.commitmentId)) return;
    this.voted.add(commitment.commitmentId);
    await delay(this.opts.voteDelayMs);

    const act = this.pack.acts.find((a) => a.number === state.act);
    const options =
      act?.commitment.kind === 'suspect'
        ? this.pack.suspects.map((s) => s.id)
        : (act?.commitment.options ?? []).map((o) => o.id);
    if (options.length === 0) return;

    for (const [i, playerId] of [...this.ids].entries()) {
      if (commitment.votes[playerId]) continue;
      // Spread the bots across the options rather than making the room unanimous:
      // a 4-0 vote tells the human nothing about their own reasoning.
      const choice = options[i % options.length];
      if (!choice) continue;
      await this.safeMove({
        type: 'commit-vote',
        playerId,
        commitmentId: commitment.commitmentId,
        choice,
      });
    }
  }

  private async act(state: GameState, playerId: string): Promise<void> {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;
    const character = this.character(state, playerId);
    const lean: BotLean = character?.botLean ?? 'detail';

    const tabled = new Set(state.board.map((t) => t.clueId));
    const held = player.hand.filter((id) => !tabled.has(id));

    // Tabling always wins when a bot is the only holder of something: an untabled
    // clue is invisible to the human, and a bot sitting on a key clue can make the
    // case unsolvable. 'detail' characters table eagerly; the others get on with
    // their own business first and clear their hand once they have nothing better.
    const mustTable = held.length > 0 && (lean === 'detail' || !this.hasBusiness(state, playerId));
    if (mustTable) {
      const clueId = held[0];
      if (clueId) {
        await this.safeMove({ type: 'table', playerId, clueId });
        return;
      }
    }

    switch (lean) {
      case 'theorise':
        await this.theorise(state, playerId, character);
        return;
      case 'challenge':
        await this.reactToTheory(state, playerId, true);
        return;
      case 'listen':
        await this.reactToTheory(state, playerId, false);
        return;
      case 'interrogate':
      default:
        await this.interrogate(state, playerId, character);
        return;
    }
  }

  /** True when this bot has something to do other than empty its hand. */
  private hasBusiness(state: GameState, playerId: string): boolean {
    return state.theories.some(
      (t) =>
        t.by !== playerId && !t.backers.includes(playerId) && !t.challengers.includes(playerId),
    );
  }

  private async theorise(
    state: GameState,
    playerId: string,
    character: PlayerCharacter | undefined,
  ): Promise<void> {
    const evidence = this.visibleEvidence(state);
    if (evidence.length === 0) {
      // Nothing to read yet — put something on the board instead of inventing.
      await this.tableAnything(state, playerId);
      return;
    }
    const newest = state.board.at(-1);
    const clue = newest ? this.pack.clues.find((c) => c.id === newest.clueId) : undefined;
    const fallback = clue
      ? `${clue.title} is the thread worth pulling — everything else hangs off it.`
      : 'The pieces on this board point one way, if we are honest about them.';
    const text =
      (character &&
        (await phraseBotLine(
          this.pack,
          character,
          'Offer a theory about what the evidence so far suggests, without naming a culprit.',
          evidence,
        ))) ??
      fallback;
    await this.safeMove({
      type: 'propose-theory',
      playerId,
      theoryId: `t-bot-${String(state.theories.length)}-${String(state.log.length)}`,
      text,
    });
  }

  private async reactToTheory(
    state: GameState,
    playerId: string,
    prefersChallenge: boolean,
  ): Promise<void> {
    const open = state.theories.find(
      (t) =>
        t.by !== playerId && !t.backers.includes(playerId) && !t.challengers.includes(playerId),
    );
    if (!open) {
      await this.tableAnything(state, playerId);
      return;
    }
    // Even a challenger backs sometimes, or the room learns nothing from dissent.
    const challenge = prefersChallenge && state.theories.indexOf(open) % 3 !== 2;
    await this.safeMove({
      type: challenge ? 'challenge-theory' : 'back-theory',
      playerId,
      theoryId: open.id,
    });
  }

  private async interrogate(
    state: GameState,
    playerId: string,
    character: PlayerCharacter | undefined,
  ): Promise<void> {
    const suspect = this.pack.suspects[state.questions.length % this.pack.suspects.length];
    if (!suspect) return;
    const evidence = this.visibleEvidence(state);
    const newest = state.board.at(-1);
    const clue = newest ? this.pack.clues.find((c) => c.id === newest.clueId) : undefined;
    const fallback = clue
      ? `What do you know about ${lowerFirst(clue.title)}?`
      : 'Where were you when the clock stopped?';
    const text =
      (character &&
        (await phraseBotLine(
          this.pack,
          character,
          `Ask ${suspect.name} one direct question about the evidence.`,
          evidence,
        ))) ??
      fallback;
    await this.safeMove({
      type: 'ask-suspect',
      playerId,
      questionId: `q-bot-${String(state.questions.length)}-${String(state.log.length)}`,
      suspectId: suspect.id,
      text,
    });
  }

  /** Last resort so a tick is never wasted: get a held clue onto the board. */
  private async tableAnything(state: GameState, playerId: string): Promise<void> {
    const player = state.players.find((p) => p.id === playerId);
    const tabled = new Set(state.board.map((t) => t.clueId));
    const clueId = player?.hand.find((id) => !tabled.has(id));
    if (clueId) await this.safeMove({ type: 'table', playerId, clueId });
  }

  /**
   * A bot losing a race — the human tabled the same clue first, the act closed
   * mid-tick — is normal, not an error. Anything else is worth seeing in the log.
   */
  private async safeMove(move: Move): Promise<void> {
    try {
      await this.host.handleMove(move);
    } catch (err) {
      if (!(err instanceof IllegalMove)) console.error('[bots] unexpected failure', err);
    }
  }
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
