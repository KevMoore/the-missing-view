/** The big screen: join code, evidence board, suspect stage, timer, reveal. */
import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { remaining, useGameSocket, type ScreenView, type ServerMessage } from '../ws.js';
import { useMusic, type MusicCue } from '../music.js';
import { useSuspectVoices } from '../voice.js';
import { armSpeechUnlock, unlockSpeech } from '../speaker.js';
import { useArrivals } from '../arrivals.js';
import { Backdrop } from './Backdrop.js';
import { Prologue } from './Prologue.js';
import { ActBreak } from './ActBreak.js';

/**
 * The big screen has no scrollbar and nobody in the room can reach it, so
 * anything below the fold is simply gone. Show the newest first and cap the
 * list at what fits: the screen's job is to make the room notice what just
 * happened, not to hold the whole record.
 */
function latest<T>(items: readonly T[], count: number): T[] {
  return items.slice(-count).reverse();
}

/**
 * A television has no scrollbar and nobody in the room can reach it, so a card
 * cut off halfway is simply broken. An iPad in landscape has a couple of
 * hundred pixels less than a 1080p screen, and this is where they come from.
 */
function useShortScreen(): boolean {
  const [short, setShort] = useState(() => window.innerHeight < 900);
  useEffect(() => {
    const onResize = () => {
      setShort(window.innerHeight < 900);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return short;
}

/**
 * The face of whoever did this, beside what they did.
 *
 * The player portraits were painted for the game and only the phone that held
 * one ever saw it — the room watched a list of first names. Putting the face
 * against the act is the cheapest way to make a contribution feel like it came
 * from a person rather than from a row in a log.
 *
 * Falls back to the name alone, since a case need not ship portraits at all.
 */
function Who({
  player,
  prefix,
  trailing = false,
}: {
  player: ScreenPlayer | undefined;
  prefix?: string | undefined;
  /**
   * Face after the name rather than before it.
   *
   * In a right-aligned row the name ends flush and the face floats wherever the
   * name happens to start, so a column of them staggers and the eye catches on
   * every line. Putting the face last lines them all up against the edge.
   * Reading order in a sentence — "Ana asks Reeves" — still wants it first.
   */
  trailing?: boolean;
}) {
  if (!player) return null;
  const face = player.portraitAsset !== undefined && (
    <img src={player.portraitAsset} alt="" aria-hidden className="who-face" />
  );
  return (
    <span className="who-chip">
      {!trailing && face}
      <span>
        {prefix}
        {player.name}
      </span>
      {trailing && face}
    </span>
  );
}

type ScreenPlayer = ScreenView['players'][number];

/** Says out loud what the cap is hiding, so the board never looks smaller than it is. */
function Earlier({
  total,
  shown,
  noun,
  plural,
}: {
  total: number;
  shown: number;
  noun: string;
  plural?: string;
}) {
  const hidden = total - shown;
  if (hidden <= 0) return null;
  return (
    <p className="muted small earlier">
      + {hidden} earlier {hidden === 1 ? noun : (plural ?? `${noun}s`)}
    </p>
  );
}

export function Screen() {
  const [view, setView] = useState<ScreenView | null>(null);
  const [joined, setJoined] = useState(() => Boolean(sessionStorage.getItem('tmv-screen-room')));
  const [codeInput, setCodeInput] = useState(
    () => new URLSearchParams(location.search).get('code')?.toUpperCase() ?? '',
  );
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(() => sessionStorage.getItem('tmv-muted') === '1');
  const short = useShortScreen();
  const cast = useMemo(() => new Map((view?.players ?? []).map((p) => [p.id, p])), [view?.players]);
  // One full card, always: with a painting on it, two will not fit anywhere.
  const caps = short
    ? { questions: 2, theories: 3, boardFull: 1, boardSlim: 3 }
    : { questions: 3, theories: 5, boardFull: 1, boardSlim: 7 };

  // The menu theme carries the lobby; play drops it under the room's talking.
  const cue: MusicCue = !joined
    ? null
    : view?.prologue
      ? 'prologue'
      : (view?.phase ?? 'lobby') === 'lobby'
        ? 'menu'
        : 'game';
  useMusic(cue, muted, view?.music);

  // Whole exchanges, in the order they were asked. The recordings for one
  // question arrive at different times, so what is handed over is the shape of
  // the interrogation rather than a list of files.
  const exchanges = useMemo(
    () =>
      (view?.questions ?? []).map((q) => ({
        id: q.id,
        suspectId: q.suspectId,
        askUrl: q.askUrl,
        voiceUrl: q.voiceUrl,
      })),
    [view?.questions],
  );
  const answering = useSuspectVoices(exchanges, joined, muted);

  // A new act gets a beat before the board comes back. Detected here rather
  // than announced by the server: the act number changing is the whole signal.
  const [breakFor, setBreakFor] = useState<number | null>(null);
  const lastAct = useRef<number | null>(null);
  useEffect(() => {
    if (view?.phase !== 'act') return;
    const previous = lastAct.current;
    lastAct.current = view.act;
    // Not on a screen that has only just joined — it would open on a card for
    // an act that started twenty minutes ago.
    if (previous !== null && previous !== view.act) setBreakFor(view.act);
  }, [view?.act, view?.phase]);

  const boardSignatures = useMemo(
    () => Object.fromEntries((view?.board ?? []).map((c) => [c.clueId, c.clueId])),
    [view?.board],
  );
  const theorySignatures = useMemo(
    () =>
      Object.fromEntries(
        (view?.theories ?? []).map((t) => [
          t.id,
          `${String(t.backers.length)}/${String(t.challengers.length)}`,
        ]),
      ),
    [view?.theories],
  );
  const board = useArrivals(boardSignatures, view !== null);
  const theories = useArrivals(theorySignatures, view !== null);

  const { send, connected } = useGameSocket(
    (msg: ServerMessage) => {
      if (msg.type === 'screen-view') setView(msg);
      else if (msg.type === 'error' && msg.message === 'no such room') {
        sessionStorage.removeItem('tmv-screen-room');
        setJoined(false);
        setView(null);
      }
    },
    () => {
      const roomCode = sessionStorage.getItem('tmv-screen-room');
      return roomCode ? { type: 'join', role: 'screen', roomCode } : null;
    },
  );

  // A screen that reloaded mid-game resumed straight past the join click, so
  // there was no gesture to unlock audio with. Take the next one instead.
  useEffect(() => armSpeechUnlock(), []);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(t);
    };
  }, []);

  const chrome = (
    <>
      <Backdrop src={view?.sceneAsset} />
      {joined && (
        <button
          className="mute"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            sessionStorage.setItem('tmv-muted', next ? '1' : '0');
          }}
          aria-label={muted ? 'Unmute music' : 'Mute music'}
          title={muted ? 'Unmute music' : 'Mute music'}
        >
          {muted ? '\u266a\u0338' : '\u266a'}
        </button>
      )}
    </>
  );

  if (!joined) {
    return (
      <>
        {chrome}
        <div className="stage" style={{ maxWidth: 560 }}>
          <h1 className="title" style={{ fontSize: '2.4rem', marginBottom: '2rem' }}>
            The Missing View
          </h1>
          <div className="deco-frame">
            <div className="deco-rule">Big screen</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Synchronous, inside the gesture: iOS grants audio permission
                // to the element it sees touched, not to the page. Everything
                // spoken for the rest of the night reuses what this unlocks.
                unlockSpeech();
                const roomCode = codeInput.trim().toUpperCase();
                sessionStorage.setItem('tmv-screen-room', roomCode);
                send({ type: 'join', role: 'screen', roomCode });
                setJoined(true);
              }}
            >
              <input
                placeholder="ROOM CODE"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                }}
                aria-label="Room code"
              />
              {/*
                Prefilled, never auto-submitted. This click is the only user
                gesture the screen ever gets, and on iOS it is what buys
                permission to make a sound for the rest of the night. A screen
                that joined itself would be a silent one.
              */}
              <button
                className="mt"
                style={{ width: '100%' }}
                disabled={!connected || codeInput.trim().length < 4}
              >
                Take the stage
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  if (view?.phase === 'act' && breakFor === view.act) {
    return (
      <>
        {chrome}
        <ActBreak
          view={view}
          onDone={() => {
            setBreakFor(null);
          }}
        />
      </>
    );
  }

  // The opening owns the whole screen, so decide before building a board we
  // would only throw away.
  if (view?.prologue) {
    return (
      <Prologue
        beats={view.prologue.beats}
        videoAsset={view.prologue.videoAsset}
        onEnd={() => {
          send({ type: 'prologue', playing: false });
        }}
      />
    );
  }

  const body = !view ? (
    <div className="stage center muted">Waiting for the house lights…</div>
  ) : view.phase === 'lobby' ? (
    <Lobby view={view} />
  ) : view.phase === 'reveal' && view.reveal ? (
    <Reveal view={view} />
  ) : (
    <div className="stage">
      <header className="row mb">
        <div className="grow">
          <h1 className="title" style={{ textAlign: 'left', fontSize: '1.6rem' }}>
            {view.caseTitle}
          </h1>
          <div className="muted small">
            Act {view.act} — {actTitle(view.act)}
          </div>
        </div>
        <div className={`timer ${isLate(view, now) ? 'late' : ''}`}>
          {remaining(view.actStartedAt, view.actMinutes, now)}
        </div>
      </header>

      {view.phase === 'commitment' && view.commitmentPrompt && (
        <div className="deco-frame mb fade-up">
          <div className="deco-rule">The house must decide</div>
          <h2 className="center" style={{ fontSize: '1.8rem' }}>
            {view.commitmentPrompt}
          </h2>
          <p className="center muted mt">Cast your vote on your phone.</p>
        </div>
      )}

      {view.accusation && (
        <div className="deco-frame mb fade-up">
          <div className="deco-rule">The accusation</div>
          <h2 className="center" style={{ fontSize: '1.8rem' }}>
            The house accuses {view.accusation.culpritName}
          </h2>
          <p className="center muted mt">“{view.accusation.motive}”</p>
        </div>
      )}

      <div className="act-columns">
        <section>
          <div className="deco-rule">The suspects</div>
          <div className="suspect-grid mb">
            {view.suspects.map((s) => (
              <div className={`suspect${answering === s.id ? ' speaking' : ''}`} key={s.id}>
                {s.portraitAsset ? (
                  <img src={s.portraitAsset} alt={s.name} />
                ) : (
                  <div className="portrait-fallback">
                    {s.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')}
                  </div>
                )}
                <div className="name">{s.name}</div>
                <div className="bio">{s.publicBio}</div>
              </div>
            ))}
          </div>
          {view.nudge !== undefined && <p className="nudge fade-up">{view.nudge}</p>}
          <div className="deco-rule">Interrogation</div>
          {view.questions.length === 0 && (
            <p className="muted small">Ask a suspect a question from your phone.</p>
          )}
          {latest(view.questions, caps.questions).map((q) => (
            <div className="qa fade-up" key={q.id}>
              <div className="q">
                <Who player={cast.get(q.by)} /> asks {q.suspectName}: “{q.text}”
              </div>
              {q.answer ? (
                <div className="a">“{q.answer}”</div>
              ) : (
                <div className="muted small">…</div>
              )}
            </div>
          ))}
          <Earlier total={view.questions.length} shown={caps.questions} noun="question" />
        </section>

        <section>
          <div className="deco-rule">Theories</div>
          {view.theories.length === 0 && (
            <p className="muted small">No theory yet. What do you think happened?</p>
          )}
          {view.theories.length > 0 && (
            <>
              {latest(view.theories, caps.theories).map((t) => (
                <div
                  className={`card fade-up${theories.arrived.has(t.id) ? ' just-in' : ''}${
                    theories.changed.has(t.id) && !theories.arrived.has(t.id) ? ' just-moved' : ''
                  }`}
                  key={t.id}
                >
                  <p>“{t.text}”</p>
                  <div className="byline">
                    <Who player={cast.get(t.by)} prefix="— " trailing />
                  </div>
                  <div className="byline">
                    backed by {t.backers.length} · challenged by {t.challengers.length}
                  </div>
                </div>
              ))}
              <Earlier
                total={view.theories.length}
                shown={caps.theories}
                noun="theory"
                plural="theories"
              />
            </>
          )}
        </section>

        <section>
          <div className="deco-rule">The evidence board</div>
          {view.board.length === 0 && (
            <p className="muted small">Nothing tabled yet. What are you all holding?</p>
          )}
          {/* The two newest read in full; the rest stay on the board as titles, so the
              team's shared record is never lost to make room for the newest thing. */}
          <div className="board-list">
            {latest(view.board, caps.boardFull).map((c) => (
              <div
                className={`card evidence fade-up${board.arrived.has(c.clueId) ? ' just-in' : ''}`}
                key={c.clueId}
              >
                {c.imageAsset !== undefined && (
                  <img className="evidence-plate" src={c.imageAsset} alt="" aria-hidden />
                )}
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                <div className="byline">
                  <Who player={cast.get(c.by)} prefix="tabled by " trailing />
                </div>
              </div>
            ))}
            {latest(view.board.slice(0, -caps.boardFull), caps.boardSlim).map((c) => (
              <div
                className={`card-slim${board.arrived.has(c.clueId) ? ' just-in' : ''}`}
                key={c.clueId}
              >
                <span className="grow">{c.title}</span>
                <span className="byline">
                  <Who player={cast.get(c.by)} trailing />
                </span>
              </div>
            ))}
            <Earlier
              total={view.board.length}
              shown={caps.boardFull + caps.boardSlim}
              noun="clue"
            />
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <>
      {chrome}
      {body}
    </>
  );
}

