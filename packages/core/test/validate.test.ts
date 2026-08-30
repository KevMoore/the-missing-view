import { describe, expect, it } from 'vitest';
import { validateCase, type CasePack } from '../src/index.js';
import { testCase, testSuspect } from './fixtures.js';

describe('validateCase', () => {
  it('passes a well-formed case', () => {
    expect(validateCase(testCase())).toEqual([]);
  });

  it('rejects a culprit who is not in the cast', () => {
    const pack = testCase();
    pack.solution.culpritId = 'nobody';
    expect(validateCase(pack).map((i) => i.rule)).toContain('solution-culprit');
  });

  it('rejects a solution resting on fewer than 3 clues', () => {
    const pack = testCase();
    pack.solution.provenBy = ['c1'];
    expect(validateCase(pack).map((i) => i.rule)).toContain('solution-depth');
  });

  it('rejects a missing team moment', () => {
    const pack = testCase();
    pack.clues = pack.clues.map((c) => (c.moment === 'listening' ? { ...c, moment: 'detail' } : c));
    expect(validateCase(pack).map((i) => i.rule)).toContain('team-moments');
  });

  it('rejects a suspect with no banked answers', () => {
    const pack = testCase();
    pack.suspects[1] = testSuspect('s2', { answerBank: [] });
    expect(validateCase(pack).map((i) => i.rule)).toContain('answer-bank');
  });

  it('rejects empty forbiddenFacts', () => {
    const pack = testCase();
    pack.solution.forbiddenFacts = [];
    expect(validateCase(pack).map((i) => i.rule)).toContain('forbidden-facts');
  });

  it('rejects an orphan clue', () => {
    const pack = testCase();
    pack.clues.push({ id: 'cx', title: 'Loose end', text: '?', key: false, act: 1 });
    expect(validateCase(pack).map((i) => i.rule)).toContain('orphan-clue');
  });
});

describe('provability (D27)', () => {
  const rules = (pack: CasePack) => validateCase(pack).map((i) => i.rule);

  it('rejects a case whose proof leaves more than one suspect standing', () => {
    // Reads as damning, proves nothing: nobody is ever ruled out.
    const pack = testCase();
    for (const c of pack.clues) delete c.exonerates;
    expect(rules(pack)).toContain('solution-unique');
  });

  it('rejects a case whose proof rules out the culprit', () => {
    const pack = testCase();
    pack.clues[0]!.exonerates = ['s2'];
    expect(rules(pack)).toContain('clue-contradiction');
  });

  it('rejects a clue that hands over the answer on its own', () => {
    const pack = testCase();
    pack.clues[0]!.exonerates = ['s1', 's3'];
    expect(rules(pack)).toContain('clue-giveaway');
  });

  it('rejects a clue sitting in the proof doing no work', () => {
    const pack = testCase();
    delete pack.clues[2]!.implicates;
    expect(rules(pack)).toContain('clue-idle');
  });

  it('rejects a clue naming a suspect the case does not have', () => {
    const pack = testCase();
    pack.clues[3]!.implicates = ['s99'];
    expect(rules(pack)).toContain('clue-cast');
  });

  it('rejects a deal that lets one player rule out everyone alone', () => {
    // The spread keeps probative clues on separate seats, so the real hazard is
    // a clue outside the designated proof that quietly rules someone out. Two of
    // those in one hand and that player can name the culprit unaided.
    const pack = testCase({ deal: { neverSameHolder: [], minKeyHolders: 3 } });
    for (const i of [3, 4, 5, 6]) pack.clues[i]!.exonerates = ['s1'];
    for (const i of [7, 8, 9, 10]) pack.clues[i]!.exonerates = ['s3'];
    expect(rules(pack)).toContain('deal-lone-solver');
  });
});

describe('spoilers (D26)', () => {
  const rules = (pack: CasePack) => validateCase(pack).map((i) => i.rule);

  it('rejects an act 1 clue that names the culprit', () => {
    const pack = testCase();
    pack.clues[4]!.text = 'A note signed by Suspect s2 was found on the stairs.';
    expect(rules(pack)).toContain('act1-spoiler');
  });

  it('rejects an opening that names the culprit', () => {
    const pack = testCase({
      prologue: { beats: [{ text: 'Suspect s2 climbed the stairs at midnight.' }] },
    });
    expect(rules(pack)).toContain('prologue-spoiler');
  });

  it('accepts an opening that sets the scene without answering it', () => {
    const pack = testCase({
      prologue: { beats: [{ text: 'The road closed at dusk. Eleven sat down to dinner.' }] },
    });
    expect(rules(pack)).not.toContain('prologue-spoiler');
    expect(validateCase(pack)).toEqual([]);
  });
});
