/**
 * The LLM layer. Three jobs (D12): play the suspects, phrase the reveal,
 * word the game-master nudges.
 *
 * Containment (D13): a suspect prompt is built ONLY from that character's
 * KnowledgeSheet — the Solution object never enters any prompt. Replies are
 * checked against forbiddenFacts before display; on a hit or any API failure
 * the banked answer is served instead (D15).
 */
import OpenAI from 'openai';
import type { CasePack, PlayerCounters, Suspect } from '@tmv/core';

const MODEL = 'gpt-5.6-luna';

/**
 * The suspects speak aloud on the big screen. Two sentences is about sixteen
 * seconds of audio, so a busy hour of interrogation costs a few pence — but a
 * voice is what turns a wall of text into a person in the room.
 */
const SPEECH_MODEL = 'gpt-4o-mini-tts';

/**
 * Stated first and stated hard, for every spoken line in the game.
 *
 * The model reads in American English unless told plainly not to, and a
 * character direction like "clipped soldier's answers" is a manner, not an
 * accent — it will happily be delivered by a Californian. In a 1926 English
 * country house one American vowel undoes the whole room.
 */
/**
 * Half a second of silence, as a WAV.
 *
 * With no API key there is no audio at all, so the entire spoken layer — the
 * queue, the ducking, the pacing of the opening — was untestable except against
 * production. Under TMV_TEST the same code paths run and produce something a
 * browser will actually play, which is the difference between reasoning about
 * the mix and measuring it.
 */
const TEST_TONE = Buffer.concat([
  Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', 'base64'),
  Buffer.alloc(4000, 128),
]);

const BRITISH =
  'Speak in British English throughout, with a British accent. This is not optional and ' +
  'overrides any default. Never American, Canadian or transatlantic. British vowels, British ' +
  'rhythm, British stress. Non-rhotic: do not sound the R at the end of a word.';

/**
 * A suspect's reply is two sentences of in-character dialogue and the whole
 * room is waiting on it, so reasoning effort buys nothing and costs seconds.
 * The reveal gets one step up: it has to phrase real counters warmly.
 */
const SUSPECT_EFFORT = 'none';
const REVEAL_EFFORT = 'low';

const client = process.env.OPENAI_API_KEY ? new OpenAI() : null;

function describe(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** True when a live model is configured; false means the game runs off the bank. */
export function llmConfigured(): boolean {
  return client !== null;
}

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
    const response = await client.responses.create(
      {
        model: MODEL,
        instructions: suspectPrompt(pack, suspect),
        input: [
          ...history.flatMap((h) => [
            { role: 'user' as const, content: h.question },
            { role: 'assistant' as const, content: h.answer },
          ]),
          { role: 'user' as const, content: question },
        ],
        max_output_tokens: 1024, // deliberately short: spoken replies
        reasoning: { effort: SUSPECT_EFFORT },
      },
      { timeout: 8_000 },
    );
    const text = response.output_text.trim();
    // A refusal, a truncation, or a leak of the solution all serve the bank (D15).
    if (!text || response.status === 'incomplete' || violatesForbiddenFacts(pack, text)) {
      return { answer: bankedAnswer(suspect, question), fromBank: true };
    }
    return { answer: text, fromBank: false };
  } catch (err) {
    // Any failure — timeout, rate limit, network — falls back to the bank (D15).
    // Logged, not swallowed: a silent fallback looks exactly like a working game,
    // so a misconfigured key would otherwise go unnoticed for a whole session.
    console.warn('[llm] askSuspect fell back to the bank:', describe(err));
    return { answer: bankedAnswer(suspect, question), fromBank: true };
  }
}

/**
 * Speak a suspect's reply. The character's `persona` is the delivery
 * instruction, so the manner is authored once and never drifts from the text.
 *
 * Returns null on any failure, and on a case that cast no voice. Audio is
 * decoration, exactly like the music: it must never hold up or break a game
 * that is already showing the answer in writing.
 */
