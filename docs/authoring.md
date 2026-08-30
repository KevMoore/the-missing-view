# Authoring a case

```bash
OPENAI_API_KEY=... pnpm author --brief "a Cornish lighthouse, winter 1931"
```

Writes `packages/core/src/cases/<id>.ts`. It does **not** publish: registering the
case in the server's `cases` map is a separate, deliberate act (D14).

## Why this can be trusted

A model asked to invent a whole mystery will produce eighteen clues that sound
like evidence and prove nothing. It is very good at prose and very bad at
arithmetic it cannot see, so it is never asked to do the arithmetic.

`extractSkeleton` lifts the logic off a case that already validates: how many
suspects, which one is guilty, how many clues, which act each arrives in, which
clue rules out which suspect, what must never share a hand. Every word of prose
is dropped — a test asserts the skeleton cannot leak the name "Blackwood" or
"Cross".

The model then fills the skeleton with a new house, cast and evidence, and
`applySkeleton` reassembles the two. **The result satisfies D17 and D27 by
construction rather than by luck**, and the validator becomes a check on craft
rather than a coin toss.

## The stages

One call asked to invent a house, cast it, write eighteen clues that each do a
specific logical job, brief five suspects without telling any of them the answer
and narrate an opening will do all of it adequately and none of it well. So:

| Stage       | Writes                                          | Sees                                                     |
| ----------- | ----------------------------------------------- | -------------------------------------------------------- |
| `cast`      | setting, victim, suspects, voices               | the brief                                                |
| `clues`     | every clue's title and text                     | the cast, and the job list — suspects **by number only** |
| `knowledge` | knowledge sheets and answer banks               | the cast and the evidence                                |
| `dressing`  | title, acts, the narrated opening, the solution | everything                                               |

The clue stage never learns the culprit's name, only that "suspect 3" is guilty.
That is D13 applied at authoring time: the fewer prompts that contain the
solution, the fewer places it can leak from.

## The repair loop

The draft goes to `validateCase`. If it is rejected, the complaints go back to
the model verbatim — `[act1-spoiler] act 1 clue c5 names the culprit` — with an
instruction to change as little as possible. Three attempts by default. The
validator's messages are specific, which is why this converges.

## What the validator cannot tell you

It proves the case is _sound_. It cannot tell you it is _good_. Every drafted
file therefore opens with a review checklist:

- Does act 1 make you suspect the wrong person, and for a decent reason?
- Does every clue that rules someone out say **why**, checkably?
- Is there a moment in act 3 where it turns? Would you feel it?
- Do the five suspects sound like five different people read aloud?
- Is anything in a knowledge sheet the solution in disguise?

Read it before a room does.

## Art, music and voices

The theme is reused wholesale — a theme is deliberately coarser than a case, so
a second mystery in the same setting inherits its scenes, its music and its
twenty player roles, and ships only its own suspects. A brief that leaves the
1920s needs a new theme folder: see `art-and-music.md`.

Every run also writes `<id>.art.md` next to the case: one Autosprite prompt per
suspect plus the victim, already shaped to the recipe and already under the
200-character limit, each with the exact path the finished file must land on.
The case points at those paths from the moment it is drafted, so dropping the
images in is the whole of the wiring. Until then the screen shows initials
rather than a broken image.

The generator runs over MCP at a desk, not from this process, so the CLI writes
the order rather than making the pictures. Draft the case, read it, then paint
the cast you decided to keep — there is no sense painting one you are about to
rewrite.

## Extending it

Today the skeleton always comes from Blackwood Hall, so every drafted case has
the same shape: 5 suspects, 18 clues, proof landing in act 3. That is the safe
version, and it is deliberately the first one.

Varying the shape means generating a skeleton — choosing suspect and clue
counts, then solving for an `exonerates` assignment that leaves exactly one
suspect standing, that no single clue decides, and that no legal hand can decide
alone. That is a constraint-satisfaction problem over small numbers, not a job
for a model, and the validator already encodes every constraint it must meet.
