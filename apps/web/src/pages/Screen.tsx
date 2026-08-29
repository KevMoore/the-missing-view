/** The big screen: join code, evidence board, suspect stage, timer, reveal. */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { remaining, useGameSocket, type ScreenView, type ServerMessage } from '../ws.js';

export function Screen() {
  const [view, setView] = useState<ScreenView | null>(null);
  const [joined, setJoined] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [now, setNow] = useState(Date.now());

  const { send, connected } = useGameSocket((msg: ServerMessage) => {
    if (msg.type === 'screen-view') setView(msg);
  });

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(t);
    };
  }, []);

  if (!joined) {
    return (
      <div className="stage" style={{ maxWidth: 560 }}>
        <h1 className="title" style={{ fontSize: '2.4rem', marginBottom: '2rem' }}>
          The Missing View
        </h1>
        <div className="deco-frame">
          <div className="deco-rule">Big screen</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send({ type: 'join', role: 'screen', roomCode: codeInput.trim().toUpperCase() });
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
    );
  }

  if (!view) return <div className="stage center muted">Waiting for the house lights…</div>;

  if (view.phase === 'lobby') return <Lobby view={view} />;
  if (view.phase === 'reveal' && view.reveal) return <Reveal view={view} />;

  return (
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
          {view.questions.slice(-5).map((q) => (
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
        </section>

        <section>
          <div className="deco-rule">The evidence board</div>
          {view.board.length === 0 && (
            <p className="muted small">Nothing tabled yet. What are you all holding?</p>
          )}
          {view.board.map((c) => (
            <div className="card fade-up" key={c.clueId}>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <div className="byline">tabled by {c.byName}</div>
            </div>
          ))}
          {view.theories.length > 0 && <div className="deco-rule">Theories</div>}
          {view.theories.map((t) => (
            <div className="card" key={t.id}>
              <p>
                “{t.text}” <span className="byline">— {t.byName}</span>
              </p>
              <div className="byline">
                backed by {t.backers.length} · challenged by {t.challengers.length}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
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
