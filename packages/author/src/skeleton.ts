/**
 * A case skeleton: everything that makes a mystery *work*, with every word of
 * prose removed.
 *
 * This is the whole trick behind drafting a case safely. The parts a model is
 * good at — a house, a cast, a motive, eighteen pieces of evidence that sound
 * like evidence — are the parts that do not have to be right. The parts that
 * have to be right are the shape of the deduction: which clue rules whom out,
 * which act it arrives in, what must not share a hand. Those are arithmetic,
 * and a model should not be asked to invent them while it is also trying to
 * write well.
 *
 * So we lift the arithmetic off a case that already validates, hand the model
 * only the prose, and reassemble. The result passes D17 and D27 by
 * construction rather than by luck, and the validator becomes a check on
 * craft rather than a coin toss.
 *
 * Suspects are referred to by index throughout, never by name — a skeleton
 * knows there are five people and that clue nine clears the second and fourth
 * of them. It does not know who they are, and must not.
 */
import type { CasePack, Clue, TeamMoment } from '@tmv/core';

export interface SkeletonClue {
  /** Position in the finished case's clue list. */
  index: number;
  act: 1 | 2 | 3;
  key: boolean;
  moment?: TeamMoment;
  /** True when this clue is part of `solution.provenBy`. */
  probative: boolean;
  /** Suspect indices this clue points at. */
  implicates: number[];
  /** Suspect indices this clue rules out. This is what carries the logic. */
  exonerates: number[];
}

export interface Skeleton {
  suspectCount: number;
  /** Which suspect, by index, did it. */
  culpritIndex: number;
  characterCount: number;
  clues: SkeletonClue[];
  /** Clue index pairs that must never land in one hand. */
  neverSameHolder: [number, number][];
  minKeyHolders: number;
  actMinutes: [number, number, number];
  /** How many beats the opening runs to. */
  prologueBeats: number;
}

/** Lift the arithmetic off a case that already validates. */
export function extractSkeleton(pack: CasePack): Skeleton {
  const suspectIndex = new Map(pack.suspects.map((s, i) => [s.id, i]));
  const clueIndex = new Map(pack.clues.map((c, i) => [c.id, i]));
  const probative = new Set(pack.solution.provenBy);
  const idx = (id: string): number => suspectIndex.get(id) ?? -1;

  return {
    suspectCount: pack.suspects.length,
    culpritIndex: idx(pack.solution.culpritId),
    characterCount: pack.characters.length,
    clues: pack.clues.map((c, index) => ({
      index,
      act: c.act,
      key: c.key,
      ...(c.moment ? { moment: c.moment } : {}),
      probative: probative.has(c.id),
      implicates: (c.implicates ?? []).map(idx).filter((i) => i >= 0),
      exonerates: (c.exonerates ?? []).map(idx).filter((i) => i >= 0),
    })),
    neverSameHolder: pack.deal.neverSameHolder.map(
      ([a, b]) => [clueIndex.get(a) ?? 0, clueIndex.get(b) ?? 0] as [number, number],
    ),
    minKeyHolders: pack.deal.minKeyHolders,
    actMinutes: [pack.acts[0].minutes, pack.acts[1].minutes, pack.acts[2].minutes] as [
      number,
      number,
      number,
    ],
    prologueBeats: pack.prologue?.beats.length ?? 0,
  };
}

/**
 * The skeleton as a brief a writer can act on, rather than as JSON.
 *
 * Each clue becomes an instruction about what it must *do*, because that is
 * the part that cannot be negotiated. A clue told to rule out suspects 1 and 4
 * has to contain something that genuinely rules them out; a clue told to rule
 * out nobody must not accidentally do so.
 */
