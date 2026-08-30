/**
 * Draft a case against a skeleton, then hand it to the validator and make the
 * model fix what it broke.
 *
 * Split into stages because one call asked to invent a house, cast it, write
 * eighteen clues that each do a specific logical job, brief five suspects
 * without telling any of them the answer, and narrate an opening will do all of
 * it adequately and none of it well. Each stage sees only what it needs, which
 * also keeps the solution out of the prompts that must never contain it (D13).
 */
import type { CasePack } from '@tmv/core';
import { validateCase } from '@tmv/core';
import { applySkeleton, describeSkeleton, type FilledCase, type Skeleton } from './skeleton.js';
import { CAST_SCHEMA, CLUES_SCHEMA, DRESSING_SCHEMA, KNOWLEDGE_SCHEMA } from './schemas.js';

/** Anything that turns a prompt plus a JSON schema into an object. */
export type Model = (args: {
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  label: string;
}) => Promise<Record<string, unknown>>;

export interface DraftOptions {
  skeleton: Skeleton;
  /** What the author wants: "a Cornish lighthouse, 1931", "a Cairo dig, 1928". */
  brief: string;
  /** Reused wholesale — a theme is coarser than a case, so its art may be shared. */
  theme?: CasePack['theme'];
  /** Player roles come from the theme's pool rather than being invented per case. */
  characters: CasePack['characters'];
  model: Model;
  /** How many times to hand the validator's complaints back. */
  maxRepairs?: number;
  onProgress?: (message: string) => void;
}

export interface DraftResult {
  pack: CasePack;
  issues: ReturnType<typeof validateCase>;
  attempts: number;
  /** Portrait prompts for the cast the model actually wrote. */
  art: { suspectId: string; name: string; prompt: string }[];
}

const HOUSE_STYLE = [
  'You are writing a murder mystery played by a room of colleagues in one hour.',
  'Period detail must be concrete and correct. No anachronisms.',
  'Prose is spare and physical. A clue is an object, a record, or something a named person saw.',
  'Never write "clearly", "obviously", or "it seems". State what is there.',
  'British English.',
].join(' ');

export async function draftCase(opts: DraftOptions): Promise<DraftResult> {
  const { skeleton, brief, model, onProgress = () => undefined } = opts;
  const n = skeleton.suspectCount;

  // 1. The house and the people in it. The model is not told who did it — it is
  //    told which numbered suspect it is writing, and the rest follows.
  onProgress('casting');
  const cast = (await model({
    label: 'cast',
    schema: CAST_SCHEMA,
    instructions: `${HOUSE_STYLE} Invent the setting, the victim and exactly ${String(n)} suspects.`,
    input: [
      `Brief: ${brief}`,
      `Write exactly ${String(n)} suspects, in order, so that suspect ${String(skeleton.culpritIndex + 1)} is the one who did it.`,
      'Give every suspect a reason to be there, a reason to look guilty, and a distinct voice.',
      'voiceDirection describes how they SOUND — sex, rough age, accent and class, pace, pitch, delivery.',
      'persona describes how they PHRASE things. They are different fields; do not repeat one in the other.',
      'Spread the voices: do not write five polite middle-aged people.',
      'Assign each suspect a different voice id from: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer.',
    ].join('\n'),
  })) as unknown as CastDraft;

  // 2. The evidence. This is the stage that must obey the arithmetic, so it gets
  //    the skeleton as a job list and nothing else to distract it.
  onProgress('writing the evidence');
  const clues = (await model({
    label: 'clues',
    schema: CLUES_SCHEMA,
    instructions: `${HOUSE_STYLE} Write the evidence. Each clue must do exactly the job listed against it — that is not a suggestion, it is the puzzle.`,
    input: [
      `Setting: ${cast.setting}`,
      `Victim: ${cast.victim.name} — ${cast.victim.description}`,
      ...cast.suspects.map((s, i) => `Suspect ${String(i + 1)}: ${s.name} — ${s.publicBio}`),
      '',
      describeSkeleton(skeleton),
    ].join('\n'),
  })) as unknown as { clues: { title: string; text: string }[] };

  // 3. Each suspect's sheet, written from their own side of the evidence. The
  //    culprit's sheet gets a denial and never a confession (D13).
  onProgress('briefing the suspects');
  const knowledge = (await model({
    label: 'knowledge',
    schema: KNOWLEDGE_SCHEMA,
    instructions: `${HOUSE_STYLE} Write what each suspect knows, believes, hides and lies about, plus banked answers used when the model is unreachable.`,
    input: [
      ...cast.suspects.map((s, i) => `Suspect ${String(i + 1)}: ${s.name} — ${s.publicBio}`),
      '',
      'The evidence in play:',
      ...clues.clues.map((c, i) => `  ${String(i + 1)}. ${c.title}: ${c.text}`),
      '',
      `Suspect ${String(skeleton.culpritIndex + 1)} is guilty. Their sheet must contain a denial and never a confession, and must not state the solution in any form.`,
      'Every other suspect is innocent and has something unrelated to hide.',
      'Banked answers are what this character says when asked about a topic; three to five each.',
    ].join('\n'),
  })) as unknown as KnowledgeDraft;

  // 4. The frame: acts, the narrated opening, and the reveal.
  onProgress('the opening and the reveal');
  const dressing = (await model({
    label: 'dressing',
    schema: DRESSING_SCHEMA,
    instructions: `${HOUSE_STYLE} Write the title, the acts, the narrated opening and the solution.`,
    input: [
      `Setting: ${cast.setting}`,
      `Victim: ${cast.victim.name} — ${cast.victim.description}`,
      `The culprit is ${cast.suspects[skeleton.culpritIndex]?.name ?? 'suspect'}.`,
      '',
      'The evidence:',
      ...clues.clues.map((c, i) => `  ${String(i + 1)}. ${c.title}: ${c.text}`),
      '',
      `Write exactly ${String(skeleton.prologueBeats)} opening beats, one sentence or two each, about eight seconds spoken.`,
      'The opening sets the scene and the stakes. It MUST NOT name the culprit or hint at them.',
      `Act minutes are fixed at ${skeleton.actMinutes.join(', ')}.`,
      'forbiddenFacts are the sentences a suspect must never say aloud — the solution, stated several ways.',
    ].join('\n'),
  })) as unknown as DressingDraft;

  let filled = assemble(opts, cast, clues.clues, knowledge, dressing);
  let pack = applySkeleton(skeleton, filled);
  let issues = validateCase(pack);
  let attempts = 1;

  // 5. Hand the complaints back. The validator is specific, so this converges.
  const maxRepairs = opts.maxRepairs ?? 3;
  while (issues.length > 0 && attempts <= maxRepairs) {
    onProgress(`repairing (${String(issues.length)} issues, attempt ${String(attempts)})`);
    const repaired = (await model({
      label: `repair-${String(attempts)}`,
      schema: CLUES_SCHEMA,
      instructions: `${HOUSE_STYLE} Your draft was rejected. Rewrite the evidence so every complaint is answered. Change as little as possible.`,
      input: [
        'Complaints:',
        ...issues.map((i) => `  [${i.rule}] ${i.message}`),
        '',
        'Your evidence:',
        ...filled.clues.map((c, i) => `  ${String(i + 1)}. ${c.title}: ${c.text}`),
        '',
        describeSkeleton(skeleton),
      ].join('\n'),
    })) as unknown as { clues: { title: string; text: string }[] };
    filled = assemble(opts, cast, repaired.clues, knowledge, dressing);
    pack = applySkeleton(skeleton, filled);
    issues = validateCase(pack);
    attempts++;
  }

  const art = cast.suspects.map((s, i) => ({
    suspectId: `s${String(i + 1)}`,
    name: s.name,
    prompt: s.portraitPrompt,
  }));
  return { pack, issues, attempts, art };
}