function Lobby({ view }: { view: ScreenView }) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    void QRCode.toDataURL(`${location.origin}/?code=${view.roomCode}`, {
      color: { dark: '#0d0b09', light: '#efe6d3' },
      width: 240,
    }).then(setQr);
  }, [view.roomCode]);

  return (
    <div className="stage center">
      <h1 className="title" style={{ fontSize: '3rem' }}>
        The Missing View
      </h1>
      <div className="deco-rule" style={{ maxWidth: 500, margin: '1rem auto' }}>
        {view.caseTitle}
      </div>
      {view.victim?.portraitAsset && (
        <figure className="victim">
          <img src={view.victim.portraitAsset} alt={view.victim.name} />
          <figcaption>
            {view.victim.name}
            <span>1865 &ndash; 1926</span>
          </figcaption>
        </figure>
      )}
      <p className="muted" style={{ maxWidth: 640, margin: '0 auto 2rem', lineHeight: 1.7 }}>
        {view.synopsis}
      </p>
      <div className="deco-frame" style={{ display: 'inline-block', padding: '2rem 3rem' }}>
        <p className="muted small">
          Join on your phone at <strong>{location.host}</strong>
        </p>
        <div className="big-code">{view.roomCode}</div>
        {qr && <img src={qr} alt={`Join code ${view.roomCode}`} className="mt" />}
      </div>
      <div className="mt">
        <div className="deco-rule" style={{ maxWidth: 400, margin: '1.5rem auto' }}>
          In the drawing room
        </div>
        <p style={{ fontFamily: 'var(--serif)', fontSize: '1.3rem' }}>
          {view.players.length
            ? view.players.map((p) => p.name).join(' · ')
            : 'Awaiting the first guest…'}
        </p>
      </div>
    </div>
  );
}

