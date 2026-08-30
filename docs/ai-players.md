# AI players

One person cannot playtest a game built for four to eight. AI players make up
the numbers, so a solo run produces a realistic board.

## What they are

Ordinary players. They join the lobby, are dealt a private hand and an
investigator character by the same seeded deal, and act only through
`Room.handleMove`. Nothing in the engine, the views, or the reveal knows a bot
from a human — which is the point: the reveal counts their moves too.

Seat one from the facilitator console: **Add an AI player**, in the lobby, before
the game starts. The console marks them 🤖; the big screen and the phones do not,
because the room should not be reminded.

## Their personas

A bot's personality is its dealt `PlayerCharacter`, not a separate invention. The
Retired Inspector interrogates. The Journalist theorises. The American Heiress
challenges. `PlayerCharacter.botLean` in the case pack picks the behaviour, so a
new case brings its own personalities instead of inheriting Blackwood Hall's.

| Lean          | What it does                           |
| ------------- | -------------------------------------- |
| `interrogate` | Puts questions to the suspects         |
| `theorise`    | Proposes readings of the evidence      |
| `challenge`   | Pushes back on other people's theories |
| `detail`      | Gets clues onto the board              |
| `listen`      | Backs what others say, and says little |

The words come from `phraseBotLine`, which is given the case setting, the bot's
own character, and only what is already on the shared evidence board — never the
solution, never another player's hand (D13). With no `OPENAI_API_KEY` it returns
null and the bot uses a deterministic line, so AI players work with no API key at
all.

## Two things they never do

- **Accuse.** Ending the game is the human's call, always.
- **Whisper.** A private nudge to a bot goes nowhere and would waste the move.

They also always clear their hand eventually: a bot sitting on a key clue would
make the case unsolvable, so an untabled clue outranks everything except a theory
the bot has not yet answered.

## Pace

One bot acts per tick, round-robin, every 25 seconds. Commitment votes land after
a 6-second pause so the room sees the prompt first, and the bots deliberately
spread across the options — a 4–0 vote tells the human nothing.

Set `TMV_BOT_TICK_MS` to speed them up while testing. The e2e suite runs at 2000.

```bash
TMV_BOT_TICK_MS=2000 pnpm --filter @tmv/server dev
```
