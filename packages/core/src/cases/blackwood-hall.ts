import type { CasePack } from '../case/types.js';
import { DECO_1920S_CHARACTERS } from '../cast/deco-1920s.js';

/**
 * Case one: "Death at Blackwood Hall" — a snowbound Yorkshire country house,
 * December 1926. Hand-authored; must always pass `validateCase`.
 *
 * The truth (never serialised to clients before the reveal):
 * Sir Edmund summoned his secretary, Miss Evelyn Cross, to the study at midnight,
 * having discovered she had been quietly bleeding the ledgers. She is the daughter
 * of the engineer he ruined in 1919. Confronted on the landing, she pushed him.
 * Captain Ashworth — the obvious suspect — merely found the body and panicked.
 */
export const blackwoodHall: CasePack = {
  id: 'blackwood-hall',
  title: 'Death at Blackwood Hall',
  setting: 'Blackwood Hall, the Yorkshire moors, December 1926. Snowbound.',
  synopsis:
    'The storm closed the road at dusk. At seven minutes past midnight, Sir Edmund ' +
    'Blackwood — industrialist, host, and enemy to half the county — was found dead ' +
    'at the foot of his own grand staircase. The telephone line is down. The police ' +
    'cannot reach the Hall before morning. Everyone who could have done it is still ' +
    'in the house — and so are you.',
  victim: {
    id: 'v-edmund',
    name: 'Sir Edmund Blackwood',
    portraitAsset: '/art/blackwood-hall/cast/v-edmund.jpg',
    description:
      'Sixty-one. Self-made steel magnate. Charming in public, merciless in business. ' +
      'Three men in Yorkshire are said to toast his health only so they may drink.',
    discovery:
      'Found by the butler at 12:20 a.m., sprawled at the foot of the grand staircase. ' +
      'His study door above stands open. The hall clock stopped at 12:04.',
  },
  suspects: [
    {
      id: 's-margaret',
      name: 'Lady Margaret Blackwood',
      portraitAsset: '/art/blackwood-hall/cast/s-margaret.jpg',
      publicBio: 'Sir Edmund’s second wife. Elegant, watchful, and rather too calm.',
      persona:
        'Glacial politeness. Answers in complete, measured sentences. Deflects with ' +
        'etiquette. Never raises her voice; lowers it instead.',
      voice: 'sage',
      voiceDirection:
        'A woman of about forty. Upper-class English, Received Pronunciation, every ' +
        'vowel paid for. Cool, slow and perfectly level — the voice of someone who has ' +
        'never once had to raise it. Drops in pitch when annoyed rather than rising. ' +
        'Small pauses before she answers, as though the question were slightly vulgar.',
      knowledge: {
        knows: [
          'She retired at half past ten and heard raised voices from the study around midnight — a man and a woman.',
          'Her husband had been unusually secretive about the accounts for a month.',
          'The household keys are kept by Reeves; only Edmund, Reeves and Miss Cross held keys to the study.',
        ],
        believes: [
          'Her husband was ruthless enough that half the county wished him dead.',
          'Captain Ashworth needed money badly and quarrelled with Edmund that evening.',
        ],
        hides: [
          'Her pearls are paste; she sold the real ones to cover gambling debts of her own.',
          'She was not alone after eleven — Dr Harmsworth was with her, discussing her laudanum dependence in confidence.',
        ],
        liesAbout: [
          {
            topic: 'where she was between eleven and midnight',
            lie: 'She says she was asleep in her room, alone, from half past ten.',
          },
        ],
      },
      answerBank: [
        {
          topics: ['where', 'midnight', 'room', 'asleep', 'alibi'],
          answer:
            'I retired at half past ten, as I always do. A house does not run itself on late hours.',
        },
        {
          topics: ['voices', 'argument', 'study', 'hear'],
          answer:
            'There were voices, yes. A man and a woman, near midnight, from the study. I assumed it was business. With Edmund, it was always business.',
        },
        {
          topics: ['pearls', 'money', 'debt', 'jewel'],
          answer: 'My jewellery is hardly the subject of the evening, is it? How curious of you.',
        },
        {
          topics: ['marriage', 'husband', 'edmund', 'relationship'],
          answer:
            'My husband was a great man. Great men are rarely kind ones. I made my peace with the exchange.',
        },
      ],
    },
    {
      id: 's-ashworth',
      name: 'Captain James Ashworth',
      portraitAsset: '/art/blackwood-hall/cast/s-ashworth.jpg',
      publicBio:
        'A decorated veteran of the Somme, friend of the late Blackwood heir. Invited for the shooting; stayed for reasons less clear.',
      persona:
        'Clipped soldier’s answers that fray under pressure. Guilt radiates off him. ' +
        'Becomes defensive when the war or money is raised.',
      voice: 'ash',
      voiceDirection:
        'A man of thirty-eight, army officer class, clipped and forward-placed. Speaks ' +
        'in short bursts with the breath held between them. Tight jaw. Under pressure ' +
        'the pace quickens and the pitch climbs, and he swallows the ends of words.',
      knowledge: {
        knows: [
          'He quarrelled with Sir Edmund at ten o’clock — he had asked for a loan and been refused with contempt.',
          'He came down again at half past twelve, found the body, checked for a pulse — bloodying his cuff — and, God forgive him, said nothing and went back up.',
          'While kneeling by the body he saw a light still burning under the study door above.',
        ],
        believes: [
          'Sir Edmund kept a private ledger nobody else was permitted to touch.',
          'Miss Cross worked later than anyone in that house.',
        ],
        hides: [
          'His gambling debts in London are ruinous — the loan was his last resort.',
          'He found the body and told no one. He is ashamed and terrified it hangs him.',
        ],
        liesAbout: [
          {
            topic: 'whether he left his room after retiring',
            lie: 'At first he claims he went straight to bed after the quarrel and heard nothing all night.',
          },
        ],
      },
      answerBank: [
        {
          topics: ['quarrel', 'argument', 'loan', 'money', 'ten'],
          answer:
            'We had words at ten, I don’t deny it. I asked him for help and he laughed at me. That is not a thing a man kills over. It is a thing he drinks over.',
        },
        {
          topics: ['blood', 'cuff', 'shirt', 'stain'],
          answer: '…I had a nosebleed. The cold air does it. Old trouble from the war.',
        },
        {
          topics: ['bed', 'room', 'night', 'hear', 'alibi'],
          answer: 'I went up after our talk and stayed up. I heard nothing. Nothing at all.',
        },
        {
          topics: ['war', 'somme', 'service'],
          answer:
            'I don’t speak of the war. You may ask the Colonel for my record if you doubt it.',
        },
      ],
    },
    {
      id: 's-cross',
      name: 'Miss Evelyn Cross',
      portraitAsset: '/art/blackwood-hall/cast/s-cross.jpg',
      publicBio:
        'Sir Edmund’s private secretary these four years. Precise, indispensable, and the only member of staff he ever trusted with the books.',
      persona:
        'Composed, intelligent, quietly formidable. Answers exactly what is asked and ' +
        'not a word more. If confronted with evidence, concedes the smallest possible ground. ' +
        'Never confesses. Never admits to being on the landing.',
      voice: 'coral',
      voiceDirection:
        'A woman of thirty-two. Educated, warm on the surface, northern vowels almost ' +
        'entirely trained out — they surface only when she is startled. Unhurried and ' +
        'exact, like someone reading back a ledger. Never louder, never faster; the ' +
        'more serious the question, the quieter and more courteous she becomes.',
      knowledge: {
        knows: [
          'She keeps the ledgers and drafted most of Sir Edmund’s correspondence.',
          'Sir Edmund had grown suspicious of the accounts and had begun reviewing them himself at night.',
          'She held one of the three study keys.',
        ],
        believes: [
          'Captain Ashworth was desperate for money and was refused that evening.',
          'Lady Margaret’s composure is an expensive performance.',
        ],
        hides: [
          'She was in the study at midnight when Sir Edmund confronted her about the ledger.',
          'Her father was Arthur Cross of Cross & Sons, Engineers — ruined by Blackwood in 1919; he died within the year.',
          'She has been quietly diverting small sums for three years — restitution, as she sees it.',
        ],
        liesAbout: [
          {
            topic: 'where she was at midnight',
            lie: 'She says she retired to her room at eleven and slept until the alarm was raised.',
          },
          {
            topic: 'her family and her father',
            lie: 'She says her father was a schoolmaster in Shropshire who died of influenza.',
          },
        ],
      },
      answerBank: [
        {
          topics: ['midnight', 'study', 'where', 'alibi', 'night'],
          answer:
            'I retired at eleven. The accounts keep long hours, but even I must sleep, and I did.',
        },
        {
          topics: ['ledger', 'accounts', 'books', 'figures', 'money'],
          answer:
            'I keep the ledgers as Sir Edmund directed. If an entry is overwritten, then Sir Edmund overwrote it. It was his ledger, after all.',
        },
        {
          topics: ['father', 'family', 'cross', 'shropshire'],
          answer:
            'My father taught school in Shropshire. He died when I was young. I fail to see what he has to do with tonight.',
        },
        {
          topics: ['edmund', 'employer', 'work', 'secretary'],
          answer:
            'Sir Edmund was exacting and I suited him. Loyalty is a habit, like accuracy. I gave him both.',
        },
      ],
    },
    {
      id: 's-harmsworth',
      name: 'Dr Lionel Harmsworth',
      portraitAsset: '/art/blackwood-hall/cast/s-harmsworth.jpg',
      publicBio:
        'The family physician of twenty years. Amiable, port-fond, and in and out of every bedroom in the Hall with his black bag.',
      persona:
        'Bluff, genial, evasive by joviality. Protects his patients’ confidences ' +
        'like a dragon on gold, which makes him look guiltier than he is.',
      voice: 'onyx',
      voiceDirection:
        'A man of sixty-four, plummy and port-warmed, a good deal of chest in it. ' +
        'Rolls into his sentences and chuckles halfway through his own. Rambles ' +
        'affably, doubles back, loses the thread when it suits him. Genuinely fond ' +
        'of everyone, which is how he avoids answering anything.',
      knowledge: {
        knows: [
          'He examined the body: death from the fall, around midnight; no trace of poison or violence beyond it.',
          'He was with Lady Margaret from eleven until past midnight on a private medical matter.',
          'A phial of morphia is missing from his bag — he suspects Lady Margaret took it.',
        ],
        believes: [
          'Sir Edmund’s heart was sound; the fall alone killed him.',
          'The Captain is a frightened man, not a violent one.',
        ],
        hides: [
          'Lady Margaret’s laudanum dependence, and that he was treating her that night.',
          'The missing morphia phial.',
        ],
        liesAbout: [
          {
            topic: 'where he was between eleven and midnight',
            lie: 'He says he was reading in his room with a glass of port.',
          },
        ],
      },
      answerBank: [
        {
          topics: ['body', 'death', 'examine', 'cause', 'poison'],
          answer:
            'He died of the fall — the neck, instantly, around midnight. No poison, no wound besides. Whatever happened, it happened at the top of those stairs.',
        },
        {
          topics: ['where', 'room', 'night', 'alibi', 'eleven'],
          answer:
            'In my room with Mr Dickens and a very tolerable port. A doctor learns to sleep when he can.',
        },
        {
          topics: ['morphia', 'bag', 'phial', 'medicine', 'missing'],
          answer:
            'My bag is my business, and my patients’ business, and neither is yours, with respect.',
        },
        {
          topics: ['margaret', 'lady', 'patient'],
          answer:
            'Lady Blackwood is my patient. You will get nothing from me there, and you should think better of me for it.',
        },
      ],
    },
    {
      id: 's-reeves',
      name: 'Mr Thomas Reeves',
      portraitAsset: '/art/blackwood-hall/cast/s-reeves.jpg',
      publicBio:
        'Butler at Blackwood Hall these thirty years. Served Sir Edmund’s father before him. The house runs on his pocket watch.',
      persona:
        'Formal, unshakeable, loyal to the house itself rather than to any one member of it. ' +
        'Delivers devastating facts in a tone suitable for announcing dinner.',
      voice: 'fable',
      voiceDirection:
        'A man of fifty-eight, thirty years in service. Formal English, entirely level, ' +
        'unhurried, each sentence closed and set down. Announces a bloodstain in exactly ' +
        'the tone he would use for announcing dinner. No emphasis, no colour, no ' +
        'hesitation — the flatness is the performance.',
      knowledge: {
        knows: [
          'He locked and bolted every outside door at eleven; all were still bolted when the alarm was raised. No one entered or left the Hall.',
          'He found the body at 12:20 and stopped no clock — the hall clock was broken by the fall itself.',
          'Sir Edmund had asked him, a week past, whether Miss Cross ever worked in the study after the household retired.',
          'Only Sir Edmund, Miss Cross, and he himself held keys to the study.',
        ],
        believes: [
          'The master had begun to distrust someone close to him — he had never before questioned Miss Cross’s hours.',
        ],
        hides: [
          'Thirty years ago he helped the late master conceal a scandal; he will volunteer nothing that stains the family name.',
        ],
        liesAbout: [],
      },
      answerBank: [
        {
          topics: ['doors', 'locked', 'bolt', 'outside', 'intruder'],
          answer:
            'Every door bolted at eleven, as they have been these thirty years. Come morning, every bolt was as I left it. Whoever did this slept beneath this roof.',
        },
        {
          topics: ['body', 'found', 'clock', 'twelve'],
          answer:
            'I found the master at twenty past twelve. The hall clock stood at four minutes past — it was struck in the fall. Time of a kind, sir, kept to the very end.',
        },
        {
          topics: ['keys', 'study', 'key'],
          answer:
            'Three keys to the study: the master’s, my own, and Miss Cross’s. There have never been more.',
        },
        {
          topics: ['cross', 'secretary', 'hours', 'suspicion'],
          answer:
            'A week ago the master asked me whether Miss Cross worked in the study after the house retired. In thirty years he had never asked me such a thing.',
        },
      ],
    },
  ],
  // The roles are the theme's, not this case's: PlayerCharacter carries no
  // solution and no Blackwood-specific fact, so every case in the house shares
  // the pool. Twenty roles to a table of four to eight is the point — the deal
  // casts differently every session.
  /**
   * Roughly seventy seconds. Deliberately not two minutes: a room that has just
   * sat down will watch about a minute of atmosphere before it wants to act.
   * It also puts the theme's unused scenes to work — the moor road, the dining
   * room, the billiard room and the servants' passage appear nowhere else.
   */
  prologue: {
    voice: 'ballad',
    voiceDirection:
      'A man of about sixty. English, unhurried, low and grave, telling it rather than ' +
      'performing it. Long pauses between sentences. Absolutely no relish — the facts are ' +
      'doing the work, and he knows it.',
    beats: [
      {
        sceneAsset: '/art/deco-1920s/scene/moor-road.jpg',
        text: 'The road over the moor closed at dusk, and the snow has not stopped since.',
      },
      {
        sceneAsset: '/art/deco-1920s/scene/hall-exterior.jpg',
        text: 'Blackwood Hall stands eleven miles from the nearest constable. Tonight it may as well be a thousand.',
      },
      {
        sceneAsset: '/art/deco-1920s/scene/dining-room.jpg',
        text: 'Eleven people sat down to dinner. Sir Edmund Blackwood — industrialist, host, and enemy to half the county — carved.',
      },
      {
        sceneAsset: '/art/deco-1920s/scene/billiard-room.jpg',
        text: 'By nine the party had scattered through the house, and by ten it had stopped pretending to enjoy itself.',
      },
      {
        sceneAsset: '/art/deco-1920s/scene/study.jpg',
        text: 'At ten o’clock there were raised voices in the study. A man and a woman. The word “beggar” was used, and not kindly.',
      },
      {
        sceneAsset: '/art/deco-1920s/scene/staircase.jpg',
        text: 'At seven minutes past midnight, Sir Edmund was found at the foot of his own grand staircase. He did not fall.',
      },
      {
        sceneAsset: '/art/deco-1920s/scene/servants-passage.jpg',
        text: 'The telephone line came down with the storm. The police cannot reach the Hall before morning.',
      },
      {
        sceneAsset: '/art/deco-1920s/scene/entrance-hall.jpg',
        text: 'So everyone who could have done it is still inside this house. And so are you.',
        holdMs: 6000,
      },
    ],
  },
  characters: DECO_1920S_CHARACTERS,
  clues: [
    // ---- Act 1: the body, the house, the first threads ----
    {
      id: 'c-diary',
      act: 1,
      key: true,
      moment: 'detail',
      title: 'The Appointment Diary',
      text: 'Sir Edmund’s desk diary, open to today. The final entry, in his own hand: “E.C. — midnight — the study. Settle it.”',
    },
    {
      id: 'c-clock',
      act: 1,
      key: false,
      moment: 'detail',
      title: 'The Stopped Clock',
      text: 'The hall clock stopped at 12:04 — struck, says Reeves, in the fall itself. Whatever happened, it happened at four minutes past midnight.',
    },
    {
      id: 'c-ledger',
      act: 1,
      key: true,
      moment: 'big-picture',
      title: 'The Overwritten Ledger',
      text: 'A ledger page from the study: neat columns, but a dozen figures overwritten, and the correcting ink is fresher than the entries by years. Someone has been revising history in small amounts, for a long time.',
    },
    {
      id: 'c-row',
      act: 1,
      key: false,
      moment: 'conflict',
      title: 'The Quarrel at Ten',
      text: 'The footman heard Captain Ashworth and Sir Edmund quarrelling violently in the study at ten o’clock. The word “beggar” was used, and not kindly.',
    },
    {
      id: 'c-cuff',
      act: 1,
      key: false,
      moment: 'challenge',
      title: 'The Bloodied Cuff',
      text: 'Captain Ashworth’s evening shirt, given to the laundry maid this morning. The right cuff is spotted with blood.',
    },
    {
      id: 'c-pearls',
      act: 1,
      key: false,
      moment: 'big-picture',
      title: 'The Jeweller’s Receipt',
      text: 'In the morning room bureau: a discreet receipt from a Leeds jeweller for “copying in paste — one pearl rope”. Lady Margaret’s pearls are not what they seem, and neither are her finances.',
    },
    {
      id: 'c-bolts',
      act: 1,
      key: false,
      moment: 'synthesis',
      title: 'The Bolted Doors',
      text: 'Reeves bolted every outside door at eleven. Every bolt was still thrown when the alarm was raised. No footprints mark the snow on any side of the house. Whoever did this is still in it.',
    },
    {
      id: 'c-thread',
      act: 1,
      key: false,
      moment: 'detail',
      title: 'The Grey Thread',
      text: 'Caught on the staircase finial at the landing — a scrap of fine grey worsted wool. Nobody was wearing grey at dinner.',
    },
    // ---- Act 2: the lies begin to show ----
    {
      id: 'c-letter',
      act: 2,
      key: false,
      moment: 'big-picture',
      title: 'The Torn Letter',
      text: 'In the study grate, half-burned: “…you ruined him as you ruin everyone, and called it business. I have not forgotten, and I do not forgive.” Unsigned. A woman’s hand.',
    },
    {
      id: 'c-typewriter',
      act: 2,
      key: true,
      moment: 'listening',
      title: 'The Unfinished Letter',
      text: 'Still wound into the study typewriter: “To whom it may concern — Miss E. Cross leaves my employ on the 31st inst. I am unable to provide the character she—” The sentence was never finished.',
    },
    {
      id: 'c-light',
      act: 2,
      key: true,
      moment: 'listening',
      title: 'The Light Under the Door',
      text: 'The governess, awake past midnight with a toothache, saw lamplight under the study door at twelve — a quarter hour after Miss Cross says she went to bed. She mentioned it to no one; nobody asked her.',
    },
    {
      id: 'c-found',
      act: 2,
      key: false,
      moment: 'challenge',
      title: 'The Captain’s Admission',
      text: 'Pressed, Captain Ashworth breaks: he came down at half past twelve, found Sir Edmund already dead, checked for a pulse — the blood on his cuff — and, in terror of his debts and his record, crept back to bed and said nothing.',
    },
    {
      id: 'c-morphia',
      act: 2,
      key: false,
      moment: 'conflict',
      title: 'The Missing Morphia',
      text: 'Dr Harmsworth’s bag, glimpsed open: the morphia rack holds five phials where six should sit. The doctor examined the body — and pronounced no poison — himself.',
    },
    {
      id: 'c-constable',
      act: 2,
      key: false,
      moment: 'leadership',
      title: 'Word from the Village',
      text: 'The one working telephone line, briefly restored: the Chief Constable cannot reach the Hall before eight. He asks that the household agree, before then, what account of the night it will give. Someone must decide what that account is.',
    },
    // ---- Act 3: the missing view assembles ----
    {
      id: 'c-keys',
      act: 3,
      key: true,
      moment: 'decision',
      title: 'The Three Keys',
      text: 'The study was locked when the body was found, and the master’s key still in his pocket. Three study keys exist: Sir Edmund’s, Reeves’s — and Miss Cross’s. The study light was burning at midnight behind a locked door.',
    },
    {
      id: 'c-photo',
      act: 3,
      key: true,
      moment: 'synthesis',
      title: 'The Photograph',
      text: 'In a writing case in Miss Cross’s room: a faded photograph of a middle-aged man outside a works gate. The sign above the gate: “CROSS & SONS, ENGINEERS”. Across the back, in pencil: “Bankrupt, Michaelmas 1919. Broken by E.B.”',
    },
    {
      id: 'c-alibi',
      act: 3,
      key: false,
      moment: 'conflict',
      title: 'The Reluctant Alibi',
      text: 'Cornered separately, Lady Margaret and Dr Harmsworth admit the same thing in the same words: they were together from eleven until past midnight, on a medical matter neither will name. Each alibis the other — and hated saying so.',
    },
    {
      id: 'c-coat',
      act: 3,
      key: true,
      moment: 'detail',
      title: 'The Grey Travelling Coat',
      text: 'Miss Cross’s grey worsted travelling coat, hung in the boot room, freshly brushed — but the left sleeve is pulled at the seam, and a thread is gone from it. The scrap on the staircase finial matches it exactly.',
    },
  ],
  acts: [
    {
      number: 1,
      title: 'The Longest Night',
      minutes: 15,
      opening:
        'The snow has the Hall by the throat. Sir Edmund Blackwood lies where he fell, and the nearest policeman might as well be in France. Until morning, the only investigators this house will get are the guests it happens to hold. Begin with what can be seen — and say what you find aloud.',
      commitment: {
        id: 'commit-1',
        prompt: 'The household demands a name. Who, tonight, is your prime suspect?',
        kind: 'suspect',
      },
    },
    {
      number: 2,
      title: 'What the House Heard',
      minutes: 20,
      opening:
        'Daybreak, grey and silent. The stories told last night have begun to come apart at the seams. Someone in this house has lied to you already — the question is whether they lied from guilt, or from fear.',
      commitment: {
        id: 'commit-2',
        prompt: 'Before the Chief Constable calls again: what is your working theory of the crime?',
        kind: 'theory',
        options: [
          {
            id: 'theory-debt',
            label: 'A desperate man: the Captain, refused and humiliated, struck in rage.',
          },
          {
            id: 'theory-marriage',
            label: 'A cold marriage: Lady Margaret, freed at last, with the doctor’s help.',
          },
          {
            id: 'theory-books',
            label:
              'The books: whoever kept Sir Edmund’s figures had reason to fear his midnight audit.',
          },
          {
            id: 'theory-house',
            label: 'The house itself: Reeves, guarding a secret older than this marriage.',
          },
        ],
      },
    },
    {
      number: 3,
      title: 'The Missing View',
      minutes: 15,
      opening:
        'Eight o’clock nears. Every clue this house will surrender is now in someone’s hands — but no one of you holds enough alone. Put the pieces on the table, hear the quietest voice in the room, and agree on a single name. The Hall is listening.',
      commitment: {
        id: 'commit-3',
        prompt: 'The Chief Constable is on the line. The household must give one name.',
        kind: 'suspect',
      },
    },
  ],
  theme: {
    id: 'deco-1920s',
    name: '1920s country house',
    scenes: {
      lobby: '/art/deco-1920s/scene/hall-exterior.jpg',
      act1: '/art/deco-1920s/scene/entrance-hall.jpg',
      act2: '/art/deco-1920s/scene/corridor.jpg',
      act3: '/art/deco-1920s/scene/study.jpg',
      commitment: '/art/deco-1920s/scene/drawing-room.jpg',
      accusation: '/art/deco-1920s/scene/staircase.jpg',
      reveal: '/art/deco-1920s/scene/landing.jpg',
    },
    music: {
      menu: '/music/deco-1920s/menu-music.mp3',
      prologue: '/music/deco-1920s/prologue.mp3',
      inGame: ['/music/deco-1920s/in-game-1.mp3', '/music/deco-1920s/in-game-2.mp3'],
    },
  },

  deal: {
    neverSameHolder: [
      ['c-diary', 'c-ledger'],
      ['c-diary', 'c-light'],
      ['c-ledger', 'c-typewriter'],
      ['c-keys', 'c-photo'],
      ['c-thread', 'c-coat'],
    ],
    minKeyHolders: 3,
  },
  solution: {
    culpritId: 's-cross',
    motive:
      'Revenge and restitution. Sir Edmund ruined her father, Arthur Cross, in 1919; she took the post under him to quietly bleed the ledgers, and killed him when his midnight audit finally cornered her.',
    method:
      'Confronted in the study at midnight and dismissed without character, she followed him onto the landing. At 12:04 she pushed him down the grand staircase, locked the study behind her with her own key, and went to bed.',
    provenBy: ['c-diary', 'c-ledger', 'c-light', 'c-typewriter', 'c-keys', 'c-photo', 'c-coat'],
    narrative:
      'Sir Edmund had finally done what he never did: audited his own trusted secretary. The diary named her — “E.C. — midnight — settle it.” The unfinished letter shows how the interview ended: dismissal, without a character. The governess saw the study light at twelve; the door was locked, and only three keys exist. The overwritten ledger was her slow revenge; the photograph names its reason — Cross & Sons, broken by E.B., Michaelmas 1919. And the grey thread on the finial came from her travelling coat as she turned away at the top of the stairs. Captain Ashworth’s blood, guilt and silence were exactly what they appeared to be: fear. The Hall’s missing view belonged to the quietest witness in it.',
    forbiddenFacts: [
      'Miss Cross pushed Sir Edmund down the stairs',
      'Evelyn Cross killed Sir Edmund',
      'Miss Cross was on the landing at midnight',
      'Miss Cross confesses to the murder',
      'Arthur Cross of Cross & Sons was Evelyn Cross’s father',
    ],
  },
};
