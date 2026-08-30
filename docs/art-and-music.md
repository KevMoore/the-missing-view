# Art and music

## How assets are addressed

A **theme** is the look and sound of a setting. It is deliberately coarser than a
case: the scenes and music of "a 1920s country house" suit any mystery set in
one, so a second case in the same theme reuses them and ships only its own cast.

```
/art/<theme.id>/scene/*.jpg   backdrops — shared by every case in the theme
/art/<theme.id>/cast/*.jpg    player characters and suspect shells — shared
/art/<case.id>/cast/*.jpg     this case's own suspects and victim
/music/<theme.id>/*.mp3       the theme's music
```

Player characters live under the _theme_, not the case: `PlayerCharacter` holds a
name, a reason to be in the house and an AI leaning, and not one word of any
solution. `packages/core/src/cast/deco-1920s.ts` is the pool — twenty roles and
eight suspect shells — and a case simply takes it.

Nothing in the client hard-codes a path. `CasePack.theme` names the files, the
server picks one scene per beat of the flow and puts it in the screen view, and
the client cross-fades to whatever it is handed (D20). Adding a theme is a
folder plus a case-pack edit.

Every field is optional. A case with no theme still plays; the screen stays
plain and the room is silent.

## Which scene shows when

`Room.sceneAsset()` resolves it, falling back act → lobby so a partly-arted
theme never blanks the stage mid-game.

| Beat                    | Scene key            |
| ----------------------- | -------------------- |
| Lobby, before the start | `lobby`              |
| Act 1 / 2 / 3           | `act1` `act2` `act3` |
| The act commitment vote | `commitment`         |
| An accusation stands    | `accusation`         |
| The reveal              | `reveal`             |

## The opening

`CasePack.prologue` is a list of beats, each a painted scene and one line of
narration. The facilitator plays it from the console once the room is seated;
the screen holds each beat until its narration ends, then hands back to the
lobby. Roughly seventy seconds — deliberately not two minutes, because a room
that has just sat down will watch about a minute of atmosphere before it wants
to act.

It is **not** three.js, and should not become three.js. The art direction is oil
paint and 3D primitives would fight it; WebGL is also a failure mode on a
borrowed venue laptop, and this runs in rooms we do not control. A slow push on
a painted still, a long cross-dissolve and a serif caption read as more
expensive than a rendered scene, and cannot fail to draw.

It is also where the theme's otherwise-unused scenes earn their keep: the moor
road, the dining room, the billiard room and the servants' passage appear
nowhere else in the game.

With no narration audio — no key, a refusal, a case with no `prologue.voice` —
every beat falls back to a fixed hold and the sequence still runs to the end.

## Music

The big screen is the room's only speaker. Phones and the console stay silent —
eight handsets playing the same track a beat apart is noise, not atmosphere.

`prologue` plays under the opening at 0.62 and fades out over three and a half
seconds as the last beat lands, so the score ends with the story rather than
being cut off by the lobby. The menu theme loops under the lobby at volume 0.55. The in-game tracks play in
sequence through the acts at 0.30, low enough to talk over. Browsers block
autoplay until a gesture, so playback only ever starts from the "Take the stage"
submit, and a refused `play()` is swallowed: music is decoration and must never
break the game. There is a mute toggle in the corner of the screen, and it silences a spoken
line already in flight, not merely the score.

## Voices

Suspects speak aloud on the big screen through `gpt-4o-mini-tts` — roughly
sixteen seconds an answer, a few pence across a session. Two fields cast them:

- `Suspect.voice` — which OpenAI voice: `alloy`, `ash`, `ballad`, `coral`,
  `echo`, `fable`, `onyx`, `nova`, `sage`, `shimmer`.
- `Suspect.voiceDirection` — how they _sound_, which is not how they phrase
  things (`persona` is the writing). Name what a listener hears in the first two
  seconds: sex, rough age, accent and class, pace, pitch, and the habit of
  delivery. Be specific, and be unkind where the character earns it — a cast of
  five polite voices is a cast of one.

The written answer reaches the screen first and the voice is chased after it, so
nobody waits on silence. Lines queue and play strictly in turn.

## Generating art

Generated with the Autosprite MCP, `generate_asset_preview`, 1 credit each.

- **Style `painted`, quality `ultra`.** Turbo returns four cheap drafts and is
  useful for locking a direction; ultra returns one polished image and is what
  ships.
  Keep the whole prompt under **200 characters** — the tool rejects anything
  longer, which clips the suffix below.

- **Portraits** — category `character`:

  > Oil portrait of a `<woman|man>`, `<age>`, `<role and period>`, `<features>`,
  > `<expression>`. Warm lamplight, umber ground. Rectangular, fills frame, no
  > white

- **Scenes** — category `prop`:

  > Wide interior view of `<room>`, `<period>`, `<detail>`, empty. Moody oil
  > painting, gold lamplight, deep umber shadow, fills the whole frame, no border

Three traps, each of which cost a regeneration:

1. **Do not write "candlelit".** The model renders actual candles in frame. Ask
   for "warm lamplight" instead.
2. **Do not name a small object in a scene prompt.** "a stopped hall clock" and
   "an overturned candlestick" each produced that object alone on a white
   background, with no room around it. Lead with "Wide interior view of…".
3. **Category `texture` tiles the image.** Use `prop` for scenes; `texture` only
   for genuine repeating patterns.

The generator likes a white margin. `Suspect.portraitAsset` and the scene
layers assume there is none, so trim before committing — the bounding-box
trimmer used for the first pass is in the commit that added this file.

Downscale to 768px for portraits and 1024px for scenes, JPEG quality ~82.

## Looking at the result

```bash
pnpm exec playwright test art-shots   # writes /tmp/tmv-shots/*.png
```

It drives a four-player room through the lobby, act 1, the commitment and act 2,
shooting the big screen and a phone at each beat.
