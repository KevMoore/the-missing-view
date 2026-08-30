/**
 * The front door, shown at a bare `/`.
 *
 * A player who scans the QR code arrives at `/?code=ABC123` and never sees
 * this — they get the join form alone, because the room is already waiting on
 * them. Everyone else arrives cold, so this page has to answer three
 * questions before it asks for anything: what is this, how do I play it, and
 * which of the two doors is mine.
 *
 * The join form is the caller's, not a copy: a player who types the address
 * instead of scanning must not lose a step.
 */
import type { ReactNode } from 'react';

export function Landing({ join }: { join: ReactNode }) {
  return (
    <div className="landing">
      <header className="landing-hero">
        <div className="landing-hero-art" />
        <div className="landing-hero-text">
          <h1 className="title landing-title">The Missing View</h1>
          <p className="landing-tagline">One mystery. Different perspectives.</p>
          <p className="landing-premise">
            A murder mystery for a room of people who work together. Everyone is dealt a character
            and a private hand of clues, and nobody holds enough to solve it alone. What your team
            finds out about itself is the point; the murder is the excuse.
          </p>
        </div>
      </header>

      <div className="doors">
        <section className="deco-frame">
          <div className="deco-rule">Join a game</div>
          <p className="muted small mb">
            Someone in the room is running it. Take the code from the big screen.
          </p>
          {join}
        </section>

        <section className="deco-frame">
          <div className="deco-rule">Run a game</div>
          <p className="muted small mb">
            You host: you open the house, you drive the acts, and you do not play.
          </p>
          <a className="btn-link" href="/console">
            Open the facilitator console
          </a>
          <p className="muted small mt">
            Death at Blackwood Hall — 4 to 8 players, three acts, about an hour.
          </p>
        </section>
      </div>

      <section className="deco-frame landing-how">
        <div className="deco-rule">How it works</div>

        <h2 className="how-head">What you need</h2>
        <ul className="how-list">
          <li>One big screen in the room — a TV, a projector, or a laptop on the table.</li>
          <li>One phone per player.</li>
          <li>Four to eight players, plus one person to run it.</li>
          <li>About an hour.</li>
        </ul>

        <h2 className="how-head">The run of play</h2>
        <ol className="how-list">
          <li>The host opens the console and presses “Open the house”.</li>
          <li>
            The host opens the big screen. The art, the music, the evidence board and the reveal all
            live there.
          </li>
          <li>Every player scans the QR code on that screen.</li>
          <li>
            The host starts Act 1, then closes each act when the room is ready. Three acts, then the
            team makes one accusation together.
          </li>
        </ol>

        <h2 className="how-head">What a player does</h2>
        <p className="how-body">
          You are dealt a character and a few private clues. Only you hold them, and the team cannot
          use what it cannot see. So you choose: table a clue and make it public, whisper it to one
          person, question a suspect out loud, or post a theory and let the room challenge it. Every
          act closes with a commitment — you have to say what you believe before you know.
        </p>

        <h2 className="how-head">Then the reveal</h2>
        <p className="how-body">
          The screen names the culprit. Then it tells the room how it worked: who opened the case up
          for everyone else, whose clue turned it, and which views the team never heard. That last
          part is the game. Nobody is ranked and nobody is exposed.
        </p>
      </section>

      <p className="muted small center landing-foot">
        Built for teams that want to find out how they think together.
      </p>
    </div>
  );
}
