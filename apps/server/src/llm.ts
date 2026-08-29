/**
 * The LLM layer. Three jobs (D12): play the suspects, phrase the reveal,
 * word the game-master nudges.
 *
 * Containment (D13): a suspect prompt is built ONLY from that character's
 * KnowledgeSheet — the Solution object never enters any prompt. Replies are
 * checked against forbiddenFacts before display; on a hit or any API failure
 * the banked answer is served instead (D15).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { CasePack, PlayerCounters, Suspect } from '@tmv/core';

const MODEL = 'claude-opus-5';

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

/** Nearest banked answer by topic keyword overlap; last resort is a deflection. */
export function bankedAnswer(suspect: Suspect, question: string): string {
  const q = question.toLowerCase();
  let best: { score: number; answer: string } = { score: 0, answer: '' };
  for (const entry of suspect.answerBank) {
    const score = entry.topics.filter((t) => q.includes(t)).length;
    if (score > best.score) best = { score, answer: entry.answer };
  }
  if (best.answer) return best.answer;
  return suspect.answerBank[0]?.answer ?? 'I have nothing more to say on the matter.';
}

/** Case-insensitive check of a reply against the forbidden facts (D13). */
export function violatesForbiddenFacts(pack: CasePack, reply: string): boolean {
  const lower = reply.toLowerCase();
  return pack.solution.forbiddenFacts.some((fact) => {
    // Match on significant word overlap rather than exact phrasing.
    const words = fact
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    const hits = words.filter((w) => lower.includes(w)).length;
    return words.length > 0 && hits / words.length > 0.7;
  });
}

function suspectPrompt(pack: CasePack, suspect: Suspect): string {
  const k = suspect.knowledge;
  return [
    `You are ${suspect.name}, a character in a 1920s murder-mystery party game.`,
    `Setting: ${pack.setting}`,
    `The victim: ${pack.victim.name}. ${pack.victim.discovery}`,
    `Your public face: ${suspect.publicBio}`,
    `Your manner: ${suspect.persona}`,
    '',
    'You know these things and will share them if asked well:',
    ...k.knows.map((s) => `- ${s}`),
    '',
    'You believe (possibly wrongly):',
    ...k.believes.map((s) => `- ${s}`),
    '',
    'You are hiding these and only concede ground when confronted with evidence:',
    ...k.hides.map((s) => `- ${s}`),
    '',
    'You actively lie about:',
    ...k.liesAbout.map((l) => `- ${l.topic}: say "${l.lie}"`),
    '',
    'Rules: stay in character and in period. Answer in 1-3 sentences, spoken aloud.',
    'Never invent facts not listed above. Never confess to anything.',
    'If asked about something not covered, deflect in character.',
  ].join('\n');
}

export async function askSuspect(
  pack: CasePack,
  suspectId: string,
  question: string,
  history: { question: string; answer: string }[],
): Promise<{ answer: string; fromBank: boolean }> {
  const suspect = pack.suspects.find((s) => s.id === suspectId);
  if (!suspect) return { answer: 'There is no such person in this house.', fromBank: true };
  if (!client) return { answer: bankedAnswer(suspect, question), fromBank: true };

  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 1024, // deliberately short: spoken replies
        system: suspectPrompt(pack, suspect),
        messages: [
          ...history.flatMap((h) => [
            { role: 'user' as const, content: h.question },
            { role: 'assistant' as const, content: h.answer },
          ]),
          { role: 'user', content: question },
        ],
      },
      { timeout: 8_000 },
    );
    if (response.stop_reason === 'refusal') {
      return { answer: bankedAnswer(suspect, question), fromBank: true };
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    if (!text || violatesForbiddenFacts(pack, text)) {
      return { answer: bankedAnswer(suspect, question), fromBank: true };
    }
    return { answer: text, fromBank: false };
  } catch {
    // Any failure — timeout, rate limit, network — falls back to the bank (D15).
    return { answer: bankedAnswer(suspect, question), fromBank: true };
  }
}

/** Deterministic fallback prose so the reveal always works offline. */
export function deterministicStrengthLine(
  name: string,
  strength: string,
  c: PlayerCounters,
): string {
  switch (strength) {
    case 'challenger':
      return `${name} kept the team honest — ${String(c.challengesRaised)} challenges that stopped easy answers.`;
    case 'investigator':
      return `${name} did the probing — ${String(c.questionsAsked)} questions across ${String(c.suspectsProbed)} suspects.`;
    case 'driver':
      return `${name} moved the team forward, putting ${String(c.theoriesProposed)} theories on the table.`;
    case 'quiet-catalyst':
      return c.firstKeyTable
        ? `${name} tabled the clue that broke the case.`
        : `${name} worked quietly — ${String(c.whispersSent)} private nudges that shaped the room.`;
    case 'organiser':
      return `${name} built the shared picture — ${String(c.cluesTabled)} clues onto the board, ${String(c.earlyTables)} of them early.`;
    default:
      return `${name} connected the pieces — backing ${String(c.theoriesBacked)} theories and joining views together.`;
  }
}

/**
 * LLM-phrased reveal lines. Deterministic counters decide WHAT is said (D10);
 * the model only chooses the words, and every line must cite the given facts.
 */
export async function phraseRevealLines(
  players: { name: string; strength: string; counters: PlayerCounters }[],
): Promise<string[] | null> {
  if (!client) return null;
  try {
    const facts = players
      .map(
        (p) =>
          `${p.name} (${p.strength}): tabled ${String(p.counters.cluesTabled)} clues, ` +
          `${String(p.counters.challengesRaised)} challenges, ${String(p.counters.questionsAsked)} suspect questions, ` +
          `${String(p.counters.theoriesProposed)} theories proposed, ${String(p.counters.whispersSent)} whispers` +
          (p.counters.firstKeyTable ? ', FIRST to table a case-breaking clue' : ''),
      )
      .join('\n');
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 2048,
        system:
          'You write the closing reveal of a team murder-mystery. For each player, write ONE warm, ' +
          'specific sentence naming their contribution, grounded ONLY in the facts given — never invent ' +
          'numbers or acts. No judgement, no ranking, no negatives. Return exactly one line per player, ' +
          'in the same order, no preamble.',
        messages: [{ role: 'user', content: facts }],
      },
      { timeout: 10_000 },
    );
    const lines = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.length === players.length ? lines : null;
  } catch {
    return null;
  }
}
