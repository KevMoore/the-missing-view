/**
 * The 1920s country-house cast library.
 *
 * Two pools, both reusable across every case in the `deco-1920s` theme, because
 * neither carries a word of any solution.
 *
 * `DECO_1920S_CHARACTERS` are the roles players are dealt. `PlayerCharacter`
 * holds nothing case-specific — a name, a reason to be in the house, and a
 * leaning for an AI player — so a case simply takes the pool. Twenty roles to a
 * table of four to eight means the same case casts differently every session
 * (see `castCharacters`), and the portraits live under the theme rather than
 * any one case.
 *
 * `DECO_1920S_SUSPECTS` are suspect *shells*: everything a suspect needs except
 * the two halves that encode a particular murder — the knowledge sheet and the
 * banked answers (D13, D15). An author picks a shell, writes those two, and has
 * a suspect with a face, a voice and a manner already settled.
 *
 * The voices are deliberately spread across sex, age, class and temper. A cast
 * of five polite middle-aged voices is a cast of one, so this pool includes the
 * deaf, the rude, the drunk, the theatrical and the barely audible.
 */
import type { PlayerCharacter, Suspect } from '../case/types.js';

/** A suspect minus the parts that encode one specific murder. */
export type SuspectShell = Omit<Suspect, 'knowledge' | 'answerBank'>;

const CAST = '/art/deco-1920s/cast';

