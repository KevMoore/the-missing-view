import type { CasePack, Clue, TeamMoment } from './types.js';
import { dealClues, keyHolderCount } from './deal.js';

export interface ValidationIssue {
  rule: string;
  message: string;
}

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;

/** Honorifics are not identifying; "Miss Cross" must still trip the spoiler rules. */
const TITLES = new Set(['Miss', 'Lady', 'Lord', 'Mrs', 'Sir', 'Doctor', 'Captain', 'Count']);

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

  // ---- Is the case actually provable? (D27) ----
  //
  // Every other rule here checks shape. These check that the designated proof
  // identifies one person. A draft can satisfy everything else and still be a
  // pile of clues that reads as damning and proves nothing, which is precisely
  // the mistake a generated case makes.
  const suspectIds = pack.suspects.map((s) => s.id);
  const byId = new Map(pack.clues.map((c) => [c.id, c]));
  const probative = pack.solution.provenBy.map((id) => byId.get(id)).filter((c) => c !== undefined);

  /** Who is still standing once these clues have had their say. */
  const survivors = (clues: readonly Clue[]): string[] => {
    const out = new Set(suspectIds);
    for (const c of clues) for (const id of c.exonerates ?? []) out.delete(id);
    return [...out];
  };

  for (const c of pack.clues) {
    for (const id of [...(c.implicates ?? []), ...(c.exonerates ?? [])])
      if (!suspectIds.includes(id)) fail('clue-cast', `clue ${c.id} names unknown suspect ${id}`);
    if ((c.exonerates ?? []).includes(pack.solution.culpritId))
      fail('clue-contradiction', `clue ${c.id} exonerates the culprit`);
    for (const id of c.implicates ?? [])
      if ((c.exonerates ?? []).includes(id))
        fail('clue-contradiction', `clue ${c.id} both implicates and exonerates ${id}`);
  }

  const left = survivors(probative);
  if (left.length !== 1 || left[0] !== pack.solution.culpritId)
    fail(
      'solution-unique',
      `the proof leaves ${String(left.length)} suspect(s) standing (${left.join(', ')}); it must leave exactly the culprit`,
    );

  for (const c of probative) {
    // No single clue may hand over the answer.
    if (survivors([c]).length <= 1)
      fail('clue-giveaway', `clue ${c.id} identifies the culprit on its own`);
    // And no clue may sit in the proof doing nothing.
    if (
      (c.exonerates ?? []).length === 0 &&
      !(c.implicates ?? []).includes(pack.solution.culpritId)
    )
      fail(
        'clue-idle',
        `clue ${c.id} is in provenBy but neither rules anyone out nor points at the culprit`,
      );
  }

  // ---- The opening must not answer the question either (D26) ----
  const prologue = pack.prologue;
  if (prologue) {
    if (prologue.beats.length === 0) fail('prologue-empty', 'prologue has no beats');
    const culpritName = pack.suspects.find((s) => s.id === pack.solution.culpritId)?.name ?? '';
    const parts = culpritName.split(' ').filter((w) => w.length > 3 && !TITLES.has(w));
    for (const [i, beat] of prologue.beats.entries()) {
      if (!beat.text.trim()) fail('prologue-empty', `prologue beat ${String(i)} has no narration`);
      if (parts.some((w) => beat.text.includes(w)))
        fail('prologue-spoiler', `prologue beat ${String(i)} names the culprit`);
    }
  }

  // ---- Act 1 sets the question; it does not answer it (D26) ----
  {
    const culpritName = pack.suspects.find((s) => s.id === pack.solution.culpritId)?.name ?? '';
    const parts = culpritName.split(' ').filter((w) => w.length > 3 && !TITLES.has(w));
    for (const c of pack.clues.filter((c) => c.act === 1))
      if (parts.some((w) => c.text.includes(w)))
        fail('act1-spoiler', `act 1 clue ${c.id} names the culprit`);
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
      // Hands accumulate across acts (D5/D16), and each act is told what the
      // room already holds, so judge fairness on the full game's deal.
      let hands: string[][] = Array.from({ length: n }, () => []);
      for (const act of [1, 2, 3] as const) {
        const d = dealClues(pack, n, seed, act, hands);
        hands = hands.map((hand, i) => [...hand, ...(d.hands[i] ?? [])]);
      }
      const deal = { hands };
      const holders = keyHolderCount(pack, deal);
      if (holders < pack.deal.minKeyHolders)
        fail(
          'deal-spread',
          `n=${String(n)} seed=${String(seed)}: key clues held by ${String(holders)} < ${String(pack.deal.minKeyHolders)} players`,
        );
      // D17 as written: every player holds a fact that bears on the answer.
      // Only as many players as there are probative clues can, so the bar is
      // the smaller of the two — but it must be met exactly, or someone spends
      // the whole game holding nothing but red herrings.
      const reachable = Math.min(n, pack.solution.provenBy.length);
      if (holders < reachable)
        fail(
          'deal-every-player-matters',
          `n=${String(n)} seed=${String(seed)}: only ${String(holders)} of ${String(n)} players hold a probative clue; ${String(reachable)} could`,
        );
      if (deal.hands.some((h) => h.length === 0))
        fail(
          'deal-empty-hand',
          `n=${String(n)} seed=${String(seed)}: a player would start with no clues`,
        );
      // Not "holds every probative clue" — that is far too weak. A player who
      // holds enough to rule out everyone but the culprit can solve it alone
      // whether or not they hold the corroboration, and the whole game rests on
      // nobody being able to.
      for (const hand of deal.hands) {
        const held = hand.map((id) => byId.get(id)).filter((c) => c !== undefined);
        if (survivors(held).length <= 1)
          fail(
            'deal-lone-solver',
            `n=${String(n)} seed=${String(seed)}: one player holds enough to name the culprit alone`,
          );
      }
    }
  }

  return issues;
}
