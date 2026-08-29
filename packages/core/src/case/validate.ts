import type { CasePack, TeamMoment } from './types.js';
import { dealClues, keyHolderCount } from './deal.js';

export interface ValidationIssue {
  rule: string;
  message: string;
}

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;

const ALL_MOMENTS: TeamMoment[] = [
  'detail',
  'big-picture',
  'challenge',
  'leadership',
  'listening',
  'conflict',
  'synthesis',
  'decision',
];

/**
 * D17 publication gate. A case may only be published when this returns [].
 */
export function validateCase(pack: CasePack): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fail = (rule: string, message: string) => issues.push({ rule, message });

  const clueIds = new Set(pack.clues.map((c) => c.id));
  if (clueIds.size !== pack.clues.length) fail('unique-ids', 'duplicate clue ids');

  // Exactly one solution, and it points at real things.
  if (!pack.suspects.some((s) => s.id === pack.solution.culpritId))
    fail('solution-culprit', `culprit ${pack.solution.culpritId} is not a suspect`);
  for (const id of pack.solution.provenBy)
    if (!clueIds.has(id)) fail('solution-clues', `provenBy references unknown clue ${id}`);
  if (pack.solution.provenBy.length < 3)
    fail('solution-depth', 'solution must rest on at least 3 clues');
  if (pack.solution.forbiddenFacts.length === 0)
    fail('forbidden-facts', 'forbiddenFacts must not be empty');

  // Every act-dealt key clue exists and no orphan clues (each clue is key, proves, or feeds a moment).
  for (const clue of pack.clues) {
    if (!clue.key && !clue.moment && !pack.solution.provenBy.includes(clue.id))
      fail('orphan-clue', `clue ${clue.id} is neither key, nor a moment, nor probative`);
  }

  // All eight designed team moments present (D17).
  const moments = new Set(pack.clues.map((c) => c.moment).filter(Boolean));
  for (const m of ALL_MOMENTS)
    if (!moments.has(m)) fail('team-moments', `no clue carries the '${m}' moment`);

  // Cast covers the head count.
  if (pack.characters.length < MAX_PLAYERS)
    fail(
      'cast-size',
      `need >= ${String(MAX_PLAYERS)} player characters, have ${String(pack.characters.length)}`,
    );

  // Suspects are interrogable and contained.
  for (const s of pack.suspects) {
    if (s.knowledge.knows.length === 0) fail('suspect-knows', `${s.id} knows nothing`);
    if (s.answerBank.length === 0) fail('answer-bank', `${s.id} has no banked answers (D15)`);
  }

  // Deal fairness across every legal head count (D16/D17).
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    for (const seed of [1, 2, 3, 4, 5]) {
      // Hands accumulate across acts (D5/D16): judge fairness on the full game's deal.
      const deal = {
        hands: ([1, 2, 3] as const)
          .map((act) => dealClues(pack, n, seed, act))
          .reduce(
            (acc, d) => acc.map((hand, i) => [...hand, ...(d.hands[i] ?? [])]),
            Array.from({ length: n }, (): string[] => []),
          ),
      };
      const holders = keyHolderCount(pack, deal);
      if (holders < pack.deal.minKeyHolders)
        fail(
          'deal-spread',
          `n=${String(n)} seed=${String(seed)}: key clues held by ${String(holders)} < ${String(pack.deal.minKeyHolders)} players`,
        );
      if (deal.hands.some((h) => h.length === 0))
        fail(
          'deal-empty-hand',
          `n=${String(n)} seed=${String(seed)}: a player would start with no clues`,
        );
      const proven = new Set(pack.solution.provenBy);
      if (
        deal.hands.some(
          (h) => pack.solution.provenBy.every((id) => new Set(h).has(id)) && proven.size > 0,
        )
      )
        fail(
          'deal-lone-solver',
          `n=${String(n)} seed=${String(seed)}: one player would hold the whole solution`,
        );
    }
  }

  return issues;
}
