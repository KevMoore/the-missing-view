# Art and music

## How assets are addressed

A **theme** is the look and sound of a setting. It is deliberately coarser than a
case: the scenes and music of "a 1920s country house" suit any mystery set in
one, so a second case in the same theme reuses them and ships only its own cast.

```
/art/<theme.id>/scene/*.jpg   backdrops — shared by every case in the theme
/art/<case.id>/cast/*.jpg     portraits — specific to one case
/music/<theme.id>/*.mp3       the theme's music
```

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

## Music

The big screen is the room's only speaker. Phones and the console stay silent —
eight handsets playing the same track a beat apart is noise, not atmosphere.

The menu theme loops under the lobby at volume 0.55. The in-game tracks play in
sequence through the acts at 0.30, low enough to talk over. Browsers block
autoplay until a gesture, so playback only ever starts from the "Take the stage"
submit, and a refused `play()` is swallowed: music is decoration and must never
break the game. There is a mute toggle in the corner of the screen.

## Generating art

Generated with the Autosprite MCP, `generate_asset_preview`, 1 credit each.

- **Style `painted`, quality `ultra`.** Turbo returns four cheap drafts and is
  useful for locking a direction; ultra returns one polished image and is what
  ships.
- **Portraits** — category `character`:

  > Oil portrait of a `<woman|man>`, `<age>`, `<role and period>`, `<features>`,
  > `<expression>`. Warm lamplight, deep umber ground. Rectangular canvas fills
  > frame, no oval, no white

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
