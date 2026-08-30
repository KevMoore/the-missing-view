/**
 * The drafting model. Authoring runs at a desk, not in a room with eight people
 * waiting, so this is the one place in the project that may think hard and take
 * its time: high reasoning effort, a generous timeout, and no fallback. A case
 * that half-drafted is worse than one that failed loudly.
 */
import OpenAI from 'openai';
import type { Model } from './draft.js';

const MODEL = 'gpt-5.6-luna';

export function openAiModel(client = new OpenAI()): Model {
  return async ({ instructions, input, schema, label }) => {
    const response = await client.responses.create(
      {
        model: MODEL,
        instructions,
        input,
        reasoning: { effort: 'high' },
        text: {
          format: {
            type: 'json_schema',
            name: label.replace(/[^a-z0-9_-]/gi, '_'),
            strict: true,
            schema,
          },
        },
      },
      { timeout: 300_000 },
    );
    const text = response.output_text.trim();
    if (!text) throw new Error(`[author] ${label}: the model returned nothing`);
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`[author] ${label}: the model returned unparseable JSON`);
    }
  };
}