export function describeSkeleton(s: Skeleton): string {
  const who = (i: number) => `suspect ${String(i + 1)}`;
  const lines: string[] = [
    `${String(s.suspectCount)} suspects, numbered 1 to ${String(s.suspectCount)}.`,
    `Suspect ${String(s.culpritIndex + 1)} is the culprit. No other suspect may be guilty.`,
    `${String(s.clues.length)} clues, numbered 1 to ${String(s.clues.length)}.`,
    '',
    'Each clue must do exactly the job listed against it:',
  ];
  for (const c of s.clues) {
    const jobs: string[] = [];
    if (c.exonerates.length)
      jobs.push(
        `must contain something that genuinely rules out ${c.exonerates.map(who).join(' and ')}`,
      );
    if (c.implicates.length)
      jobs.push(`should make ${c.implicates.map(who).join(' and ')} look worse`);
    if (!c.exonerates.length && !c.implicates.length)
      jobs.push('adds detail or atmosphere and must rule nobody in or out');
    if (c.probative) jobs.push('is part of the proof');
    lines.push(
      `  clue ${String(c.index + 1)} (act ${String(c.act)}${c.moment ? `, ${c.moment}` : ''}): ${jobs.join('; ')}`,
    );
  }
  lines.push(
    '',
    'Hard rules, in order of importance:',
    `1. No act 1 clue may name suspect ${String(s.culpritIndex + 1)}, and neither may the opening. Act 1 builds suspicion of the others.`,
    '2. A clue that rules someone out must say why in a way a player can check — an alibi across the time of death, a lock only some people hold a key to, a physical trace that cannot be theirs.',
    '3. No single clue may narrow the field to one person on its own.',
    '4. A clue that rules nobody out must not accidentally do so. Do not give a bystander an alibi by mistake.',
  );
  return lines.join('\n');
}

/** Reassemble a filled draft onto the skeleton's arithmetic. Prose in, logic kept. */
export function applySkeleton(skeleton: Skeleton, filled: FilledCase): CasePack {
  const suspectId = (i: number) => filled.suspects[i]?.id ?? `s${String(i + 1)}`;
  const clueId = (i: number) => filled.clues[i]?.id ?? `c${String(i + 1)}`;

  const clues: Clue[] = skeleton.clues.map((sk) => {
    const written = filled.clues[sk.index];
    return {
      id: clueId(sk.index),
      title: written?.title ?? `Clue ${String(sk.index + 1)}`,
      text: written?.text ?? '',
      key: sk.key,
      act: sk.act,
      ...(sk.moment ? { moment: sk.moment } : {}),
      ...(sk.implicates.length ? { implicates: sk.implicates.map(suspectId) } : {}),
      ...(sk.exonerates.length ? { exonerates: sk.exonerates.map(suspectId) } : {}),
    };
  });

  return {
    id: filled.id,
    title: filled.title,
    setting: filled.setting,
    synopsis: filled.synopsis,
    victim: filled.victim,
    suspects: filled.suspects,
    characters: filled.characters,
    ...(filled.prologue ? { prologue: filled.prologue } : {}),
    clues,
    acts: filled.acts,
    ...(filled.theme ? { theme: filled.theme } : {}),
    deal: {
      neverSameHolder: skeleton.neverSameHolder.map(
        ([a, b]) => [clueId(a), clueId(b)] as [string, string],
      ),
      minKeyHolders: skeleton.minKeyHolders,
    },
    solution: {
      culpritId: suspectId(skeleton.culpritIndex),
      motive: filled.solution.motive,
      method: filled.solution.method,
      provenBy: skeleton.clues.filter((c) => c.probative).map((c) => clueId(c.index)),
      narrative: filled.solution.narrative,
      forbiddenFacts: filled.solution.forbiddenFacts,
    },
  };
}

/** Everything a writer supplies. The arithmetic is not in here, on purpose. */
export interface FilledCase {
  id: string;
  title: string;
  setting: string;
  synopsis: string;
  victim: CasePack['victim'];
  suspects: CasePack['suspects'];
  characters: CasePack['characters'];
  prologue?: CasePack['prologue'];
  theme?: CasePack['theme'];
  acts: CasePack['acts'];
  clues: { id: string; title: string; text: string }[];
  solution: {
    motive: string;
    method: string;
    narrative: string;
    forbiddenFacts: string[];
  };
}
