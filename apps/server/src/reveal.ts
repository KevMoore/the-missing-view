/**
 * Builds the three reveal outputs (D11): shared strengths, private reads,
 * facilitator team shape. Judgement is deterministic (counters); the LLM only
 * phrases the shared lines, with a deterministic fallback.
 */
import {
  computeCounters,
  headlineStrength,
  type CasePack,
  type GameState,
  type PlayerCounters,
  type Strength,
} from '@tmv/core';
import type { PrivateReveal, SharedReveal, TeamShapeReveal } from './protocol.js';
import { deterministicStrengthLine, phraseRevealLines } from './llm.js';

const STRENGTH_LABEL: Record<Strength, string> = {
  investigator: 'The Investigator',
  connector: 'The Connector',
  challenger: 'The Challenger',
  driver: 'The Driver',
  'quiet-catalyst': 'The Quiet Catalyst',
  organiser: 'The Organiser',
};

export interface RevealBundle {
  shared: SharedReveal;
  privates: Map<string, PrivateReveal>;
  teamShape: TeamShapeReveal;
}

export async function buildReveal(pack: CasePack, state: GameState): Promise<RevealBundle> {
  const counters = computeCounters(state, pack.solution.provenBy);
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const entries = counters.map((c) => ({
    counters: c,
    name: byId.get(c.playerId)?.name ?? c.playerId,
    strength: headlineStrength(c, counters),
  }));

  const llmLines = await phraseRevealLines(entries);
  const strengths = entries.map((e, i) => ({
    playerId: e.counters.playerId,
    name: e.name,
    strength: STRENGTH_LABEL[e.strength],
    line: llmLines?.[i] ?? deterministicStrengthLine(e.name, e.strength, e.counters),
  }));

  const privates = new Map<string, PrivateReveal>();
  for (const e of entries) {
    privates.set(e.counters.playerId, {
      headline: STRENGTH_LABEL[e.strength],
      strength: e.strength,
      evidence: privateEvidence(e.counters),
      quieterSide: quieterSide(e.counters),
    });
  }

  return {
    shared: {
      solved: state.accusation?.correct ?? false,
      narrative: pack.solution.narrative,
      strengths,
    },
    privates,
    teamShape: teamShape(entries.map((e) => ({ strength: e.strength, counters: e.counters }))),
  };
}

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

/** Every private line cites a logged act (D10). */
function privateEvidence(c: PlayerCounters): string[] {
  const lines: string[] = [];
  if (c.cluesTabled) lines.push(`You put ${plural(c.cluesTabled, 'clue')} on the shared board.`);
  if (c.earlyTables)
    lines.push(
      `${String(c.earlyTables)} of them within minutes of receiving them — you share early.`,
    );
  if (c.questionsAsked)
    lines.push(
      `You asked ${String(c.questionsAsked)} questions of ${String(c.suspectsProbed)} suspects.`,
    );
  if (c.challengesRaised)
    lines.push(`You challenged a theory ${plural(c.challengesRaised, 'time')}.`);
  if (c.theoriesProposed)
    lines.push(
      `You proposed ${plural(c.theoriesProposed, 'theory').replace('theorys', 'theories')} of the crime.`,
    );
  if (c.whispersSent)
    lines.push(`You tested ideas privately ${plural(c.whispersSent, 'time')} before going public.`);
  if (c.voteChanges)
    lines.push(
      `You changed your position ${String(c.voteChanges)} times — you let evidence move you.`,
    );
  if (c.firstKeyTable) lines.push('You were first to table a clue that proves the solution.');
  if (!lines.length) lines.push('You listened more than you acted — the room needed that too.');
  return lines;
}

function quieterSide(c: PlayerCounters): string {
  if (!c.challengesRaised)
    return 'You never challenged a theory. When did you disagree and not say so?';
  if (!c.questionsAsked) return 'You asked the suspects nothing. Whose questions did you rely on?';
  if (!c.whispersSent && !c.cluesTabled)
    return 'Your clues stayed in your hand longest. What held them back?';
  return 'You did a bit of everything. Which of these felt most like you?';
}

function teamShape(entries: { strength: Strength; counters: PlayerCounters }[]): TeamShapeReveal {
  const present = new Set(entries.map((e) => e.strength));
  const all: Strength[] = [
    'investigator',
    'connector',
    'challenger',
    'driver',
    'quiet-catalyst',
    'organiser',
  ];
  const missing = all.filter((s) => !present.has(s));
  const totalChallenges = entries.reduce((n, e) => n + e.counters.challengesRaised, 0);
  const totalWhispers = entries.reduce((n, e) => n + e.counters.whispersSent, 0);

  return {
    shape:
      `This team leaned ${[...present].map((s) => STRENGTH_LABEL[s]).join(', ')}. ` +
      (totalChallenges < 2
        ? 'Very little open challenge — consensus came cheap.'
        : 'Theories were genuinely contested before they were adopted.') +
      (totalWhispers > entries.length ? ' A lot happened in private side-channels first.' : ''),
    missingViews: missing.map((s) => `${STRENGTH_LABEL[s]}: nobody naturally took this role.`),
    debriefPrompts: [
      'Who spotted something you had missed?',
      'Which contribution felt frustrating at the time but turned out to matter?',
      'Did everyone have space to contribute? Who decided that?',
      'What should we do differently in our next real meeting because of tonight?',
    ],
  };
}
