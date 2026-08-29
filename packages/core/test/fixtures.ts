import type { CasePack, Clue, Suspect, TeamMoment } from '../src/index.js';

const MOMENTS: TeamMoment[] = [
  'detail',
  'big-picture',
  'challenge',
  'leadership',
  'listening',
  'conflict',
  'synthesis',
  'decision',
];

export function testSuspect(id: string, overrides: Partial<Suspect> = {}): Suspect {
  return {
    id,
    name: `Suspect ${id}`,
    publicBio: 'A guest.',
    persona: 'Clipped, defensive.',
    knowledge: {
      knows: ['saw the hallway clock at ten'],
      believes: [],
      hides: [],
      liesAbout: [],
    },
    answerBank: [{ topics: ['where'], answer: 'I was in the library.' }],
    ...overrides,
  };
}

/** A minimal valid case: 12 act-1 clues covering all 8 moments, 3-clue solution. */
export function testCase(overrides: Partial<CasePack> = {}): CasePack {
  const clues: Clue[] = Array.from({ length: 12 }, (_, i) => ({
    id: `c${String(i + 1)}`,
    title: `Clue ${String(i + 1)}`,
    text: 'Something odd.',
    key: i < 3,
    moment: MOMENTS[i % MOMENTS.length] as TeamMoment,
    act: 1,
  }));
  return {
    id: 'test-case',
    title: 'Death at Test Hall',
    setting: 'A test hall, 1926.',
    synopsis: 'Someone is dead.',
    victim: { id: 'v1', name: 'The Victim', description: 'Rich.', discovery: 'At the stairs.' },
    suspects: [testSuspect('s1'), testSuspect('s2'), testSuspect('s3')],
    characters: Array.from({ length: 8 }, (_, i) => ({
      id: `pc${String(i + 1)}`,
      name: `Guest ${String(i + 1)}`,
      role: 'guest',
      briefing: 'You were invited for the weekend.',
    })),
    clues,
    acts: [
      {
        number: 1,
        title: 'The Body',
        minutes: 15,
        opening: 'Snow falls.',
        commitment: { id: 'a1', prompt: 'Prime suspect?', kind: 'suspect' },
      },
      {
        number: 2,
        title: 'The Lies',
        minutes: 20,
        opening: 'The phone line is dead.',
        commitment: { id: 'a2', prompt: 'Your working theory?', kind: 'theory', options: [
          { id: 't1', label: 'Money' },
          { id: 't2', label: 'Love' },
        ] },
      },
      {
        number: 3,
        title: 'The Accusation',
        minutes: 15,
        opening: 'Dawn.',
        commitment: { id: 'a3', prompt: 'Name the killer.', kind: 'suspect' },
      },
    ],
    deal: { neverSameHolder: [['c1', 'c2']], minKeyHolders: 3 },
    solution: {
      culpritId: 's2',
      motive: 'Money.',
      method: 'Pushed.',
      provenBy: ['c1', 'c2', 'c3'],
      narrative: 'It was s2 all along.',
      forbiddenFacts: ['s2 killed the victim'],
    },
    ...overrides,
  };
}
