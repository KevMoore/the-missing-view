/**
 * PRD §19 singles out one number as "particularly important". These tests are
 * mostly about not lying with the others: a missing measurement must read as
 * missing, not as zero.
 */
import { describe, expect, it } from 'vitest';
import {
  computeInsights,
  readSurprise,
  type DebriefRow,
  type SessionRow,
} from '../src/reveal/insights.js';

const session = (metrics: Record<string, unknown>): SessionRow => ({
  metrics,
  finishedAt: '2026-08-30T12:00:00.000Z',
});
const answer = (over: Partial<DebriefRow> = {}): DebriefRow => ({
  knewBefore: 'no',
  sawSomething: true,
  playAgain: true,
  at: '2026-08-30T12:00:00.000Z',
  ...over,
});

describe('insights', () => {
  it('reports nothing rather than zero when there is nothing', () => {
    const i = computeInsights([], []);
    expect(i.sessions).toBe(0);
    expect(i.surprisedPct).toBeNull();
    expect(i.medianMinutes).toBeNull();
    expect(i.solvedPct).toBeNull();
    expect(i.changes).toEqual([]);
  });

  it('computes the headline share across the three answers', () => {
    const i = computeInsights(
      [],
      [
        answer({ knewBefore: 'no' }),
        answer({ knewBefore: 'no' }),
        answer({ knewBefore: 'suspected' }),
        answer({ knewBefore: 'yes' }),
      ],
    );
    expect(i.surprisedPct).toBe(50);
    expect(i.suspectedPct).toBe(25);
    expect(i.knewPct).toBe(25);
  });

  it('uses a median, so one abandoned session does not drag the length', () => {
    const i = computeInsights(
      [
        session({ durationMinutes: 48 }),
        session({ durationMinutes: 52 }),
        session({ durationMinutes: 3 }),
      ],
      [],
    );
    expect(i.medianMinutes).toBe(48);
  });

  it('ignores metrics rows that are missing or the wrong shape', () => {
    const i = computeInsights(
      [session({}), session({ durationMinutes: 'ages' }), session({ durationMinutes: 40 })],
      [],
    );
    expect(i.medianMinutes).toBe(40);
    expect(i.sessions).toBe(3);
  });

  it('counts completion and solving separately, because they are not the same thing', () => {
    const i = computeInsights(
      [
        session({ reachedReveal: true, solved: false }),
        session({ reachedReveal: true, solved: true }),
        session({ reachedReveal: false, solved: false }),
      ],
      [],
    );
    expect(i.completionPct).toBe(67);
    expect(i.solvedPct).toBe(33);
  });

  it('keeps only the free text people actually wrote', () => {
    const i = computeInsights(
      [],
      [
        answer({ willChange: 'Ask the quiet one first.' }),
        answer({ willChange: '   ' }),
        answer({ willChange: null }),
        answer(),
      ],
    );
    expect(i.changes).toHaveLength(1);
    expect(i.changes[0]?.text).toBe('Ask the quiet one first.');
  });

  it('sums the moments the rooms walked past', () => {
    const i = computeInsights(
      [session({ momentsPassedOver: 2 }), session({ momentsPassedOver: 1 }), session({})],
      [],
    );
    expect(i.totalPassedOver).toBe(3);
  });
});

describe('reading the headline', () => {
  const withAnswers = (n: number, surprised: number) =>
    computeInsights(
      [],
      Array.from({ length: n }, (_, i) => answer({ knewBefore: i < surprised ? 'no' : 'yes' })),
    );

  it('refuses to read anything into a handful of answers', () => {
    expect(readSurprise(withAnswers(6, 6))).toContain('too few');
  });

  it('says so when the surprise is landing', () => {
    expect(readSurprise(withAnswers(20, 16))).toContain('proposition working');
  });

  it('points upstream when most people already knew', () => {
    expect(readSurprise(withAnswers(20, 2))).toContain('giving it away');
  });

  it('says nothing at all before anyone has answered', () => {
    expect(readSurprise(computeInsights([], []))).toBe('No answers yet.');
  });
});