function Reveal({ view }: { view: ScreenView }) {
  const reveal = view.reveal;
  if (!reveal) return null;
  return (
    <div className="stage" style={{ maxWidth: 900 }}>
      <h1 className="title" style={{ fontSize: '2.2rem' }}>
        {reveal.solved ? 'The house was right.' : 'The house was wrong.'}
      </h1>
      <div className="deco-frame mt mb fade-up">
        <div className="deco-rule">What really happened</div>
        <p style={{ fontFamily: 'var(--serif)', fontSize: '1.15rem', lineHeight: 1.8 }}>
          {reveal.narrative}
        </p>
      </div>
      <div className="deco-frame fade-up">
        <div className="deco-rule">But here is the interesting part</div>
        <p className="muted mb">
          You didn’t {reveal.solved ? 'solve it' : 'get this far'} because you all thought the same
          way. You {reveal.solved ? 'solved it' : 'got here'} because you didn’t.
        </p>
        {reveal.strengths.map((s) => (
          <p className="strength-line" key={s.playerId}>
            <span className="who">
              {s.name} — {s.strength}.
            </span>{' '}
            {s.line}
          </p>
        ))}
        <p className="muted small mt">Your fuller private read is on your phone.</p>
      </div>
      {reveal.moments.length > 0 && (
        <div className="deco-frame mt fade-up">
          <div className="deco-rule">The moments you reached</div>
          <p className="muted small mb">
            This case was built around eight of these. You got to {reveal.moments.length}.
          </p>
          <div className="moment-grid">
            {reveal.moments.map((m) => (
              <div className={`moment${m.landed ? ' landed' : ''}`} key={m.moment}>
                <div className="moment-label">{m.label}</div>
                <div className="byline">
                  {m.byName}, with “{m.clueTitle}”
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function actTitle(act: 1 | 2 | 3): string {
  return ['The Longest Night', 'What the House Heard', 'The Missing View'][act - 1] ?? '';
}

function isLate(view: ScreenView, now: number): boolean {
  return Boolean(view.actStartedAt && now > view.actStartedAt + view.actMinutes * 60_000);
}
