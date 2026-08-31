/**
 * The card that stands between one act and the next.
 *
 * An act change used to happen silently: the board simply carried on with a
 * different number in the corner. This gives the room a beat to look up, hear
 * where the story has moved to, and be told where it currently stands — which
 * is the part nobody can hold in their head after twenty minutes of argument.
 *
 * On the length. Ten seconds is a good pause and a poor read: the openings run
 * to about forty-five words, which is eighteen seconds spoken, and the recap
 * wants a few more on top. So the card holds for as long as the narration takes
 * and falls back to twenty seconds when there is none — the same rule the
 * prologue uses, for the same reason. The countdown is shown regardless,
 * because a room that can see the game restarting settles before it does.
 */
import { useEffect, useRef, useState } from 'react';
import { setDucked } from '../music.js';
import { speak, stopSpeaking } from '../speaker.js';
import type { ScreenView } from '../ws.js';

/** Long enough to read the opening if it is never spoken aloud. */
const SILENT_HOLD_MS = 20_000;

const NUMERAL = ['', 'One', 'Two', 'Three'];

export function ActBreak({ view, onDone }: { view: ScreenView; onDone: () => void }) {
  const [left, setLeft] = useState(SILENT_HOLD_MS);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    setDucked('act-break', true);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done.current();
    };

    // The voice decides the length; the timer is the floor, not the clock.
    const started = Date.now();
    const floor = window.setTimeout(finish, SILENT_HOLD_MS);
    if (view.actOpeningUrl !== undefined) {
      void speak(view.actOpeningUrl).then(() => {
        // A refused or missing recording resolves at once; hold the floor then.
        if (Date.now() - started > 1000) {
          window.clearTimeout(floor);
          window.setTimeout(finish, 1200);
        }
      });
    }

    const tick = window.setInterval(() => {
      setLeft(Math.max(0, SILENT_HOLD_MS - (Date.now() - started)));
    }, 200);

    return () => {
      window.clearTimeout(floor);
      window.clearInterval(tick);
      window.clearInterval(tick);
      stopSpeaking();
      setDucked('act-break', false);
    };
  }, [view.actOpeningUrl, view.act]);

  const houses = view.houses ?? [];
  const strongest = (theories: typeof view.theories) =>
    [...theories].sort((a, b) => b.backers.length - a.backers.length || b.at - a.at)[0];

  return (
    <div className="act-break">
      <div className="act-break-inner">
        <div className="deco-rule">Act {NUMERAL[view.act]}</div>
        <h1 className="title act-break-title">{view.actTitle}</h1>
        {view.actOpening !== undefined && <p className="act-break-opening">{view.actOpening}</p>}

        {/* One recap per house. With two of them, a single "your strongest
            theory" would be one team's, read out to both — and the other team
            would be told the state of a game it is not playing. */}
        <div className={houses.length > 1 ? 'act-break-state split-state' : 'act-break-state'}>
          {houses.map((house) => {
            const leadingTheory = strongest(house.theories);
            return (
              <div key={house.id}>
                {houses.length > 1 && <p className="act-break-house">{house.name}</p>}
                {view.lastDecision && (
                  <p>
                    <span className="muted">You decided: </span>
                    {view.lastDecision.choice}
                    <span className="muted small">
                      {' '}
                      — {view.lastDecision.votes} of {view.lastDecision.of}
                    </span>
                  </p>
                )}
                {leadingTheory && (
                  <p>
                    <span className="muted">Your strongest theory: </span>“{leadingTheory.text}”
                    <span className="muted small">
                      {' '}
                      — backed by {leadingTheory.backers.length}, challenged by{' '}
                      {leadingTheory.challengers.length}
                    </span>
                  </p>
                )}
                <p className="muted">
                  {house.board.length} {house.board.length === 1 ? 'clue is' : 'clues are'} on the
                  board.
                </p>
              </div>
            );
          })}
          {view.questions.length > 0 && (
            <p className="muted">
              {view.questions.length}{' '}
              {view.questions.length === 1 ? 'question has' : 'questions have'} been put to the
              suspects.
            </p>
          )}
        </div>

        <div className="act-break-count" aria-hidden>
          {Math.ceil(left / 1000)}
        </div>
      </div>
    </div>
  );
}
