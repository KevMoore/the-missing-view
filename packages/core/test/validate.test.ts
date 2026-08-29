import { describe, expect, it } from 'vitest';
import { validateCase } from '../src/index.js';
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