export const DECO_1920S_CHARACTERS: PlayerCharacter[] = [
  {
    id: 'pc-inspector',
    name: 'The Retired Inspector',
    portraitAsset: `${CAST}/pc-inspector.jpg`,
    role: 'a former Scotland Yard man, now a neighbour',
    briefing:
      'You came for the pheasant. You stayed because nobody else in this house knows how a crime scene works. Old habits are waking up.',
    botLean: 'interrogate',
    voice: 'onyx',
    voiceDirection:
      'British, London — a man of sixty-two, thirty years in the Metropolitan Police. Low, worn, entirely unhurried. Asks a question and then waits, which is the trick.',
  },
  {
    id: 'pc-journalist',
    name: 'The Journalist',
    portraitAsset: `${CAST}/pc-journalist.jpg`,
    role: 'a Fleet Street correspondent, snowed in on the way to a story',
    briefing:
      'You smelt a story at dinner before anyone died. Now you have the story of the year — if you can untangle it before the police take it from you.',
    botLean: 'theorise',
    voice: 'ash',
    voiceDirection:
      'British, Fleet Street — a man of forty, fast and slightly clipped, the vowels flattened by years of shouting down a telephone. Sceptical by default.',
  },
  {
    id: 'pc-heiress',
    name: 'The American Heiress',
    portraitAsset: `${CAST}/pc-heiress.jpg`,
    role: 'a transatlantic guest with sharp eyes and no English reverence',
    briefing:
      'Everyone here performs politeness like a religion. You don’t share it, which means you see what they hide behind it.',
    botLean: 'challenge',
    voice: 'nova',
    voiceDirection:
      'The one American in the house, and she knows it. East Coast, moneyed, bright and quick, with none of the English habit of softening a question before asking it.',
  },
  {
    id: 'pc-solicitor',
    name: 'The Solicitor’s Clerk',
    portraitAsset: `${CAST}/pc-solicitor.jpg`,
    role: 'sent from London with papers for the master of the house to sign',
    briefing:
      'The papers in your case were urgent enough to send you through a snowstorm. You know more about this family’s affairs than anyone here suspects.',
    botLean: 'detail',
    voice: 'echo',
    voiceDirection:
      "British, careful clerk's English — a young man of twenty-six, precise and a little too polite, pitched high when nervous. Reads a fact out as though it were a citation.",
  },
  {
    id: 'pc-vicar',
    name: 'The Vicar',
    portraitAsset: `${CAST}/pc-vicar.jpg`,
    role: 'the parish priest, dined and stranded',
    briefing:
      'People tell you things. They always have. Tonight, listening may matter more than it ever has from the pulpit.',
    botLean: 'listen',
    voice: 'fable',
    voiceDirection:
      'British, gentle rural parish — a man of fifty-five, warm and unhurried, with the practised calm of somebody used to being told difficult things.',
  },
  {
    id: 'pc-governess',
    name: 'The Governess',
    portraitAsset: `${CAST}/pc-governess.jpg`,
    role: 'governess to the ward of the house',
    briefing:
      'The household barely notices you, which is its mistake. You notice everything, and you were awake past midnight.',
    botLean: 'detail',
    voice: 'sage',
    voiceDirection:
      'British, quiet and exact — a woman of thirty-four, softly spoken and never hurried. Says less than she knows, and always has.',
  },
  {
    id: 'pc-engineer',
    name: 'The Motoring Engineer',
    portraitAsset: `${CAST}/pc-engineer.jpg`,
    role: 'your motorcar failed on the moor road; the house took you in',
    briefing:
      'A stranger to all of them, obliged to none of them. You measure people the way you measure machines: by what they do under load.',
    botLean: 'challenge',
    voice: 'ballad',
    voiceDirection:
      'British, Midlands under the polish — a man of forty-two, practical and level, the rhythm of somebody explaining a machine to somebody who does not understand machines.',
  },
  {
    id: 'pc-companion',
    name: 'The Lady’s Companion',
    portraitAsset: `${CAST}/pc-companion.jpg`,
    role: 'companion to a dowager who has slept through everything',
    briefing:
      'You have spent years being agreeable in drawing rooms. You know exactly what it costs to hold a smile in place — and you can tell when someone else is paying it.',
    botLean: 'listen',
    voice: 'shimmer',
    voiceDirection:
      'British, genteel and worn thin — a woman of forty-six, light and pleasant on the surface with something tired underneath. Trained to be agreeable, and audibly so.',
  },
  {
    id: 'pc-driver',
    name: 'The Racing Driver',
    portraitAsset: `${CAST}/pc-driver.jpg`,
    role: 'a Brooklands driver who came for the weekend and the wine',
    briefing:
      'You have walked away from two crashes and one engagement. You are the only person here who is not frightened of being wrong out loud, which makes you useful tonight.',
    botLean: 'challenge',
    voice: 'coral',
    voiceDirection:
      'British, fast and fearless — a woman of twenty-six, bright, loud, laughing at the edges of her sentences. Says the unsayable thing first.',
  },
  {
    id: 'pc-actress',
    name: 'The Actress',
    portraitAsset: `${CAST}/pc-actress.jpg`,
    role: 'a West End name, invited to decorate the table',
    briefing:
      'You have played guilt, grief and innocence for money. You know what all three look like when they are real, and you know what they look like when they are not.',
    botLean: 'theorise',
    voice: 'nova',
    voiceDirection:
      'British, West End — a woman of thirty-four, beautifully produced and slightly too resonant for a drawing room. Every line has been placed.',
  },
  {
    id: 'pc-archaeologist',
    name: 'The Archaeologist',
    portraitAsset: `${CAST}/pc-archaeologist.jpg`,
    role: 'home from a season in the field, and impatient with drawing rooms',
    briefing:
      'You reconstruct whole lives from a broken cup and a burial angle. A house full of people who have tidied the evidence is simply a worse-behaved dig.',
    botLean: 'detail',
    voice: 'sage',
    voiceDirection:
      'British, academic — a woman of forty-one, dry, patient, sun-worn. Speaks in complete sentences and leaves long gaps between them.',
  },
  {
    id: 'pc-barrister',
    name: 'The King’s Counsel',
    portraitAsset: `${CAST}/pc-barrister.jpg`,
    role: 'a criminal silk, down for the shooting',
    briefing:
      'You have hanged three men and freed a guiltier one. You do not believe confessions and you do not believe coincidences, and you will say so.',
    botLean: 'interrogate',
    voice: 'onyx',
    voiceDirection:
      'British, the Bar — a man of fifty-five, deep and deliberate, every word weighed before it is spent. Asks questions he already knows the answer to.',
  },
  {
    id: 'pc-nurse',
    name: 'The War Nurse',
    portraitAsset: `${CAST}/pc-nurse.jpg`,
    role: 'a former casualty-clearing sister, now a guest',
    briefing:
      'You have seen more dead men than everyone else in this house combined. The body downstairs does not frighten you, and what it tells you is very specific.',
    botLean: 'detail',
    voice: 'shimmer',
    voiceDirection:
      'British, calm to the point of flat — a woman of thirty-eight who has seen worse. Steady, quiet, entirely unshockable, no drama in it whatsoever.',
  },
  {
    id: 'pc-novelist',
    name: 'The Novelist',
    portraitAsset: `${CAST}/pc-novelist.jpg`,
    role: 'writes shockers; here to be looked down upon and fed',
    briefing:
      'You have plotted forty murders and published nine. You know how a real one differs from a good one — and which mistakes only an amateur makes.',
    botLean: 'theorise',
    voice: 'coral',
    voiceDirection:
      'British, quick and amused — a woman of twenty-nine, wry, a little untidy in her speech, ideas arriving faster than she can order them.',
  },
  {
    id: 'pc-chauffeur',
    name: 'The Chauffeur',
    portraitAsset: `${CAST}/pc-chauffeur.jpg`,
    role: 'drove a guest here and was told to wait',
    briefing:
      'You saw who arrived, at what hour, in what state, and carrying what. Nobody upstairs has thought to ask you, because nobody upstairs thinks about you at all.',
    botLean: 'listen',
    voice: 'ash',
    voiceDirection:
      'British, London south of the river — a man of thirty-one, quiet, watchful, economical. Speaks rarely, and only when it is worth it.',
  },
  {
    id: 'pc-debutante',
    name: 'The Debutante',
    portraitAsset: `${CAST}/pc-debutante.jpg`,
    role: 'presented in the spring, and bored ever since',
    briefing:
      'Everyone talks in front of you as though you were furniture. You have been collecting what they say for two seasons and you forget nothing.',
    botLean: 'listen',
    voice: 'coral',
    voiceDirection:
      'British, expensively finished — a girl of nineteen, light and quick and much sharper than she is allowed to sound. Rises at the end of sentences.',
  },
  {
    id: 'pc-spiritualist',
    name: 'The Medium',
    portraitAsset: `${CAST}/pc-spiritualist.jpg`,
    role: 'brought in to entertain after dinner, and staying rather too long',
    briefing:
      'Your trade is reading a room, then telling it what it already believes. You are a fraud with a genuine skill, and tonight the skill is the useful half.',
    botLean: 'theorise',
    voice: 'shimmer',
    voiceDirection:
      'British, theatrical mystic — a woman of fifty-two, low, slow, deliberately hypnotic, every phrase given more weight than it can carry.',
  },
  {
    id: 'pc-landagent',
    name: 'The Land Agent',
    portraitAsset: `${CAST}/pc-landagent.jpg`,
    role: 'manages the estate’s tenancies, rents and quarrels',
    briefing:
      'You know what the estate earns, what it owes, and which of these people has been quietly ruined. Money is the only motive you have ever needed to look for.',
    botLean: 'detail',
    voice: 'echo',
    voiceDirection:
      'British, county — a man of forty-seven, plain, weathered, unimpressed. Talks about people the way he talks about drainage.',
  },
  {
    id: 'pc-botanist',
    name: 'The Professor',
    portraitAsset: `${CAST}/pc-botanist.jpg`,
    role: 'a botanist, invited for the glasshouse and kept for the conversation',
    briefing:
      'Forty years of naming things exactly. You will not say "some kind of powder" when you can say which, and you will not let anyone else get away with it either.',
    botLean: 'detail',
    voice: 'fable',
    voiceDirection:
      'British, Cambridge — a man of sixty-three, precise and gentle, delighted by exactness. Pauses to choose the correct word rather than the near one.',
  },
  {
    id: 'pc-operator',
    name: 'The Telephone Operator',
    portraitAsset: `${CAST}/pc-operator.jpg`,
    role: 'works the village exchange; sheltering here since the line came down',
    briefing:
      'Every call this house made this week went through your board. You are not supposed to listen. You listened.',
    botLean: 'interrogate',
    voice: 'sage',
    voiceDirection:
      'British, small-town exchange — a woman of twenty-four, brisk and clear, the enunciation of somebody used to being misheard down a wire.',
  },
];