export async function speakAnswer(
  pack: CasePack,
  suspectId: string,
  text: string,
): Promise<Buffer | null> {
  const suspect = pack.suspects.find((s) => s.id === suspectId);
  if (process.env.TMV_TEST) return TEST_TONE;
  if (!client || !suspect?.voice || !text) return null;
  try {
    const speech = await client.audio.speech.create(
      {
        model: SPEECH_MODEL,
        voice: suspect.voice,
        input: text,
        // voiceDirection is how they sound; persona is how they phrase things.
        instructions: [
          BRITISH,
          `You are ${suspect.name}, questioned in an English country house in 1926.`,
          suspect.voiceDirection,
          suspect.persona,
          'Speak the line as this person. Do not narrate, announce yourself, or add words.',
        ]
          .filter(Boolean)
          .join(' '),
        response_format: 'mp3',
      },
      { timeout: 20_000 },
    );
    return Buffer.from(await speech.arrayBuffer());
  } catch (err) {
    console.warn('[llm] speakAnswer produced no audio:', describe(err));
    return null;
  }
}

/** One beat of the opening, in the narrator's voice. Null on any failure. */
export async function narrate(pack: CasePack, text: string): Promise<Buffer | null> {
  const prologue = pack.prologue;
  if (process.env.TMV_TEST) return TEST_TONE;
  if (!client || !prologue?.voice || !text) return null;
  try {
    const speech = await client.audio.speech.create(
      {
        model: SPEECH_MODEL,
        voice: prologue.voice,
        input: text,
        instructions: [
          BRITISH,
          'You are narrating the opening of a 1926 English country-house murder mystery.',
          prologue.voiceDirection,
          'Speak the line only. Do not announce yourself or add words.',
        ]
          .filter(Boolean)
          .join(' '),
        response_format: 'mp3',
      },
      { timeout: 20_000 },
    );
    return Buffer.from(await speech.arrayBuffer());
  } catch (err) {
    console.warn('[llm] narrate produced no audio:', describe(err));
    return null;
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
    const response = await client.responses.create(
      {
        model: MODEL,
        instructions:
          'You write the closing reveal of a team murder-mystery. For each player, write ONE warm, ' +
          'specific sentence naming their contribution, grounded ONLY in the facts given — never invent ' +
          'numbers or acts. No judgement, no ranking, no negatives. Return exactly one line per player, ' +
          'in the same order, no preamble.',
        input: facts,
        max_output_tokens: 2048,
        reasoning: { effort: REVEAL_EFFORT },
      },
      { timeout: 10_000 },
    );
    const lines = response.output_text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.length === players.length ? lines : null;
  } catch (err) {
    console.warn('[llm] phraseRevealLines fell back to deterministic prose:', describe(err));
    return null;
  }
}

/**
 * One line of dialogue for an AI player, spoken as their dealt investigator.
 *
 * Containment is the same as for the suspects (D13): a bot is given the case
 * setting, its own character, and only what is already on the shared evidence
 * board — never the solution, never another player's hand. Returns null on any
 * failure so the caller can use its own deterministic wording (D15).
 */
export async function phraseBotLine(
  pack: CasePack,
  character: { name: string; role: string; briefing: string },
  intent: string,
  visible: string[],
): Promise<string | null> {
  if (!client) return null;
  try {
    const response = await client.responses.create(
      {
        model: MODEL,
        instructions: [
          `You are ${character.name}, ${character.role}, a guest investigating a death`,
          `at a 1920s English country house. ${character.briefing}`,
          `Setting: ${pack.setting}`,
          '',
          'Write ONE sentence, in character and in period, spoken aloud to the room.',
          'Use only what the evidence below states — never invent a fact, a name, or an',
          'accusation. Do not name a culprit. No preamble, no quotation marks.',
        ].join('\n'),
        input: [
          visible.length ? `On the evidence board:\n${visible.join('\n')}` : 'The board is empty.',
          '',
          `What you want to say: ${intent}`,
        ].join('\n'),
        max_output_tokens: 512,
        reasoning: { effort: SUSPECT_EFFORT },
      },
      { timeout: 8_000 },
    );
    const text = response.output_text.trim().replace(/^["\u201c]|["\u201d]$/g, '');
    if (!text || response.status === 'incomplete' || violatesForbiddenFacts(pack, text))
      return null;
    return text;
  } catch (err) {
    console.warn('[llm] phraseBotLine fell back to deterministic wording:', describe(err));
    return null;
  }
}
