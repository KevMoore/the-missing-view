/**
 * The eight team moments, measured (D17, D29).
 *
 * Every clue is authored to trigger one kind of team behaviour — someone
 * noticing the small thing, someone connecting a pattern, someone pushing back,
 * someone finally deciding. Until now those markers shaped the case at authoring
 * time and were never read again, so the game validated on a team-development
 * vocabulary it did not actually use.
 *
 * A moment is *offered* when its clue reaches the board, because tabling is the
 * one act that makes a private thing usable by the room (D6) and it is credited
 * to a named person. A moment *lands* when the room does something with it
 * inside the next few minutes: a theory, a challenge, a question, a whisper.
 *
 * That distinction is the useful one for a debrief. "Nobody ever did synthesis"
 * is worth knowing. "Someone did synthesis and the room talked straight past it"
 * is worth a great deal more, and is a thing groups do constantly.
 *
 * Everything here is derived from the logged move stream and nothing is
 * inferred (D10). No personality is assigned to anybody (D11).
 */
import type { CasePack, TeamMoment } from '../case/types.js';
import type { GameState } from '../engine/types.js';
import { DELIBERATION } from '../engine/types.js';

/** How long the room has to pick something up before we call it missed. */
const RESPONSE_WINDOW_MS = 3 * 60 * 1000;

export interface MomentRecord {
  moment: TeamMoment;
  /** The clue authored to trigger it. */
  clueId: string;
  clueTitle: string;
  /** True once that clue reached the board. */
  offered: boolean;
  /** Who put it there. */
  byPlayerId?: string;
  /** True when the room acted on it inside the window. */
  landed: boolean;
  /** What the room did, for the debrief: 'a theory', 'a challenge', 'a question'. */
  response?: string;
}

const RESPONSE_LABEL: Record<string, string> = {
  'propose-theory': 'a theory',
  'challenge-theory': 'a challenge',
  'back-theory': 'someone backing it',
  'ask-suspect': 'a question to a suspect',
  whisper: 'a whisper',
  table: 'another clue',
};

/**
 * One record per authored moment. A case may carry several clues for the same
 * moment; the moment counts as offered once any of them is tabled, and the
 * record follows the first that was.
 */
export function computeMoments(pack: CasePack, state: GameState): MomentRecord[] {
  const tabledAt = new Map(state.board.map((t) => [t.clueId, t]));
  const byMoment = new Map<TeamMoment, MomentRecord>();

  // Earliest-tabled clue wins the record, so a moment is credited to whoever
  // actually opened it rather than to whoever repeated it later.
  const ordered = pack.clues
    .filter((c) => c.moment !== undefined)
    .map((c) => ({ clue: c, tabled: tabledAt.get(c.id) }))
    .sort((a, b) => (a.tabled?.at ?? Infinity) - (b.tabled?.at ?? Infinity));

  for (const { clue, tabled } of ordered) {
    const moment = clue.moment;
    if (moment === undefined) continue;
    const existing = byMoment.get(moment);
    if (existing?.offered) continue;

    if (!tabled) {
      byMoment.set(moment, {
        moment,
        clueId: clue.id,
        clueTitle: clue.title,
        offered: false,
        landed: false,
      });
      continue;
    }

    // What the room did next, by anyone other than the person who tabled it —
    // reacting to your own clue is not the room picking it up.
    const response = state.log.find(
      (e) =>
        e.at > tabled.at &&
        e.at - tabled.at <= RESPONSE_WINDOW_MS &&
        e.move.playerId !== tabled.by &&
        !DELIBERATION.includes(e.move.type),
    );

    byMoment.set(moment, {
      moment,
      clueId: clue.id,
      clueTitle: clue.title,
      offered: true,
      byPlayerId: tabled.by,
      landed: response !== undefined,
      ...(response ? { response: RESPONSE_LABEL[response.move.type] ?? 'a move' } : {}),
    });
  }

  return [...byMoment.values()].sort(
    (a, b) => MOMENT_ORDER.indexOf(a.moment) - MOMENT_ORDER.indexOf(b.moment),
  );
}

/** Reading order for a debrief: gather, interpret, contest, resolve. */
export const MOMENT_ORDER: TeamMoment[] = [
  'detail',
  'big-picture',
  'listening',
  'challenge',
  'conflict',
  'leadership',
  'synthesis',
  'decision',
];

/** What each moment is, in words a room will recognise about itself. */
export const MOMENT_LABEL: Record<TeamMoment, string> = {
  detail: 'Noticing the small thing',
  'big-picture': 'Seeing the pattern',
  listening: 'Hearing the quiet one',
  challenge: 'Pushing back',
  conflict: 'Disagreeing openly',
  leadership: 'Taking the wheel',
  synthesis: 'Putting it together',
  decision: 'Committing',
};

/** What its absence tends to mean, for the facilitator's debrief. */
export const MOMENT_ABSENT: Record<TeamMoment, string> = {
  detail: 'Nobody slowed down for the small, specific thing. Fast rooms skip this and pay later.',
  'big-picture':
    'Nobody stepped back to name the pattern. The room worked the pieces and never the shape.',
  listening:
    'The quietest evidence never reached the table. Somebody was holding it, and was not asked.',
  challenge: 'No one pushed back on a reading. Agreement arrived without being tested.',
  conflict: 'Nothing was openly disagreed with. That is rarely because everyone agreed.',
  leadership: 'No one took the wheel when a call was needed. The room waited.',
  synthesis: 'The pieces never got assembled out loud by anybody.',
  decision: 'The room never committed to anything before it had to.',
};
