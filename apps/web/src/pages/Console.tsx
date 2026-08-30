/** The facilitator console (D4): create, monitor, drive the acts, see team shape. */
import { useEffect, useState } from 'react';
import { remaining, useGameSocket, type ConsoleView, type ServerMessage } from '../ws.js';

export function Console() {
  const [view, setView] = useState<ConsoleView | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(() =>
    sessionStorage.getItem('tmv-console-room'),
  );
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const { send, connected } = useGameSocket(
    (msg: ServerMessage) => {
      if (msg.type === 'console-view') setView(msg);
      else if (msg.type === 'room-created') {
        sessionStorage.setItem('tmv-console-room', msg.roomCode);
        setRoomCode(msg.roomCode);
      } else if (msg.type === 'error') {
        if (msg.message === 'no such room') {
          // The room is gone (server restart): back to the start.
          sessionStorage.removeItem('tmv-console-room');
          setRoomCode(null);
          setView(null);
        }
        setError(msg.message);
        setTimeout(() => {
          setError('');
        }, 3500);
      }
    },
    () => {
      const stored = sessionStorage.getItem('tmv-console-room');
      return stored ? { type: 'join', role: 'console', roomCode: stored } : null;
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

  if (!roomCode) {
    return (
      <div className="stage" style={{ maxWidth: 560 }}>
        <h1 className="title" style={{ fontSize: '2rem', marginBottom: '2rem' }}>
          Facilitator
        </h1>
        <div className="deco-frame">
          <div className="deco-rule">New game</div>
          <p className="muted small mb">
            Death at Blackwood Hall — 4 to 8 players, three acts, about an hour.
          </p>
          <button
            style={{ width: '100%' }}
            disabled={!connected}
            onClick={() => {
              send({ type: 'create-room', caseId: 'blackwood-hall' });
            }}
          >
            Open the house
          </button>
        </div>
      </div>
    );
  }

  const phase = view?.phase ?? 'lobby';
  return (
    <div className="stage" style={{ maxWidth: 760 }}>
      <header className="row mb">
        <div className="grow">
          <h1 className="title" style={{ textAlign: 'left', fontSize: '1.4rem' }}>
            Console
          </h1>
          <div className="muted small">
            Room <strong>{roomCode}</strong> · {phase}
            {phase !== 'lobby' ? ` · act ${String(view?.act ?? 1)}` : ''}
          </div>
        </div>
        {view?.actStartedAt !== undefined && (
          <div className="timer" style={{ fontSize: '2rem' }}>
            {remaining(view.actStartedAt, view.actMinutes, now)}
          </div>
        )}
      </header>

      <div className="deco-frame mb">
        <div className="deco-rule">Run of play</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
          {phase === 'lobby' && (
            <button
              disabled={(view?.players.length ?? 0) < 4}
              onClick={() => {
                send({ type: 'facilitator', action: 'start' });
              }}
            >
              Start Act 1 ({String(view?.players.length ?? 0)} joined, need 4+)
            </button>
          )}
          {phase === 'lobby' && (
            <button
              className="ghost"
              disabled={(view?.players.length ?? 0) >= 8}
              onClick={() => {
                send({ type: 'add-bot' });
              }}
              title="Seats an AI player. They are dealt a character and play it."
            >
              Add an AI player
            </button>
          )}
          {phase === 'act' && (
            <button
              onClick={() => {
                send({ type: 'facilitator', action: 'open-commitment' });
              }}
            >
              Close the act — open the decision
            </button>
          )}
          {phase === 'commitment' && (
            <button
              onClick={() => {
                send({ type: 'facilitator', action: 'next-act' });
              }}
            >
              {view?.act === 3
                ? 'End the game — reveal'
                : `Begin Act ${String((view?.act ?? 1) + 1)}`}
            </button>
          )}
          {phase === 'reveal' && (
            <span className="muted small">The reveal is on the big screen.</span>
          )}
        </div>
        <p className="muted small mt">
          Acts are suggestions, not shackles — close an act when the room is ready, not when the
          clock says so.
        </p>
      </div>

      <div className="deco-frame mb">
        <div className="deco-rule">The room</div>
        {(view?.players ?? []).map((p) => (
          <div
            className="row"
            key={p.id}
            style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--panel-edge)' }}
          >
            <span className="grow">
              {p.bot ? '🤖' : p.connected ? '🟢' : '⚪️'} {p.name}
              {p.bot && <span className="muted small"> · AI</span>}
            </span>
            <span className="muted small">{String(p.moveCount)} moves</span>
          </div>
        ))}
        <p className="muted small mt">
          {String(view?.boardCount ?? 0)} clues tabled · {String(view?.questionCount ?? 0)}{' '}
          questions asked
          {view?.accusationMade ? ' · accusation made' : ''}
        </p>
      </div>

      {view?.teamReveal && (
        <div className="deco-frame fade-up">
          <div className="deco-rule">Team shape (yours only — no individual profiles)</div>
          <p style={{ lineHeight: 1.7 }}>{view.teamReveal.shape}</p>
          {view.teamReveal.missingViews.length > 0 && (
            <>
              <div className="deco-rule mt">Missing views</div>
              {view.teamReveal.missingViews.map((m) => (
                <p className="small muted" key={m}>
                  ◆ {m}
                </p>
              ))}
            </>
          )}
          <div className="deco-rule mt">Debrief prompts</div>
          {view.teamReveal.debriefPrompts.map((q) => (
            <p className="small" style={{ lineHeight: 1.8 }} key={q}>
              — {q}
            </p>
          ))}
        </div>
      )}
      {error && <div className="toast">{error}</div>}
    </div>
  );
}
