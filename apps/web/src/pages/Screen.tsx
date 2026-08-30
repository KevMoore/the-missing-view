/** The big screen: join code, evidence board, suspect stage, timer, reveal. */
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { remaining, useGameSocket, type ScreenView, type ServerMessage } from '../ws.js';
import { useMusic, type MusicCue } from '../music.js';
import { useSuspectVoices } from '../voice.js';
import { Backdrop } from './Backdrop.js';

/**
 * The big screen has no scrollbar and nobody in the room can reach it, so
 * anything below the fold is simply gone. Show the newest first and cap the
 * list at what fits: the screen's job is to make the room notice what just
 * happened, not to hold the whole record.
 */
function latest<T>(items: readonly T[], count: number): T[] {
  return items.slice(-count).reverse();
}

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
  const [codeInput, setCodeInput] = useState('');
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(() => sessionStorage.getItem('tmv-muted') === '1');

  // The menu theme carries the lobby; play drops it under the room's talking.
  const cue: MusicCue = !joined ? null : (view?.phase ?? 'lobby') === 'lobby' ? 'menu' : 'game';
  useMusic(cue, muted, view?.music);

  // The suspects speak here and nowhere else, for the same reason the score does.
  const voiceUrls = useMemo(
    () => (view?.questions ?? []).map((q) => q.voiceUrl).filter((u): u is string => Boolean(u)),
    [view?.questions],
  );
  useSuspectVoices(voiceUrls, joined, muted);

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

      <div className="grid-2">
        <section>
          <div className="deco-rule">The suspects</div>
          <div className="suspect-grid mb">
            {view.suspects.map((s) => (
              <div className="suspect" key={s.id}>
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
          <div className="deco-rule">Interrogation</div>
          {view.questions.length === 0 && (
            <p className="muted small">Ask a suspect a question from your phone.</p>
          )}
          {latest(view.questions, 3).map((q) => (
            <div className="qa fade-up" key={q.id}>
              <div className="q">
                {q.byName} asks {q.suspectName}: “{q.text}”
              </div>
              {q.answer ? (
                <div className="a">“{q.answer}”</div>
              ) : (
                <div className="muted small">…</div>
              )}
            </div>
          ))}
          <Earlier total={view.questions.length} shown={3} noun="question" />
        </section>

        <section>
          {view.theories.length > 0 && (
            <>
              <div className="deco-rule">Theories</div>
              {latest(view.theories, 3).map((t) => (
                <div className="card fade-up" key={t.id}>
                  <p>
                    “{t.text}” <span className="byline">— {t.byName}</span>
                  </p>
                  <div className="byline">
                    backed by {t.backers.length} · challenged by {t.challengers.length}
                  </div>
                </div>
              ))}
              <Earlier total={view.theories.length} shown={3} noun="theory" plural="theories" />
            </>
          )}
          <div className="deco-rule">The evidence board</div>
          {view.board.length === 0 && (
            <p className="muted small">Nothing tabled yet. What are you all holding?</p>
          )}
          {/* The two newest read in full; the rest stay on the board as titles, so the
              team's shared record is never lost to make room for the newest thing. */}
          <div className="board-list">
            {latest(view.board, 2).map((c) => (
              <div className="card fade-up" key={c.clueId}>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                <div className="byline">tabled by {c.byName}</div>
              </div>
            ))}
            {latest(view.board.slice(0, -2), 7).map((c) => (
              <div className="card-slim" key={c.clueId}>
                <span className="grow">{c.title}</span>
                <span className="byline">{c.byName}</span>
              </div>
            ))}
            <Earlier total={view.board.length} shown={9} noun="clue" />
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
    </div>
  );
}

function actTitle(act: 1 | 2 | 3): string {
  return ['The Longest Night', 'What the House Heard', 'The Missing View'][act - 1] ?? '';
}

function isLate(view: ScreenView, now: number): boolean {
  return Boolean(view.actStartedAt && now > view.actStartedAt + view.actMinutes * 60_000);
}
