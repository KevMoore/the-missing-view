/**
 * JSON schemas for each drafting stage.
 *
 * Shape is enforced here so the validator is free to be about substance. A
 * model that cannot return the right fields is a parsing problem; a model that
 * returns the right fields and a case that proves nothing is the problem worth
 * spending the validator on.
 *
 * Every object sets `additionalProperties: false` and lists every key as
 * required, because that is what the structured-output mode requires.
 */

const str = { type: 'string' } as const;
const strs = { type: 'array', items: str } as const;

export const CAST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['setting', 'synopsis', 'victim', 'suspects'],
  properties: {
    setting: { ...str, description: 'One line: the place and the year.' },
    synopsis: { ...str, description: 'Four or five sentences, shown on the big screen.' },
    victim: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description', 'discovery'],
      properties: {
        name: str,
        description: { ...str, description: 'Who they were and who had cause to hate them.' },
        discovery: { ...str, description: 'Where and how the body was found.' },
      },
    },
    suspects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'publicBio', 'persona', 'voice', 'voiceDirection', 'portraitPrompt'],
        properties: {
          name: str,
          publicBio: { ...str, description: 'Two sentences, safe for every player to see.' },
          persona: { ...str, description: 'How they PHRASE things under questioning.' },
          voice: {
            ...str,
            description: 'One of: alloy ash ballad coral echo fable onyx nova sage shimmer.',
          },
          voiceDirection: {
            ...str,
            description: 'How they SOUND: sex, rough age, accent and class, pace, pitch, delivery.',
          },
          portraitPrompt: {
            ...str,
            description:
              'A prompt for a painted gallery-oil portrait, UNDER 200 CHARACTERS TOTAL. Exact form: ' +
              '"Oil portrait of a <woman|man>, <age>, <role and period>, <two or three physical ' +
              'details>, <expression>. Warm lamplight, umber ground. Rectangular, fills frame, no ' +
              'white". Never write "candlelit" — it renders actual candles. Keep it under 200 characters.',
          },
        },
      },
    },
  },
} as const;

export const CLUES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clues'],
  properties: {
    clues: {
      type: 'array',
      description: 'In the same order as the job list, one entry per numbered clue.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'text', 'imagePrompt'],
        properties: {
          title: { ...str, description: 'Three or four words, like an exhibit label.' },
          text: {
            ...str,
            description:
              'One to three sentences. A physical object, a record, or something a named person saw.',
          },
          imagePrompt: {
            ...str,
            description:
              'A painted study of this evidence, UNDER 200 CHARACTERS. Exact form: "Oil still ' +
              'life on dark wood, <the object and one telling detail>. Warm lamplight, deep umber ' +
              'shadow, fills whole frame, no white background". For a clue that is testimony ' +
              'rather than an object, paint the place instead. If the object carries writing, say ' +
              '"writing blurred illegible" — a picture that renders its own readable words will ' +
              'contradict the case and mislead the room.',
          },
        },
      },
    },
  },
} as const;

export const KNOWLEDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suspects'],
  properties: {
    suspects: {
      type: 'array',
      description: 'One entry per suspect, in the same order.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['knowledge', 'answerBank'],
        properties: {
          knowledge: {
            type: 'object',
            additionalProperties: false,
            required: ['knows', 'believes', 'hides', 'liesAbout'],
            properties: {
              knows: { ...strs, description: 'True things this character will say if asked well.' },
              believes: { ...strs, description: 'Things they hold to be true that may not be.' },
              hides: { ...strs, description: 'True things they conceal unless confronted.' },
              liesAbout: {
                type: 'array',
                description: 'Direct lies, each paired with the topic that triggers it.',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['topic', 'lie'],
                  properties: {
                    topic: { ...str, description: 'What they are asked about.' },
                    lie: { ...str, description: 'What they say instead of the truth.' },
                  },
                },
              },
            },
          },
          answerBank: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['topics', 'answer'],
              properties: {
                topics: { ...strs, description: 'Lower-case keywords that trigger this answer.' },
                answer: { ...str, description: 'Two sentences, in character.' },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const DRESSING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'prologueBeats', 'acts', 'solution'],
  properties: {
    title: { ...str, description: 'Like "Death at Blackwood Hall".' },
    prologueBeats: {
      ...strs,
      description: 'Narrated aloud, one or two sentences each. Must never name the culprit.',
    },
    acts: {
      type: 'array',
      description: 'Exactly three: gather, pressure, commit.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'opening', 'commitmentPrompt', 'commitmentKind', 'commitmentOptions'],
        properties: {
          title: str,
          opening: { ...str, description: 'One or two sentences read as the act begins.' },
          commitmentPrompt: {
            ...str,
            description: 'The question the room must answer to close the act.',
          },
          commitmentKind: { type: 'string', enum: ['suspect', 'theory'] },
          commitmentOptions: {
            ...strs,
            description: 'Only for kind "theory"; empty array for "suspect".',
          },
        },
      },
    },
    solution: {
      type: 'object',
      additionalProperties: false,
      required: ['motive', 'method', 'narrative', 'forbiddenFacts'],
      properties: {
        motive: str,
        method: { ...str, description: 'What they actually did, and when.' },
        narrative: { ...str, description: 'Read on the screen at the reveal. Cite the evidence.' },
        forbiddenFacts: {
          ...strs,
          description: 'Sentences a suspect must never say. State the solution several ways.',
        },
      },
    },
  },
} as const;
