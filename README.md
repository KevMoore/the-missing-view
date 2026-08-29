# The Missing View

*One mystery. Different perspectives.*

An online interactive murder mystery for co-located teams: a facilitator's laptop
drives the big screen, every player joins on their phone, and the room does the
talking. After the case is solved, the game turns the lens back on the team —
who probed, who challenged, who quietly tabled the clue that broke it.

**Case one:** *Death at Blackwood Hall* — a snowbound Yorkshire country house,
December 1926. 4–8 players, three acts, about an hour.

## Repo shape

| Path | What it is |
| --- | --- |
| `packages/core` | Case schema, publication validator (D17), seeded deal, pure game engine, reveal counters. Fully unit tested. |
| `apps/server` | Node WS server: rooms, role-scoped views, LLM suspects (knowledge-sheet-contained, banked fallback), reveal builder, optional Postgres. |
| `apps/web` | One Vite/React bundle, three surfaces: `/` phone · `/screen` big screen · `/console` facilitator. |
| `e2e` | Playwright: full game + accusation flow across multiple browser contexts. |
| `docs` | `decisions.md` (the D-numbers referenced in code) and `build-plan.md`. |

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

| Var | Effect when set |
| --- | --- |
| `ANTHROPIC_API_KEY` | Live LLM suspects + LLM-phrased reveal. Unset: banked answers and deterministic prose — the game still fully works. |
| `DATABASE_URL` | Persists finished games + email opt-ins to Postgres. Unset: in-memory only. |
| `PORT` | Server port (default 3001). |
| `WEB_DIST` | Path to the built web bundle (defaults to `apps/web/dist`). |

## Deploy

Deployed on Render (`the-missing-view.onrender.com`): Node web service, build
`pnpm install && pnpm --filter @tmv/web build`, start
`pnpm --filter @tmv/server exec tsx src/index.ts`. Auto-deploys on push to `main`.
