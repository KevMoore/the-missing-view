# The Missing View — Build Plan

Derived from `decisions.md`. Ordered so the riskiest assumption is tested first.

## Riskiest assumption

Not the software. It is: **does a hand-authored clue graph, played by six adults in a room, produce a genuine "aha" at the reveal?**

Everything below is sequenced to answer that as cheaply as possible.

## Phase 0 — Paper playtest (no code)

Author case one (1920s country house) as a clue pool on index cards. Run it live with six people, a whiteboard as the "big screen" and a human reading the suspects.

Proves or kills: the clue graph, the three-act pacing, whether the eight team moments actually fire, and whether the reveal lands. If this does not work on paper, no amount of TypeScript saves it.

**Exit criteria:** two separate groups reach a correct accusation inside 50 minutes, and at least one person says some version of "I didn't realise it was about us".

## Phase 1 — Foundations

- Monorepo: `case-schema`, `engine`, `server`, `screen`, `phone`, `console`, `author`.
- `case-schema`: the clue pool, cast, knowledge sheets, forbidden facts, act structure, team-moment markers.
- `engine`: pure functions, no I/O. Deal, table, whisper, challenge, back, act transitions, accusation. Fully unit tested — this is where the rules live.
- `validator`: gates a case on the D17 rules and simulates the deal for n = 4..8.

Case one from Phase 0 is encoded and must pass the validator.

## Phase 2 — The room

- Server: WebSocket rooms, server-authoritative state, room codes, deal on start.
- Screen client: join code + QR, evidence board, act timer, suspect stage, accusation.
- Phone client: character, private dossier, table, whisper, submit question, act commitment.
- Facilitator console: start, monitor, extend an act, force the act break, trigger the reveal.

No LLM yet. Suspects answer from a hand-written bank. **A full session is playable end to end.**

## Phase 3 — The suspects come alive

- Suspect agents built strictly from per-character knowledge sheets (D13).
- Forbidden-facts check before display, regenerate on a hit.
- Answer-bank pre-generation at publish time; automatic fallback on timeout or offline (D15).
- Game-master pacing nudges on deterministic triggers.

**Adversarial test: a team actively tries to make a suspect confess. It must not.**

## Phase 4 — The reveal

- Deterministic behaviour counters over the logged move stream.
- LLM turns counters into prose, every line citing a logged act.
- Three outputs: shared screen (strengths only), private phone read, facilitator team-shape view (D11).
- Debrief script.

## Phase 5 — Authoring

- Authoring tool: prompt → draft case → validator → human review → publish.
- Case two, produced through the tool, to prove the pipeline.

## What is deliberately not in the MVP

Payments. Player accounts. Remote/online mode. Multiple simultaneous teams. Team history across sessions. Custom organisational themes.
