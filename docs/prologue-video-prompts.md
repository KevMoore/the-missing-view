# Prologue video — Veo prompts for Google AI Studio

Eight shots, one per beat of the existing opening. Each is written for an ~8
second Veo clip; cut together they run about 65 seconds, which is the length the
painted sequence already runs and the length a seated room will actually watch.

The painted sequence stays in the code as the fallback. If a shot fails, or the
video never finishes, the game loses nothing.

## Before you start

**Keep the style block identical in every prompt.** It is the only thing holding
eight separately-generated clips together as one film. Copy it verbatim; do not
improve it between shots.

**Three things to say every time, because Veo does them uninvited:**

- `no on-screen text, no subtitles, no title cards` — it likes to caption things.
  Our narration is a separate track and the captions are drawn by the app.
- `no dialogue, no voiceover` — we have a narrator already, and a second voice
  underneath him is unusable.
- `no modern objects` — watch for tarmac road markings, plastic, and modern
  glazing bars.

**Generate ambient audio only** — wind, fire, clocks, footsteps. That layers
under our narrator. If Veo insists on speech, regenerate rather than accept it.

**Aspect and length:** 16:9, the longest duration the model offers. Shoot a
couple of takes of shots 6 and 8 — they carry the most weight.

## The style block

> Style: photoreal 35mm film, 1926 England, anamorphic, shallow depth of field,
> heavy film grain, muted desaturated palette of umber, black and cold blue,
> warm practical lamplight only, deep shadow, slow deliberate camera move,
> no on-screen text, no subtitles, no dialogue, no voiceover, no modern objects.

## The eight shots

Each heading is the narration line that plays over it, so you can check the cut
against the audio.

**1 — "The road over the moor closed at dusk, and the snow has not stopped since."**

> A narrow country road across an open moor at dusk in a heavy snowstorm. A
> single abandoned 1920s motorcar sits half-buried at the verge, headlamps dark,
> snow driving across the frame in the wind. Bare thorn trees bending. Slow push
> in along the road. Ambient audio: wind, driving snow. [style block]

**2 — "Blackwood Hall stands eleven miles from the nearest constable. Tonight it may as well be a thousand."**

> A large Victorian Gothic country house seen at night from the end of a long
> drive, in falling snow. Most windows dark; two or three lit warm gold. Slow
> push toward the front door. Ambient audio: wind, distant rooks. [style block]

**3 — "Eleven people sat down to dinner. Sir Edmund Blackwood — industrialist, host, and enemy to half the county — carved."**

> A long formal dining table in a wood-panelled English country house, laid for
> eleven, silver and crystal, candelabra burning, a joint of meat at the head of
> the table. Chairs pushed back at odd angles. No people in shot. Slow lateral
> track along the table. Ambient audio: fire, a clock. [style block]

**4 — "By nine the party had scattered through the house, and by ten it had stopped pretending to enjoy itself."**

> A billiard room in a 1920s English country house, late evening. Abandoned
> mid-game: balls scattered, two cues left on the cloth, a cigar still smoking in
> an ashtray, a whisky half drunk. Empty of people. Slow drift across the table.
> Ambient audio: a ticking clock, faint wind. [style block]

**5 — "At ten o'clock there were raised voices in the study. A man and a woman. The word 'beggar' was used, and not kindly."**

> A closed heavy oak study door seen from a dark panelled corridor, warm light
> spilling from the gap beneath it. Two shadows moving across that light. Slow
> push toward the door. Ambient audio: muffled indistinct argument behind the
> door, too faint to make out words. [style block]

**6 — "At seven minutes past midnight, Sir Edmund was found at the foot of his own grand staircase. He did not fall."**

> The foot of a grand carved wooden staircase in a dark country house hall, one
> lamp burning. A man's dropped spectacles and an overturned side table at the
> bottom step. No body in shot. Slow tilt up the empty staircase into darkness.
> Ambient audio: a single clock chime, then silence. [style block]

**7 — "The telephone line came down with the storm. The police cannot reach the Hall before morning."**

> A narrow bare servants' passage in a country house, a wall-mounted 1920s
> telephone, its cord hanging cut and swinging. Cold light from a small high
> window. Slow push toward the telephone. Ambient audio: wind through the
> passage, the cord tapping the wall. [style block]

**8 — "So everyone who could have done it is still inside this house. And so are you."**

> A grand entrance hall in a dark country house, the front door shut and bolted
> against a snowstorm, snow visible through the glass. Coats and hats still on
> the stand. Slow push toward the bolted door, then hold. Ambient audio: wind
> outside, absolute stillness inside. [style block]

## Handing it back

Two ways in, and the code supports both.

**One file (simplest).** Cut the eight together, keep the ambient audio, leave a
clean track for the narrator. Drop it at
`apps/web/public/video/deco-1920s/prologue.mp4` and set `prologue.videoAsset` in
the case pack. The app plays the video full-screen, runs the existing narration
and captions over it, and falls straight back to the painted stills if the file
is missing or refuses to play.

**Eight files.** Name them `prologue-1.mp4` … `prologue-8.mp4` and give each beat
its own `videoAsset`. Each beat then holds until its narration ends, exactly as
the stills do now, so the cut stays in sync with the voice even if a clip runs
short.

Encode H.264 in MP4, 1080p, and keep the whole thing under about 40 MB — it is
served from the same free Render instance as the game, over venue wifi.
