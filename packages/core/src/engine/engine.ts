import type { CasePack } from '../case/types.js';
import { castCharacters, dealClues } from '../case/deal.js';
import type { FacilitatorAction, GameState, Move, Player, Seat } from './types.js';

export class IllegalMove extends Error {}

/**
 * Build the opening state: characters cast, act-1 clues dealt (D16).
 *
 * A seat may arrive with a character already on it. The facilitator knows the
 * people in the room and the game is about how those people work together, so
 * a deliberate cast beats a random one (D37) — but only where one was made:
 * every seat left blank is still cast from the pool, around what is taken.
 */
export function createGame(
  pack: CasePack,
  roster: Seat[],
  seed: number,
  /** Characters spoken for elsewhere in the session — the other house (D38). */
  reserved: readonly string[] = [],
): GameState {
  if (roster.length < 4 || roster.length > 8)
    throw new IllegalMove(`player count ${String(roster.length)} outside 4..8`);
  const deal = dealClues(pack, roster.length, seed, 1);

  const assigned = roster.map((p) => p.characterId).filter((c): c is string => c !== undefined);
  for (const id of assigned)
    if (!pack.characters.some((c) => c.id === id)) throw new IllegalMove(`unknown character ${id}`);
  const spare = castCharacters(pack.characters, roster.length, seed, [...assigned, ...reserved]);

  let next = 0;
  const players: Player[] = roster.map((p, i) => ({
    id: p.id,
    name: p.name,
    ...(p.bot === true ? { bot: true } : {}),
    characterId: p.characterId ?? (spare[next++] ?? { id: 'unknown' }).id,
    hand: deal.hands[i] ?? [],
  }));
  return {
    caseId: pack.id,
    seed,
    phase: 'lobby',
    act: 1,
    players,
    board: [],
    accusationVotes: {},
    motive: '',
    theories: [],
    questions: [],
    commitments: [],
    log: [],
  };
}