export const DECO_1920S_SUSPECTS: SuspectShell[] = [
  {
    id: 'sh-dowager',
    name: 'Lady Constance Wren',
    publicBio:
      'The dowager of the house, seventy-eight, and the last word on everything. Deaf when it suits her.',
    portraitAsset: `${CAST}/sus-dowager.jpg`,
    persona:
      'Imperious and openly rude. Treats every question as an impertinence and answers a different one. ' +
      'Mishears anything inconvenient. Insults people by name without heat, as a matter of record.',
    voice: 'shimmer',
    voiceDirection:
      'British, aristocratic English of the old school — a woman of seventy-eight, thin and dry ' +
      'the way the deaf speak. Slow, absolutely certain, no warmth at all. Trails off mid-sentence ' +
      'when she loses interest, which is often.',
  },
  {
    id: 'sh-gamekeeper',
    name: 'Jed Halloran',
    publicBio:
      'Gamekeeper on the estate for twenty-two years. Speaks when there is something to say.',
    portraitAsset: `${CAST}/sus-gamekeeper.jpg`,
    persona:
      'Taciturn to the point of rudeness. Answers in four words where four would do. Deeply loyal to ' +
      'the land and contemptuous of the house. What he does say is exact and never volunteered twice.',
    voice: 'ash',
    voiceDirection:
      'British, deep rural West Country — a man of fifty, low and gravelled, unhurried to the point of stubbornness. ' +
      'Long pauses before he speaks at all. Never raises his voice and never softens it.',
  },
  {
    id: 'sh-heir',
    name: 'Rupert Vane',
    publicBio: 'The son and heir, twenty-four. Down from town, and down on his luck at cards.',
    portraitAsset: `${CAST}/sus-heir.jpg`,
    persona:
      'Petulant, entitled, and drunk by ten. Blusters, then sulks, then says far too much. Treats ' +
      'suspicion as a personal insult and debt as someone else’s failure of manners.',
    voice: 'ballad',
    voiceDirection:
      'British, expensive public school — a man of twenty-four, three glasses past careful. Loud, loose, ' +
      'consonants going soft. Swings between a sneer and self-pity inside one sentence, and the ' +
      'pitch rises whenever he is caught out.',
  },
  {
    id: 'sh-cook',
    name: 'Mrs Bridie Nolan',
    publicBio: 'Cook to the house these fifteen years. Runs the kitchen as her own country.',
    portraitAsset: `${CAST}/sus-cook.jpg`,
    persona:
      'Voluble and defensive. Answers at length, in a rush, mostly about the kitchen and who has ' +
      'wronged it. Buries the one useful fact in the middle of a grievance about the fish.',
    voice: 'coral',
    voiceDirection:
      'Irish, from Cork — a woman of fifty-five, warm and very fast, sentences running into one another with no ' +
      'gap to interrupt. Rises in pitch when defensive, which is most of the time. Bustling, ' +
      'breathless, and entirely without malice.',
  },
  {
    id: 'sh-tutor',
    name: 'Mr Laurence Peel',
    publicBio: 'Private tutor to the household’s children. Three months in the post.',
    portraitAsset: `${CAST}/sus-tutor.jpg`,
    persona:
      'Nervous and over-explains. Answers the question, then answers it again more fully, then ' +
      'apologises for the length. Volunteers alibis nobody asked for, which makes him sound guilty ' +
      'of everything and is probably guilt about something small.',
    voice: 'echo',
    voiceDirection:
      'British, home counties — a man of thirty-three, educated, reedy, pitched a little high and a little fast. Swallows, ' +
      'restarts sentences, adds qualifications. Audibly relieved by an easy question and audibly ' +
      'undone by a hard one.',
  },
  {
    id: 'sh-widow',
    name: 'Mrs Sylvia Ardenne',
    publicBio: 'Widowed two years, and a fixture of the house party ever since.',
    portraitAsset: `${CAST}/sus-widow.jpg`,
    persona:
      'Brittle and theatrical. Performs grief slightly too well and slightly too often, then drops it ' +
      'entirely when she is bored. What she lets slip while performing is worth more than what she ' +
      'says on purpose.',
    voice: 'nova',
    voiceDirection:
      'British, well-bred English — a woman of forty-four, musical and a shade too rehearsed. Catches in the ' +
      'throat on cue. Between the catches the voice goes suddenly flat and businesslike, and that ' +
      'is the real one.',
  },
  {
    id: 'sh-clerk',
    name: 'Mr Alfred Timms',
    publicBio: 'Clerk to the family’s solicitors. Knows every settlement and every codicil.',
    portraitAsset: `${CAST}/sus-clerk.jpg`,
    persona:
      'Pedantic and bloodless. Corrects the wording of questions before answering them. Hides behind ' +
      'professional discretion, and is quietly delighted to be the only person who understands the will.',
    voice: 'alloy',
    voiceDirection:
      'British, careful lower-middle-class English with the corners filed off — a man of thirty-nine. Precise, ' +
      'level, faintly nasal, every clause closed. Pauses before figures and dates, as if reading them ' +
      'off a page.',
  },
  {
    id: 'sh-count',
    name: 'Count Andrei Volkov',
    publicBio: 'An émigré, resident in London since ’19. Introduced by a friend of the family.',
    portraitAsset: `${CAST}/sus-count.jpg`,
    persona:
      'Courtly, charming and comprehensively evasive. Compliments the questioner, tells a story from ' +
      'St Petersburg, and answers nothing. Grows very still and very direct only when genuinely cornered.',
    voice: 'onyx',
    voiceDirection:
      'A Russian émigré of fifty-eight who has spoken English in London since 1919: an ' +
      'acquired, almost over-correct English drawl with the Russian now only a shadow under ' +
      'it. Deep, slow and beautifully articulated, ' +
      'savouring the words. Warm and amused throughout. When cornered the warmth vanishes and the ' +
      'sentences become short.',
  },
];
