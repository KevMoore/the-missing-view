# The Missing View — Decision Record

Status: locked from the CTO grilling session, 2026-08-29.
These decisions override the PRD wherever they differ. Divergences are marked.

## Play mode

| #   | Decision                                                                                                                                                               | Notes                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Co-located play.** Facilitator laptop drives a big screen; each player joins on their own phone. All debate is face to face.                                         | **Diverges from PRD §13** ("designed specifically for remote/online group play"). Remote mode is deferred, not cancelled. |
| D2  | **No microphone, no recording.**                                                                                                                                       | Follows from D1. Kills the transcript, so see D9.                                                                         |
| D3  | **Join with a room code + first name.** No player accounts. Facilitator is the only account holder. Opt-in email capture after the reveal to receive the private read. | Under ten seconds to join. No IT involvement.                                                                             |
| D4  | **Facilitator does not play.** They run the session from a console.                                                                                                    | A team of six needs a seventh body. Accepted.                                                                             |

## Game design

| #   | Decision                                                                                                                         | Notes                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| D5  | **Three timed acts, each ending in a forced team commitment.** Act 1 gather (~15m), Act 2 pressure (~20m), Act 3 commit (~15m).  | Guarantees pacing, gives the eight team moments somewhere to live.                                                         |
| D6  | **Clues are private until tabled.** Tabling is an explicit, credited act. Private whispers to one player are allowed.            | The evidence board is the team's shared brain, built by named people.                                                      |
| D7  | **Interrogation: anyone submits a question from their phone; it is queued, then answered on the big screen for the whole room.** | Heads stay up. We still know who asked what.                                                                               |
| D8  | **Final accusation is a single team answer.** No private pre-vote.                                                               | CTO call. Cost accepted: we lose the private-vs-public judgement gap. Partially recovered from act-end commitment changes. |
| D18 | **Case one: 1920s country house, full period piece.**                                                                            | CTO call. Cost accepted: period authoring burden, costume-party brand risk.                                                |

## Insight engine

| #   | Decision                                                                                                                                                                                         | Notes                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| D9  | **Signals are phone moves only.** If a behaviour matters, it has a button: table, whisper, challenge, back a theory, ask a suspect, nominate, change position at an act break.                   | Fully deterministic and explainable. No audio.                  |
| D10 | **Scoring is deterministic; the LLM only writes the prose.** Every line of the reveal cites a real logged act with a timestamp.                                                                  | The model never decides who you are.                            |
| D11 | **Visibility.** Big screen: one named strength per player, with evidence. Player's phone: the fuller private read. Facilitator: team shape and blind spots only — **never per-person profiles.** | Protects the room. Keeps us out of "HR assessment" positioning. |

## LLM

| #   | Decision                                                                                                                                                                                                                                        | Notes                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| D12 | LLM plays the suspects, writes the reveal, and acts as game master for pacing nudges.                                                                                                                                                           |                                                                                        |
| D13 | **The model is never told the solution.** Each suspect prompt carries only `knows` / `believes` / `hides` / `lies_about` for that character. Replies are checked against the case's `forbidden_facts` before display, and regenerated on a hit. | Containment by construction, not by instruction. Immune to prompt injection by design. |
| D14 | **Mysteries are generated by an authoring tool, never at runtime.** LLM drafts → automatic validator → human review → published case. Runtime loads published cases only.                                                                       |                                                                                        |
| D15 | **Every published case ships a pre-generated answer bank.** On timeout or network loss the server serves the nearest banked answer.                                                                                                             | Venue wifi is the top session-killing risk. Also caps cost and latency.                |

## Content model

| #   | Decision                                                                                                                                                                                                            | Notes                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| D16 | **Clues are a pool with ownership constraints, dealt at start for the actual head count.** Validator proves solvable and fair for n = 4..8. Late arrivals are dealt in.                                             | No session ever fails to start because someone is off sick. |
| D17 | Validator gates on: exactly one solution; the solution needs clues from ≥3 different holders; every player holds ≥1 unique key fact; no player can solve it alone; all eight team moments present; no orphan clues. | This validator is the core IP.                              |

## Tech and commercials

| #   | Decision                                                                                                                                                                                              | Notes                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| D19 | **TypeScript end to end.** React + Vite clients (screen, phone, facilitator console), Node server, WebSockets, Postgres. Monorepo with a shared `case-schema` package.                                | Chosen over .NET/SignalR specifically so the case schema cannot drift between authoring, validation, server and clients.        |
| D20 | **Server-authoritative.** All rules and all model calls server-side. Clients render state and send intents.                                                                                           |                                                                                                                                 |
| D21 | **Security light for the MVP**, but room codes are unguessable, dossiers are never sent to the wrong phone, and the solution never reaches a client before the reveal.                                |                                                                                                                                 |
| D22 | **No payments in the MVP.** Facilitator accounts created by hand; paid pilots invoiced off-platform.                                                                                                  | Success signal: a facilitator we have never met runs a session that lands, and books another.                                   |
| D23 | **`/` serves two audiences, told apart by the QR code's `?code=` parameter.** With a code, it is the join form alone. Without one, it is the front door: premise, join, run a game, and how it works. | A fourth route would split the story and drift. The QR must never pay for the landing page — asserted in `e2e/landing.spec.ts`. |

## Open, not yet decided

- Text-vs-voice for the deferred remote mode (D1) — assumed text, unconfirmed.
- Per-game cost ceiling. (Model settled: `gpt-5.6-luna` via the OpenAI Responses API, reasoning effort `none` for suspects and `low` for the reveal.)
- Whether act-break micro-prompts ("who made you rethink?") are added to recover the quiet-contributor signal lost with D2/D8.
- Debrief format: on-screen script, printed pack, or emailed follow-up.
- Domain and brand. (Visual direction settled: painted gallery-oil portraits and scenes on a 1920s art-deco treatment — see `docs/art-and-music.md`.)
