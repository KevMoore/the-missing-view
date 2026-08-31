# The Missing View

_One mystery. Different perspectives._

An online interactive murder mystery for co-located teams: a facilitator's laptop
drives the big screen, every player joins on their phone, and the room does the
talking. After the case is solved, the game turns the lens back on the team —
who probed, who challenged, who quietly tabled the clue that broke it.

**Case one:** _Death at Blackwood Hall_ — a snowbound Yorkshire country house,
December 1926. 4–8 players, three acts, about an hour.

## Two ways to play

**One house.** Four to eight players, one investigation. The accusation is the
house's: every player commits to a name, and it locks only when they all commit
to the same one (D36). If a phone dies mid-accusation the facilitator can let
the house accuse without it — but only while that player is actually gone (D41).

**Two houses, head to head.** Eight to sixteen. The facilitator splits them and
casts them; each house gets the same case, its own deal, and its own big screen,
and never sees the other's board (D38, D40). Compared at the end — the debrief
question is not which house won, it is what each did differently with the same
evidence. Two houses want two displays, out of each other's sight.

## Repo shape

| Path            | What it is                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core` | Case schema, publication validator (D17), seeded deal, pure game engine, reveal counters. Fully unit tested.                            |
| `apps/server`   | Node WS server: rooms, role-scoped views, LLM suspects (knowledge-sheet-contained, banked fallback), reveal builder, optional Postgres. |
| `apps/web`      | One Vite/React bundle, three surfaces: `/` phone · `/screen` big screen · `/console` facilitator.                                       |
| `e2e`           | Playwright: full game, accusation flow, and the two-house isolation, across multiple browser contexts.                                  |
| `docs`          | `decisions.md` (the D-numbers referenced in code), `build-plan.md`, `art-and-music.md`, `ai-players.md`.                                |

## Playing solo

The facilitator console can seat **AI players** to make up the four-player
minimum. They are dealt characters and play them, and with two houses they fill
whichever house needs them. They do not vote on the accusation — a bot cannot be
responsible for a decision the team made. See `docs/ai-players.md`.

## Art and music

Painted portraits and per-beat backdrops, addressed by theme so a second case in
the same setting reuses them. See `docs/art-and-music.md` for the asset layout,
the scene table, and the Autosprite prompt recipe.

## Run it locally

```bash
pnpm install
pnpm --filter @tmv/server dev     # server on :3001
pnpm --filter @tmv/web dev        # vite on :5173 (proxies /ws)
```

Open `/console` to create a room, `/screen` on the big display, `/` on phones.

## Gates

```bash
pnpm test                 # unit tests (core + server)
pnpm run lint             # eslint (type-checked) + prettier
pnpm run typecheck
pnpm exec playwright test # e2e (builds web, boots server on :3102)
```

## Environment

| Var              | Effect when set                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY` | Live LLM suspects + LLM-phrased reveal, via `gpt-5.6-luna`. Unset: banked answers and deterministic prose — the game still fully works. |
| `DATABASE_URL`   | Persists finished games + email opt-ins to Postgres. Unset: in-memory only.                                                             |
| `PORT`           | Server port (default 3001).                                                                                                             |
| `WEB_DIST`       | Path to the built web bundle (defaults to `apps/web/dist`).                                                                             |

## Deploy

Deployed on Render (`the-missing-view.onrender.com`): Node web service, build
`pnpm install && pnpm --filter @tmv/web build`, start
`pnpm --filter @tmv/server exec tsx src/index.ts`. Auto-deploys on push to `main`.
