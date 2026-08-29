import { describe, expect, it } from 'vitest';
import { blackwoodHall, validateCase } from '../src/index.js';

describe('Death at Blackwood Hall', () => {
  it('passes the D17 publication gate', () => {
    expect(validateCase(blackwoodHall)).toEqual([]);
  });

  it('never places the solution inside any suspect knowledge sheet (D13)', () => {
    for (const s of blackwoodHall.suspects) {
      const sheet = [
        ...s.knowledge.knows,
        ...s.knowledge.believes,
        ...s.knowledge.hides,
        ...s.knowledge.liesAbout.map((l) => l.lie),
      ];
      // No forbidden fact may appear verbatim in any sheet,
      // and no sheet sentence may attribute the killing to the culprit.
      for (const fact of blackwoodHall.solution.forbiddenFacts) {
        expect(sheet.join(' ')).not.toContain(fact);
      }
      for (const line of sheet) {
        expect(/cross/i.test(line) && /push|kill|murder/i.test(line)).toBe(false);
      }
    }
  });
});
