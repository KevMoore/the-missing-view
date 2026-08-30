import { describe, expect, it } from 'vitest';
import { blackwoodHall } from '@tmv/core';
import { askSuspect, bankedAnswer, violatesForbiddenFacts } from '../src/llm.js';

describe('forbidden-facts containment (D13)', () => {
  it('flags a reply that states the solution', () => {
    expect(
      violatesForbiddenFacts(
        blackwoodHall,
        'It was Miss Cross — she pushed Sir Edmund down the stairs!',
      ),
    ).toBe(true);
  });

  it('flags a paraphrased confession', () => {
    expect(
      violatesForbiddenFacts(blackwoodHall, 'Evelyn Cross killed Sir Edmund, I am sure of it.'),
    ).toBe(true);
  });

  it('passes an ordinary in-character evasion', () => {
    expect(
      violatesForbiddenFacts(blackwoodHall, 'I retired at eleven. The accounts keep long hours.'),
    ).toBe(false);
  });

  it('passes a reply that mentions the victim without the solution', () => {
    expect(
      violatesForbiddenFacts(
        blackwoodHall,
        'Sir Edmund quarrelled with the Captain at ten, I heard it plainly.',
      ),
    ).toBe(false);
  });
});

describe('banked answers (D15)', () => {
  const reeves = blackwoodHall.suspects.find((s) => s.id === 's-reeves')!;

  it('matches on topic keywords', () => {
    expect(bankedAnswer(reeves, 'Were the doors locked that night?')).toContain('bolted');
  });

  it('falls back to a deflection on an unmatched question', () => {
    const answer = bankedAnswer(reeves, 'What is your favourite colour?');
    expect(answer.length).toBeGreaterThan(0);
  });

  it('askSuspect serves the bank when no API key is configured', async () => {
    // Test env has no OPENAI_API_KEY: the fallback path must fully work.
    const { answer, fromBank } = await askSuspect(
      blackwoodHall,
      's-reeves',
      'Who holds keys to the study?',
      [],
    );
    expect(fromBank).toBe(true);
    expect(answer).toContain('key');
  });

  it('askSuspect never answers for an unknown suspect', async () => {
    const { answer, fromBank } = await askSuspect(blackwoodHall, 'nobody', 'Hello?', []);
    expect(fromBank).toBe(true);
    expect(answer).toContain('no such person');
  });
});
