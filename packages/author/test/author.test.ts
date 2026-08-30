/**
 * The pipeline, tested against a stub model.
 *
 * The point is not that a real model writes well — nothing here can prove that,
 * and a human review gate exists because nothing can. The point is that the
 * machinery around it holds: the arithmetic survives a re-skin, the validator
 * catches a bad draft, and the repair loop feeds the complaints back.
 */
import { describe, expect, it } from 'vitest';
import { blackwoodHall, validateCase, DECO_1920S_CHARACTERS } from '@tmv/core';
import { applySkeleton, describeSkeleton, extractSkeleton } from '../src/skeleton.js';
import { draftCase, type Model } from '../src/draft.js';
import { serialiseCase } from '../src/serialise.js';
import { artSheet } from '../src/artsheet.js';

const skeleton = extractSkeleton(blackwoodHall);

/** A stub that returns whatever the caller has queued for each stage. */
function stubModel(
  responses: Record<string, unknown>,
  seen: string[] = [],
): { model: Model; seen: string[]; prompts: string[] } {
  const prompts: string[] = [];
  const model: Model = ({ label, input }) => {
    seen.push(label);
    prompts.push(input);
    const key = label.startsWith('repair') ? 'repair' : label;
    return Promise.resolve(responses[key] as Record<string, unknown>);
  };
  return { model, seen, prompts };
}

const cast = (n: number) => ({
  setting: 'A lighthouse on the Cornish coast, winter 1931.',
  synopsis: 'The keeper is dead and the boat will not come until morning.',
  victim: { name: 'Silas Vane', description: 'The keeper.', discovery: 'At the lamp room stair.' },
  suspects: Array.from({ length: n }, (_, i) => ({
    name: `Person ${String(i + 1)}`,
    publicBio: 'Aboard for the winter.',
    persona: 'Guarded.',
    voice: ['alloy', 'ash', 'ballad', 'coral', 'echo'][i] ?? 'alloy',
    voiceDirection: 'Low and slow.',
    portraitPrompt: `Oil portrait of a man, 4${String(i)}, lighthouse keeper, weathered, wary. Warm lamplight, umber ground. Rectangular, fills frame, no white`,
  })),
});

/** Clue prose that matches the job list well enough to pass. */
const goodClues = {
  clues: skeleton.clues.map((c) => ({
    title: `Exhibit ${String(c.index + 1)}`,
    text:
      c.exonerates.length > 0
        ? `A record placing others elsewhere. It rules out ${String(c.exonerates.length)} of them.`
        : 'A small object, out of place.',
  })),
};

const knowledge = {
  suspects: Array.from({ length: skeleton.suspectCount }, () => ({
    knowledge: { knows: ['the boat is late'], believes: [], hides: [], liesAbout: [] },
    answerBank: [{ topics: ['where'], answer: 'I was in the lamp room.' }],
  })),
};

const dressing = {
  title: 'The Light at Vane Point',
  prologueBeats: Array.from(
    { length: skeleton.prologueBeats },
    (_, i) => `The sea rose, and the boat did not come. Beat ${String(i + 1)}.`,
  ),
  acts: [1, 2, 3].map((i) => ({
    title: `Act ${String(i)}`,
    opening: 'The lamp turns.',
    commitmentPrompt: 'Who?',
    commitmentKind: 'suspect' as const,
    commitmentOptions: [],
  })),
  solution: {
    motive: 'An old debt.',
    method: 'Pushed on the stair.',
    narrative: 'The evidence was there from the first night.',
    forbiddenFacts: ['Person 3 killed the keeper'],
  },
};