function assemble(
  opts: DraftOptions,
  cast: CastDraft,
  clues: { title: string; text: string }[],
  knowledge: KnowledgeDraft,
  dressing: DressingDraft,
): FilledCase {
  const id = slug(dressing.title);
  return {
    id,
    title: dressing.title,
    setting: cast.setting,
    synopsis: cast.synopsis,
    victim: { id: 'v1', ...cast.victim },
    suspects: cast.suspects.map((s, i) => ({
      id: `s${String(i + 1)}`,
      name: s.name,
      publicBio: s.publicBio,
      // The file the art step will write. Harmless until it exists: the screen
      // falls back to initials rather than a broken image.
      portraitAsset: `/art/${id}/cast/s${String(i + 1)}.jpg`,
      persona: s.persona,
      voice: s.voice,
      voiceDirection: s.voiceDirection,
      knowledge: knowledge.suspects[i]?.knowledge ?? {
        knows: [],
        believes: [],
        hides: [],
        liesAbout: [],
      },
      answerBank: knowledge.suspects[i]?.answerBank ?? [],
    })),
    characters: opts.characters,
    prologue: {
      voice: 'onyx',
      voiceDirection:
        'A deep, unhurried bass-baritone of about seventy. Immaculate diction, long pauses, ' +
        'a controlled relish in the darker words. Never loud.',
      beats: dressing.prologueBeats.map((text, i) => {
        const scene = opts.theme ? sceneFor(opts.theme, i) : undefined;
        return { text, ...(scene !== undefined ? { sceneAsset: scene } : {}) };
      }),
    },
    ...(opts.theme ? { theme: opts.theme } : {}),
    acts: dressing.acts.map((a, i) => ({
      number: (i + 1) as 1 | 2 | 3,
      title: a.title,
      minutes: opts.skeleton.actMinutes[i] ?? 15,
      opening: a.opening,
      commitment: {
        id: `a${String(i + 1)}`,
        prompt: a.commitmentPrompt,
        kind: a.commitmentKind,
        ...(a.commitmentOptions?.length
          ? {
              options: a.commitmentOptions.map((label, j) => ({
                id: `t${String(i + 1)}-${String(j + 1)}`,
                label,
              })),
            }
          : {}),
      },
    })) as FilledCase['acts'],
    clues: clues.map((c, i) => ({ id: `c${String(i + 1)}`, title: c.title, text: c.text })),
    solution: dressing.solution,
  };
}

/** Walk the theme's scenes so the opening is not eight copies of one painting. */
function sceneFor(theme: NonNullable<CasePack['theme']>, i: number): string | undefined {
  const scenes = Object.values(theme.scenes ?? {}).filter((v): v is string => Boolean(v));
  return scenes.length ? scenes[i % scenes.length] : undefined;
}

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

interface CastDraft {
  setting: string;
  synopsis: string;
  victim: { name: string; description: string; discovery: string; portraitAsset?: string };
  suspects: {
    name: string;
    publicBio: string;
    persona: string;
    voice: string;
    voiceDirection: string;
    portraitPrompt: string;
  }[];
}

interface KnowledgeDraft {
  suspects: {
    knowledge: {
      knows: string[];
      believes: string[];
      hides: string[];
      liesAbout: { topic: string; lie: string }[];
    };
    answerBank: { topics: string[]; answer: string }[];
  }[];
}

interface DressingDraft {
  title: string;
  prologueBeats: string[];
  acts: {
    title: string;
    opening: string;
    commitmentPrompt: string;
    commitmentKind: 'suspect' | 'theory';
    commitmentOptions?: string[];
  }[];
  solution: { motive: string; method: string; narrative: string; forbiddenFacts: string[] };
}
