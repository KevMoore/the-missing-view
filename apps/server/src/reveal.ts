/**
 * Builds the three reveal outputs (D11): shared strengths, private reads,
 * facilitator team shape. Judgement is deterministic (counters); the LLM only
 * phrases the shared lines, with a deterministic fallback.
 */
import {
  computeDecisions,
  DECISION_LABEL,
  DECISION_LINE,
  computeMoments,
  MOMENT_ABSENT,
  MOMENT_LABEL,
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
  const moments = computeMoments(pack, state);
  const decisions = new Map(computeDecisions(state).map((d) => [d.playerId, d]));
  const playerName = (id?: string) => (id ? (byId.get(id)?.name ?? id) : '');
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
    const decision = decisions.get(e.counters.playerId);
    privates.set(e.counters.playerId, {
      headline: STRENGTH_LABEL[e.strength],
      strength: e.strength,
      ...(decision
        ? {
            decision: {
              label: DECISION_LABEL[decision.style],
              line: DECISION_LINE[decision.style],
            },
          }
        : {}),
      evidence: privateEvidence(e.counters),
      quieterSide: quieterSide(e.counters),
    });
  }

  return {
    shared: {
      solved: state.accusation?.correct ?? false,
      narrative: pack.solution.narrative,
      strengths,
      // The room sees only what it reached. What it missed is the facilitator's
      // to raise, in their own words, at the right moment (D11).
      moments: moments
        .filter((m) => m.offered)
        .map((m) => ({
          moment: m.moment,
          label: MOMENT_LABEL[m.moment],
          byName: playerName(m.byPlayerId),
          clueTitle: m.clueTitle,
          landed: m.landed,
        })),
    },
    privates,
    teamShape: teamShape(
      entries.map((e) => ({ strength: e.strength, counters: e.counters })),
      moments.map((m) => ({
        moment: m.moment,
        label: MOMENT_LABEL[m.moment],
        clueTitle: m.clueTitle,
        offered: m.offered,
        landed: m.landed,
        ...(m.response ? { response: m.response } : {}),
        ...(m.offered ? {} : { absentNote: MOMENT_ABSENT[m.moment] }),
      })),
    ),
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

function teamShape(
  entries: { strength: Strength; counters: PlayerCounters }[],
  moments: TeamShapeReveal['moments'],
): TeamShapeReveal {
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

  const never = moments.filter((m) => !m.offered);
  const walkedPast = moments.filter((m) => m.offered && !m.landed);

  return {
    shape:
      `This team leaned ${[...present].map((s) => STRENGTH_LABEL[s]).join(', ')}. ` +
      `It reached ${String(moments.length - never.length)} of the ${String(moments.length)} team moments this case was built around. ` +
      (totalChallenges < 2
        ? 'Very little open challenge — consensus came cheap.'
        : 'Theories were genuinely contested before they were adopted.') +
      (totalWhispers > entries.length ? ' A lot happened in private side-channels first.' : ''),
    moments,
    // The moment-by-moment story has its own panel now, so this stays what it
    // always was: the roles nobody in the room took up.
    missingViews: missing.map((s) => `${STRENGTH_LABEL[s]}: nobody naturally took this role.`),
    debriefPrompts: [
      ...(never.length
        ? [
            `We never got to ${never.map((m) => m.label.toLowerCase()).join(', or ')}. What stopped us?`,
          ]
        : []),
      ...(walkedPast.length
        ? ['Something went on the board that the room passed over. What were we doing instead?']
        : []),
      'Who spotted something you had missed?',
      'Which contribution felt frustrating at the time but turned out to matter?',
      'Did everyone have space to contribute? Who decided that?',
      'What should we do differently in our next real meeting because of tonight?',
    ],
  };
}
