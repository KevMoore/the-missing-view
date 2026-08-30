import { describe, expect, it } from 'vitest';
import { blackwoodHall, castCharacters, validateCase } from '../src/index.js';
import { DECO_1920S_CHARACTERS, DECO_1920S_SUSPECTS } from '../src/cast/deco-1920s.js';
import { createGame } from '../src/engine/engine.js';

const roster = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${String(i)}`, name: `P${String(i)}` }));

describe('the theme cast pool', () => {
  it('is big enough that a full table still leaves roles unused', () => {
    expect(DECO_1920S_CHARACTERS.length).toBeGreaterThan(8);
  });

  it('gives every role and every shell a unique id', () => {
    const ids = [...DECO_1920S_CHARACTERS, ...DECO_1920S_SUSPECTS].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('casts every suspect shell with a voice and a direction', () => {
    for (const shell of DECO_1920S_SUSPECTS) {
      expect(shell.voice, shell.name).toBeTruthy();
      expect(shell.voiceDirection, shell.name).toBeTruthy();
    }
  });

  it('spreads bot leanings, so a table of bots is not one personality', () => {
    const leans = new Set(DECO_1920S_CHARACTERS.map((c) => c.botLean));
    expect(leans.size).toBeGreaterThanOrEqual(5);
  });

  it('still publishes: the case validator is unmoved by the bigger pool', () => {
    expect(validateCase(blackwoodHall)).toEqual([]);
  });
});

describe('castCharacters', () => {
  it('replays exactly for the same seed', () => {
    expect(castCharacters(DECO_1920S_CHARACTERS, 6, 42)).toEqual(
      castCharacters(DECO_1920S_CHARACTERS, 6, 42),
    );
  });

  it('casts a different room for a different seed', () => {
    const a = castCharacters(DECO_1920S_CHARACTERS, 5, 1).map((c) => c.id);
    const b = castCharacters(DECO_1920S_CHARACTERS, 5, 2).map((c) => c.id);
    expect(a).not.toEqual(b);
  });

  it('never casts the same role twice at one table', () => {
    const ids = castCharacters(DECO_1920S_CHARACTERS, 8, 7).map((c) => c.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('reaches deep into the pool across many games, not just the first eight', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++)
      for (const c of castCharacters(DECO_1920S_CHARACTERS, 8, seed)) seen.add(c.id);
    expect(seen.size).toBe(DECO_1920S_CHARACTERS.length);
  });

  it('deals real characters into a real game', () => {
    const game = createGame(blackwoodHall, roster(5), 99);
    const ids = game.players.map((p) => p.characterId);
    expect(new Set(ids).size).toBe(5);
    for (const id of ids) expect(DECO_1920S_CHARACTERS.some((c) => c.id === id)).toBe(true);
  });
});

describe('casting the voices', () => {
  it('gives every suspect in the case a distinct voice', () => {
    const voices = blackwoodHall.suspects.map((s) => s.voice).filter(Boolean);
    expect(voices).toHaveLength(blackwoodHall.suspects.length);
    expect(new Set(voices).size).toBe(voices.length);
  });

  it('never lets the narrator share a voice with someone in the room', () => {
    const narrator = blackwoodHall.prologue?.voice;
    expect(narrator).toBeTruthy();
    expect(blackwoodHall.suspects.map((s) => s.voice)).not.toContain(narrator);
  });

  it('directs every suspect voice, so no two sound like the same person', () => {
    for (const s of blackwoodHall.suspects) {
      expect(s.voiceDirection, s.name).toBeTruthy();
      expect(s.voiceDirection, s.name).not.toBe(s.persona);
    }
  });
});