describe('the skeleton', () => {
  it('keeps the arithmetic and drops every word of prose', () => {
    const text = JSON.stringify(skeleton);
    for (const word of ['Blackwood', 'Cross', 'Ashworth', 'staircase', 'diary'])
      expect(text, `skeleton leaked "${word}"`).not.toContain(word);
    expect(skeleton.suspectCount).toBe(blackwoodHall.suspects.length);
    expect(skeleton.clues).toHaveLength(blackwoodHall.clues.length);
    expect(skeleton.clues.filter((c) => c.probative)).toHaveLength(
      blackwoodHall.solution.provenBy.length,
    );
  });

  it('names suspects only by number in the brief it writes', () => {
    const brief = describeSkeleton(skeleton);
    for (const s of blackwoodHall.suspects) expect(brief).not.toContain(s.name);
    expect(brief).toContain('suspect 3 is the culprit'.replace('suspect', 'Suspect'));
  });

  it('round-trips: reassembling Blackwood Hall onto its own skeleton still validates', () => {
    const rebuilt = applySkeleton(skeleton, {
      id: blackwoodHall.id,
      title: blackwoodHall.title,
      setting: blackwoodHall.setting,
      synopsis: blackwoodHall.synopsis,
      victim: blackwoodHall.victim,
      suspects: blackwoodHall.suspects.map((s, i) => ({ ...s, id: `s${String(i + 1)}` })),
      characters: blackwoodHall.characters,
      acts: blackwoodHall.acts,
      clues: blackwoodHall.clues.map((c, i) => ({
        id: `c${String(i + 1)}`,
        title: c.title,
        text: c.text,
      })),
      solution: blackwoodHall.solution,
    });
    expect(validateCase(rebuilt)).toEqual([]);
  });
});

describe('drafting', () => {
  const opts = {
    skeleton,
    brief: 'a Cornish lighthouse, winter 1931',
    characters: DECO_1920S_CHARACTERS,
  };

  it('produces a case that validates, from prose alone', async () => {
    const { model, seen } = stubModel({
      cast: cast(skeleton.suspectCount),
      clues: goodClues,
      knowledge,
      dressing,
    });
    const { pack, issues, attempts } = await draftCase({ ...opts, model });
    expect(issues).toEqual([]);
    expect(attempts).toBe(1);
    expect(seen).toEqual(['cast', 'clues', 'knowledge', 'dressing']);
    expect(pack.title).toBe('The Light at Vane Point');
    expect(pack.solution.culpritId).toBe(`s${String(skeleton.culpritIndex + 1)}`);
    expect(pack.prologue?.beats).toHaveLength(skeleton.prologueBeats);
  });

  it('never shows the clue-writing stage who the culprit is', async () => {
    const { model, prompts } = stubModel({
      cast: cast(skeleton.suspectCount),
      clues: goodClues,
      knowledge,
      dressing,
    });
    await draftCase({ ...opts, model });
    const cluePrompt = prompts[1] ?? '';
    expect(cluePrompt).toContain('is the culprit');
    // by number, never by the name it just invented
    expect(cluePrompt).not.toContain('Person 3 is the culprit');
  });

  it('rejects a draft whose evidence proves nothing, and says why', async () => {
    const { model } = stubModel({
      cast: cast(skeleton.suspectCount),
      clues: goodClues,
      knowledge,
      dressing: { ...dressing, prologueBeats: [] },
    });
    const { issues } = await draftCase({ ...opts, model, maxRepairs: 0 });
    expect(issues.map((i) => i.rule)).toContain('prologue-empty');
  });

  it('hands the validator’s complaints back and accepts the repair', async () => {
    let call = 0;
    const model: Model = ({ label, input }) => {
      if (label === 'cast') return Promise.resolve(cast(skeleton.suspectCount));
      if (label === 'knowledge') return Promise.resolve(knowledge);
      if (label === 'dressing') return Promise.resolve(dressing);
      call++;
      // First pass writes an act-1 clue that names the culprit; the repair sees
      // the complaint and fixes it.
      if (call === 1) {
        const bad = structuredClone(goodClues);
        bad.clues[0] = { title: 'A Note', text: 'Signed by Person 3, left on the stair.' };
        return Promise.resolve(bad);
      }
      expect(input).toContain('act1-spoiler');
      return Promise.resolve(goodClues);
    };
    const { issues, attempts } = await draftCase({ ...opts, model });
    expect(issues).toEqual([]);
    expect(attempts).toBe(2);
  });
});