/** Apply a player move. Pure: returns a new state, throws IllegalMove on a bad one. */
export function applyMove(pack: CasePack, state: GameState, move: Move, at: number): GameState {
  if (state.phase !== 'act' && state.phase !== 'commitment')
    throw new IllegalMove(`no moves in phase ${state.phase}`);
  const player = state.players.find((p) => p.id === move.playerId);
  if (!player) throw new IllegalMove(`unknown player ${move.playerId}`);

  const next: GameState = { ...state, log: [...state.log, { at, act: state.act, move }] };

  switch (move.type) {
    case 'table': {
      if (!player.hand.includes(move.clueId))
        throw new IllegalMove(`${player.id} does not hold ${move.clueId}`);
      if (state.board.some((t) => t.clueId === move.clueId)) return next; // idempotent
      next.board = [...state.board, { clueId: move.clueId, by: player.id, at }];
      return next;
    }
    case 'whisper': {
      if (!player.hand.includes(move.clueId))
        throw new IllegalMove(`${player.id} does not hold ${move.clueId}`);
      const to = state.players.find((p) => p.id === move.toPlayerId);
      if (!to) throw new IllegalMove(`unknown recipient ${move.toPlayerId}`);
      next.players = state.players.map((p) =>
        p.id === to.id && !p.hand.includes(move.clueId)
          ? { ...p, hand: [...p.hand, move.clueId] }
          : p,
      );
      return next;
    }
    case 'propose-theory': {
      next.theories = [
        ...state.theories,
        {
          id: move.theoryId,
          text: move.text,
          by: player.id,
          at,
          backers: [player.id],
          challengers: [],
        },
      ];
      return next;
    }
    case 'back-theory':
    case 'challenge-theory': {
      const side = move.type === 'back-theory' ? 'backers' : 'challengers';
      const other = move.type === 'back-theory' ? 'challengers' : 'backers';
      next.theories = state.theories.map((t) =>
        t.id === move.theoryId
          ? {
              ...t,
              [side]: t[side].includes(player.id) ? t[side] : [...t[side], player.id],
              [other]: t[other].filter((id) => id !== player.id),
            }
          : t,
      );
      if (!state.theories.some((t) => t.id === move.theoryId))
        throw new IllegalMove(`unknown theory ${move.theoryId}`);
      return next;
    }
    case 'ask-suspect': {
      if (!pack.suspects.some((s) => s.id === move.suspectId))
        throw new IllegalMove(`unknown suspect ${move.suspectId}`);
      next.questions = [
        ...state.questions,
        { id: move.questionId, suspectId: move.suspectId, by: player.id, text: move.text, at },
      ];
      return next;
    }
    case 'commit-vote': {
      if (state.phase !== 'commitment') throw new IllegalMove('commitment is not open');
      const current = state.commitments.at(-1);
      if (current?.commitmentId !== move.commitmentId || current.closedAt)
        throw new IllegalMove(`commitment ${move.commitmentId} is not open`);
      next.commitments = state.commitments.map((c) =>
        c === current ? { ...c, votes: { ...c.votes, [player.id]: move.choice } } : c,
      );
      return next;
    }
    case 'set-motive': {
      if (state.accusation) throw new IllegalMove('the house has already accused');
      next.motive = move.text;
      return next;
    }
    case 'accuse-withdraw': {
      if (state.accusation) throw new IllegalMove('the house has already accused');
      next.accusationVotes = Object.fromEntries(
        Object.entries(state.accusationVotes).filter(([id]) => id !== player.id),
      );
      return next;
    }
    case 'accuse-commit': {
      if (state.act !== 3) throw new IllegalMove('accusation only in act 3');
      if (state.accusation) throw new IllegalMove('the house has already accused');
      if (!pack.suspects.some((s) => s.id === move.culpritId))
        throw new IllegalMove(`unknown suspect ${move.culpritId}`);
      next.accusationVotes = { ...state.accusationVotes, [player.id]: move.culpritId };

      // The accusation exists only when everyone who can commit has committed
      // to the same name. Unanimity, not a majority: a majority is a vote, and
      // a vote lets a team accuse over the head of somebody who disagrees (D8).
      const deciding = state.players.filter((p) => !p.bot);
      const chosen = deciding.map((p) => next.accusationVotes[p.id]);
      const first = chosen[0];
      if (first === undefined || chosen.some((c) => c !== first)) return next;

      next.accusation = {
        culpritId: first,
        motive: next.motive,
        committedBy: deciding.map((p) => p.id).sort(),
        at,
        correct: first === pack.solution.culpritId,
      };
      return next;
    }
  }
}

/** Facilitator drives phase transitions (D4). */
export function applyFacilitator(
  pack: CasePack,
  state: GameState,
  action: FacilitatorAction,
  at: number,
): GameState {
  switch (action.type) {
    case 'start': {
      if (state.phase !== 'lobby') throw new IllegalMove('already started');
      return { ...state, phase: 'act', act: 1, actStartedAt: at };
    }
    case 'open-commitment': {
      if (state.phase !== 'act') throw new IllegalMove('not in an act');
      const actDef = pack.acts[state.act - 1];
      if (!actDef) throw new IllegalMove(`no act ${String(state.act)}`);
      const commitment = actDef.commitment;
      return {
        ...state,
        phase: 'commitment',
        commitments: [...state.commitments, { commitmentId: commitment.id, votes: {} }],
      };
    }
    case 'next-act': {
      if (state.phase !== 'commitment') throw new IllegalMove('close a commitment first');
      const closed = state.commitments.map((c, i) =>
        i === state.commitments.length - 1 ? { ...c, closedAt: at } : c,
      );
      if (state.act === 3) return { ...state, commitments: closed, phase: 'reveal' };
      const act = (state.act + 1) as 2 | 3;
      // Deal this act's clues on top of existing hands, and tell the deal what
      // everyone already holds so the proof keeps spreading to new seats.
      const deal = dealClues(
        pack,
        state.players.length,
        state.seed,
        act,
        state.players.map((p) => p.hand),
      );
      const players = state.players.map((p, i) => ({
        ...p,
        hand: [...p.hand, ...(deal.hands[i] ?? [])],
      }));
      return { ...state, commitments: closed, phase: 'act', act, actStartedAt: at, players };
    }
    case 'trigger-reveal': {
      return { ...state, phase: 'reveal' };
    }
  }
}
