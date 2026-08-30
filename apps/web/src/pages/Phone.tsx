/** The player's phone: dossier, table/whisper, interrogate, vote, private reveal. */
import { useState } from 'react';
import { useGameSocket, type ClientMessage, type PhoneView, type ServerMessage } from '../ws.js';

/** The stored seat: enough to re-join on any (re)connect. */
function storedJoin(): ClientMessage | null {
  const saved = localStorage.getItem('tmv-player');
  const name = localStorage.getItem('tmv-name');
  if (!saved || !name) return null;
  const { playerId, roomCode } = JSON.parse(saved) as { playerId: string; roomCode: string };
  return { type: 'join', role: 'phone', roomCode, name, playerId };
}

type Tab = 'dossier' | 'suspects' | 'theories' | 'decide';

export function Phone() {
  const [view, setView] = useState<PhoneView | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('dossier');
  const { send, connected } = useGameSocket(
    (msg: ServerMessage) => {
      if (msg.type === 'phone-view') setView(msg);
      else if (msg.type === 'joined') {
        localStorage.setItem(
          'tmv-player',
          JSON.stringify({ playerId: msg.playerId, roomCode: msg.roomCode }),
        );
      } else if (msg.type === 'error') {
        if (msg.message === 'no such room') {
          // The room is gone (server restart): clear the stale seat.
          localStorage.removeItem('tmv-player');
          setView(null);
        }
        setError(msg.message);
        setTimeout(() => {
          setError('');
        }, 3500);
      }
    },
    storedJoin, // re-establishes the seat on every (re)connect
  );

  if (!view) {
    return (
      <JoinForm
        connected={connected}
        onJoin={(code, name) => {
          localStorage.setItem('tmv-name', name);
          send({ type: 'join', role: 'phone', roomCode: code, name });
        }}
        error={error}
      />
    );
  }

  if (view.phase === 'lobby') {
    return (
      <div className="phone-stage center" style={{ paddingTop: '4rem' }}>
        <h1 className="title" style={{ fontSize: '1.6rem' }}>
          You’re in.
        </h1>
        <div className="deco-rule">Room {view.roomCode}</div>
        <p className="muted mt">Watch the big screen. The house will assemble shortly.</p>
      </div>
    );
  }

  if (view.phase === 'reveal' && view.privateReveal) return <PrivateRead view={view} send={send} />;

  return (
    <div className="phone-stage">
      <div className="tabs">
        {(['dossier', 'suspects', 'theories', 'decide'] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            onClick={() => {
              setTab(t);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'dossier' && <Dossier view={view} send={send} />}
      {tab === 'suspects' && <Suspects view={view} send={send} />}
      {tab === 'theories' && <Theories view={view} send={send} />}
      {tab === 'decide' && <Decide view={view} send={send} />}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}

type Send = ReturnType<typeof useGameSocket>['send'];

function JoinForm({
  connected,
  onJoin,
  error,
}: {
  connected: boolean;
  onJoin: (code: string, name: string) => void;
  error: string;
}) {
  const params = new URLSearchParams(location.search);
  const [code, setCode] = useState(params.get('code') ?? '');
  const [name, setName] = useState('');
  return (
    <div className="phone-stage" style={{ paddingTop: '3rem' }}>
      <h1 className="title" style={{ fontSize: '1.8rem', marginBottom: '1.5rem' }}>
        The Missing View
      </h1>
      <div className="deco-frame">
        <div className="deco-rule">Join the house party</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onJoin(code.trim().toUpperCase(), name.trim());
          }}
        >
          <input
            placeholder="ROOM CODE"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
            aria-label="Room code"
          />
          <input
            className="mt"
            placeholder="Your first name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            aria-label="Your first name"
          />
          <button
            className="mt"
            style={{ width: '100%' }}
            disabled={!connected || code.trim().length < 4 || !name.trim()}
          >
            Step inside
          </button>
        </form>
      </div>
      {error && <div className="toast">{error}</div>}
    </div>
  );
}

function Dossier({ view, send }: { view: PhoneView; send: Send }) {
  const [whisperClue, setWhisperClue] = useState<string | null>(null);
  return (
    <div>
      <div className="deco-frame mb">
        <div className="deco-rule">{view.character.name}</div>
        <div className="dossier-head">
          {view.character.portraitAsset && (
            <img
              className="dossier-portrait"
              src={view.character.portraitAsset}
              alt={view.character.name}
            />
          )}
          <p className="muted small">{view.character.role}</p>
        </div>
        <p className="mt small" style={{ lineHeight: 1.6 }}>
          {view.character.briefing}
        </p>
      </div>
      <div className="deco-rule">Your private clues</div>
      <p className="muted small mb">Only you hold these. The team can’t use what it can’t see.</p>
      {view.hand.map((clue) => (
        <div className={`card ${clue.tabled ? 'tabled' : ''}`} key={clue.id}>
          <h3>{clue.title}</h3>
          <p>{clue.text}</p>
          {clue.tabled ? (
            <div className="byline">on the board</div>
          ) : (
            <div className="row mt">
              <button
                onClick={() => {
                  send({
                    type: 'move',
                    move: { type: 'table', playerId: view.playerId, clueId: clue.id },
                  });
                }}
              >
                Table it
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setWhisperClue(whisperClue === clue.id ? null : clue.id);
                }}
              >
                Whisper
              </button>
            </div>
          )}
          {whisperClue === clue.id && (
            <div className="mt">
              {view.players.map((p) => (
                <button
                  key={p.id}
                  className="ghost"
                  style={{ marginRight: 6, marginBottom: 6 }}
                  onClick={() => {
                    send({
                      type: 'move',
                      move: {
                        type: 'whisper',
                        playerId: view.playerId,
                        toPlayerId: p.id,
                        clueId: clue.id,
                      },
                    });
                    setWhisperClue(null);
                  }}
                >
                  to {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Suspects({ view, send }: { view: PhoneView; send: Send }) {
  const [target, setTarget] = useState(view.suspects[0]?.id ?? '');
  const [question, setQuestion] = useState('');
  return (
    <div>
      <div className="deco-rule">Question a suspect</div>
      <p className="muted small mb">
        Your question — and their answer — plays out on the big screen.
      </p>
      <select
        value={target}
        onChange={(e) => {
          setTarget(e.target.value);
        }}
        aria-label="Choose a suspect"
      >
        {view.suspects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <textarea
        className="mt"
        rows={3}
        placeholder="Ask them anything…"
        value={question}
        onChange={(e) => {
          setQuestion(e.target.value);
        }}
        aria-label="Your question"
      />
      <button
        className="mt"
        style={{ width: '100%' }}
        disabled={!question.trim()}
        onClick={() => {
          send({
            type: 'move',
            move: {
              type: 'ask-suspect',
              playerId: view.playerId,
              questionId: `q-${String(Date.now())}-${view.playerId}`,
              suspectId: target,
              text: question.trim(),
            },
          });
          setQuestion('');
        }}
      >
        Put it to them
      </button>
      <div className="mt">
        {view.suspects.map((s) => (
          <div className="card" key={s.id}>
            <h3>{s.name}</h3>
            <p className="small muted">{s.publicBio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Theories({ view, send }: { view: PhoneView; send: Send }) {
  const [text, setText] = useState('');
  return (
    <div>
      <div className="deco-rule">Theories of the crime</div>
      {view.theories.map((t) => {
        const mine = t.backers.includes(view.playerId)
          ? 'backing'
          : t.challengers.includes(view.playerId)
            ? 'challenging'
            : null;
        return (
          <div className="card" key={t.id}>
            <p>
              “{t.text}” <span className="byline">— {t.byName}</span>
            </p>
            <div className="byline">
              {t.backers.length} backing · {t.challengers.length} challenging
              {mine ? ` · you are ${mine}` : ''}
            </div>
            <div className="row mt">
              <button
                className="ghost"
                onClick={() => {
                  send({
                    type: 'move',
                    move: { type: 'back-theory', playerId: view.playerId, theoryId: t.id },
                  });
                }}
              >
                Back it
              </button>
              <button
                className="danger"
                onClick={() => {
                  send({
                    type: 'move',
                    move: { type: 'challenge-theory', playerId: view.playerId, theoryId: t.id },
                  });
                }}
              >
                Challenge
              </button>
            </div>
          </div>
        );
      })}
      <textarea
        className="mt"
        rows={2}
        placeholder="Propose a theory…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        aria-label="Propose a theory"
      />
      <button
        className="mt"
        style={{ width: '100%' }}
        disabled={!text.trim()}
        onClick={() => {
          send({
            type: 'move',
            move: {
              type: 'propose-theory',
              playerId: view.playerId,
              theoryId: `t-${String(Date.now())}-${view.playerId}`,
              text: text.trim(),
            },
          });
          setText('');
        }}
      >
        Table the theory
      </button>
    </div>
  );
}

function Decide({ view, send }: { view: PhoneView; send: Send }) {
  const [culprit, setCulprit] = useState(view.suspects[0]?.id ?? '');
  const [motive, setMotive] = useState('');
  if (view.commitment) {
    return (
      <div>
        <div className="deco-frame">
          <div className="deco-rule">The house must decide</div>
          <h2 style={{ fontSize: '1.2rem' }}>{view.commitment.prompt}</h2>
          <div className="mt">
            {view.commitment.options.map((o) => (
              <button
                key={o.id}
                className={view.commitment?.myChoice === o.id ? '' : 'ghost'}
                style={{ display: 'block', width: '100%', marginBottom: 8 }}
                onClick={() => {
                  const commitment = view.commitment;
                  if (!commitment) return;
                  send({
                    type: 'move',
                    move: {
                      type: 'commit-vote',
                      playerId: view.playerId,
                      commitmentId: commitment.id,
                      choice: o.id,
                    },
                  });
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="muted small">You can change your mind until the act closes.</p>
        </div>
      </div>
    );
  }
  if (view.canAccuse) {
    return (
      <div className="deco-frame">
        <div className="deco-rule">Name the killer</div>
        <p className="muted small mb">One answer for the whole house (agree it out loud first).</p>
        <select
          value={culprit}
          onChange={(e) => {
            setCulprit(e.target.value);
          }}
          aria-label="The killer"
        >
          {view.suspects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <textarea
          className="mt"
          rows={2}
          placeholder="The motive, in a sentence…"
          value={motive}
          onChange={(e) => {
            setMotive(e.target.value);
          }}
          aria-label="The motive"
        />
        <button
          className="danger mt"
          style={{ width: '100%' }}
          disabled={!motive.trim()}
          onClick={() => {
            send({
              type: 'move',
              move: {
                type: 'accuse',
                playerId: view.playerId,
                culpritId: culprit,
                motive: motive.trim(),
              },
            });
          }}
        >
          Make the accusation
        </button>
      </div>
    );
  }
  return <p className="muted center mt">Nothing to decide yet. Keep investigating.</p>;
}

function PrivateRead({ view, send }: { view: PhoneView; send: Send }) {
  const reveal = view.privateReveal;
  if (!reveal) return null;
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div className="phone-stage">
      <div className="deco-frame mt fade-up">
        <div className="deco-rule">Your private read</div>
        <h2 className="title" style={{ fontSize: '1.5rem' }}>
          {reveal.headline}
        </h2>
        <div className="mt">
          {reveal.evidence.map((line) => (
            <p className="small" style={{ lineHeight: 1.7 }} key={line}>
              ◆ {line}
            </p>
          ))}
        </div>
        <div className="deco-rule mt">The quieter side</div>
        <p className="small" style={{ lineHeight: 1.7 }}>
          {reveal.quieterSide}
        </p>
      </div>
      <div className="deco-frame mt">
        <div className="deco-rule">Keep it</div>
        {sent ? (
          <p className="small muted">Done — it’s on its way.</p>
        ) : (
          <>
            <p className="small muted mb">Want your read emailed to you? Only if you ask.</p>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              aria-label="Email address"
            />
            <button
              className="mt"
              style={{ width: '100%' }}
              disabled={!email.includes('@')}
              onClick={() => {
                send({ type: 'email-optin', email: email.trim() });
                setSent(true);
              }}
            >
              Email me my read
            </button>
          </>
        )}
      </div>
    </div>
  );
}