describe('serialising', () => {
  it('writes a module that carries the review checklist and the draft warning', async () => {
    const { model } = stubModel({
      cast: cast(skeleton.suspectCount),
      clues: goodClues,
      knowledge,
      dressing,
    });
    const { pack } = await draftCase({
      skeleton,
      brief: 'a Cornish lighthouse',
      characters: DECO_1920S_CHARACTERS,
      model,
    });
    const src = serialiseCase(pack, 'a Cornish lighthouse', 'lighthouse');
    expect(src).toContain('DRAFTED, NOT YET PUBLISHED');
    expect(src).toContain('Review checklist');
    expect(src).toContain('export const lighthouse: CasePack');
    // the shared role pool is referenced, not inlined twenty times over
    expect(src).toContain('characters: DECO_1920S_CHARACTERS');
    expect(src).not.toContain('The Retired Inspector');
  });

  it('escapes the apostrophes and quotes the prose is full of', () => {
    const nasty = "A Keeper's Tale — \\ and a line\nbreak";
    const src = serialiseCase({ ...blackwoodHall, title: nasty }, 'brief', 'x');

    // Pull the emitted literal back out and unescape it: what goes in comes out.
    const line = src.split('\n').find((l) => l.trim().startsWith('title:')) ?? '';
    const literal = line.slice(line.indexOf("'"), line.lastIndexOf("'") + 1);
    const decoded = literal
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
    expect(decoded).toBe(nasty);

    // And every apostrophe inside really is escaped, so the file still parses.
    const body = literal.slice(1, -1);
    expect(body.replace(/\\'/g, '')).not.toContain("'");
  });
});

describe('the art sheet', () => {
  it('orders a portrait per suspect plus the victim, on the paths the case expects', async () => {
    const { model } = stubModel({
      cast: cast(skeleton.suspectCount),
      clues: goodClues,
      knowledge,
      dressing,
    });
    const { pack, art } = await draftCase({
      skeleton,
      brief: 'a Cornish lighthouse',
      characters: DECO_1920S_CHARACTERS,
      ...(blackwoodHall.theme ? { theme: blackwoodHall.theme } : {}),
      model,
    });
    expect(art).toHaveLength(skeleton.suspectCount);

    const sheet = artSheet(pack, art);
    for (const s of pack.suspects) {
      expect(sheet).toContain(s.name);
      // the path in the sheet is the path the case already points at
      expect(sheet).toContain(`art/${pack.id}/cast/${s.id}.jpg`);
      expect(s.portraitAsset).toBe(`/art/${pack.id}/cast/${s.id}.jpg`);
    }
    expect(sheet).toContain(pack.victim.name);
    expect(sheet).toContain('Never write "candlelit"');
    // the theme is inherited, so no scenes to draw
    expect(sheet).toContain('Nothing to generate');
  });

  it('keeps every prompt inside the generator’s 200-character limit', async () => {
    const { model } = stubModel({
      cast: cast(skeleton.suspectCount),
      clues: goodClues,
      knowledge,
      dressing,
    });
    const { pack, art } = await draftCase({
      skeleton,
      brief: 'a Cornish lighthouse',
      characters: DECO_1920S_CHARACTERS,
      model,
    });
    for (const p of art) expect(p.prompt.length, p.name).toBeLessThanOrEqual(200);
    const sheet = artSheet(pack, art);
    const inFences = [...sheet.matchAll(/```\n([^`]+)\n```/g)].map((m) => m[1]!);
    for (const p of inFences.filter((t) => t.startsWith('Oil portrait')))
      expect(p.length).toBeLessThanOrEqual(200);
  });
});
