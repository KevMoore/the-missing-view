/** The facilitator console (D4): create, monitor, drive the acts, see team shape. */
import { useEffect, useState } from 'react';
import {
  remaining,
  useGameSocket,
  type CaseList,
  type ConsoleView,
  type ServerMessage,
} from '../ws.js';

export function Console() {
  const [view, setView] = useState<ConsoleView | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(() =>
    sessionStorage.getItem('tmv-console-room'),
  );
  const [error, setError] = useState('');
  const [cases, setCases] = useState<CaseList['cases']>([]);
  const [chosen, setChosen] = useState('');
  const [now, setNow] = useState(Date.now());
  /**
   * The PRD's primary mode is online (§13) and the build is co-located (D1).
   * The game itself does not care — phones have always connected from anywhere
   * — but the instructions do, and a QR code is useless down a video call.
   */
  const [remote, setRemote] = useState(() => localStorage.getItem('tmv-remote') === '1');
  const [copied, setCopied] = useState(false);

  const { send, connected } = useGameSocket(
    (msg: ServerMessage) => {
      if (msg.type === 'cases') {
        setCases(msg.cases);
        setChosen((c) => c || (msg.cases[0]?.id ?? ''));
      } else if (msg.type === 'console-view') setView(msg);
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
          {/* One case is the common state and does not deserve a dropdown; more
              than one and the facilitator has to be asked. */}
          {cases.length > 1 ? (
            <>
              <p className="muted small mb">Which mystery?</p>
              {cases.map((c) => (
                <button
                  key={c.id}
                  className={chosen === c.id ? 'mb' : 'ghost mb'}
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => {
                    setChosen(c.id);
                  }}
                >
                  {c.title}
                  <span className="muted small" style={{ display: 'block', lineHeight: 1.5 }}>
                    {c.setting} · {c.players} players · about {c.minutes} minutes
                  </span>
                </button>
              ))}
            </>
          ) : (
            <p className="muted small mb">
              {cases[0]
                ? `${cases[0].title} — ${cases[0].players} players, three acts, about ${String(cases[0].minutes)} minutes.`
                : 'Death at Blackwood Hall — 4 to 8 players, three acts, about an hour.'}
            </p>
          )}
          <p className="muted small mb" style={{ lineHeight: 1.7 }}>
            You need a big screen in the room — a TV, a projector, a laptop on the table — and one
            phone per player. This page is yours alone: you run the game, you do not play it.
          </p>
          <button
            style={{ width: '100%' }}
            disabled={!connected || (cases.length > 1 && !chosen)}
            onClick={() => {
              send({ type: 'create-room', caseId: chosen || 'blackwood-hall' });
            }}
          >
            Open the house
          </button>
        </div>
      </div>
    );
  }

  const phase = view?.phase ?? 'lobby';
  const joinUrl = location.host;
  // The code travels with the link. Opening the screen used to mean switching
  // tabs, reading six characters off this page and typing them into that one.
  const screenUrl = `${location.origin}/screen?code=${roomCode}`;
  const inviteUrl = `${location.origin}/?code=${roomCode}`;
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
          <div
            className={`timer ${overrunning(view, now) ? 'late' : ''}`}
            style={{ fontSize: '2rem' }}
          >
            {remaining(view.actStartedAt, view.actMinutes, now)}
          </div>
        )}
      </header>

      {phase === 'lobby' && (
        <div className="deco-frame mb">
          <div className="deco-rule">Set the stage</div>
          <div className="row mb" style={{ gap: '0.5rem' }}>
            {[
              [false, 'Everyone in one room'],
              [true, 'Everyone on a call'],
            ].map(([value, label]) => (
              <button
                key={String(label)}
                className={remote === value ? '' : 'ghost'}
                onClick={() => {
                  setRemote(value as boolean);
                  localStorage.setItem('tmv-remote', value ? '1' : '0');
                }}
              >
                {label as string}
              </button>
            ))}
          </div>
          <div className={`setup-step${view?.screenConnected ? ' done' : ''}`}>
            <span className="num">{view?.screenConnected ? '✓' : '1'}</span>
            <span className="what">
              <strong>{remote ? 'Open the screen and share it.' : 'Open the big screen.'}</strong>
              <span className="muted small" style={{ display: 'block', lineHeight: 1.7 }}>
                {view?.screenConnected
                  ? remote
                    ? 'The screen is live. Share that tab in your call — and tick “share sound”, or the room gets the music and the suspects’ voices without hearing them.'
                    : 'The screen is showing the house. Everything the room looks at is there.'
                  : remote
                    ? 'Open '
                    : 'On the TV or projector, go to '}
                {!view?.screenConnected && <span className="url-chip">{screenUrl}</span>}
                {!view?.screenConnected &&
                  (remote
                    ? ' in a second tab, then share that tab in your call with sound on.'
                    : ' — the art, the music, the room code and the QR code all live there.')}
              </span>
              {!view?.screenConnected && (
                <button
                  className="ghost mt"
                  onClick={() => {
                    window.open(screenUrl, '_blank', 'noopener');
                  }}
                >
                  Open the big screen ↗
                </button>
              )}
            </span>
          </div>

          <div className={`setup-step${(view?.players.length ?? 0) >= 4 ? ' done' : ''}`}>
            <span className="num">{(view?.players.length ?? 0) >= 4 ? '✓' : '2'}</span>
            <span className="what">
              <strong>{remote ? 'Get everyone in.' : 'Sit the players down.'}</strong>
              <span className="muted small" style={{ display: 'block', lineHeight: 1.7 }}>
                {remote ? (
                  <>Paste this into the call chat. It carries the room code with it.</>
                ) : (
                  <>
                    Each player scans the QR code on the big screen, or opens{' '}
                    <span className="url-chip">{joinUrl}</span> and types the room code{' '}
                    <strong style={{ color: 'var(--gold-bright)' }}>{roomCode}</strong>.
                  </>
                )}{' '}
                Four is the minimum; use “Add an AI player” to fill the table when you are testing
                alone.
              </span>
              {remote && (
                <button
                  className="ghost mt"
                  onClick={() => {
                    void navigator.clipboard.writeText(inviteUrl).then(
                      () => {
                        setCopied(true);
                        setTimeout(() => {
                          setCopied(false);
                        }, 2500);
                      },
                      () => undefined,
                    );
                  }}
                >
                  {copied ? 'Copied ✓' : `Copy invite link`}
                </button>
              )}
            </span>
          </div>

          <div className="setup-step">
            <span className="num">3</span>
            <span className="what">
              <strong>Start Act 1.</strong>
              <span className="muted small" style={{ display: 'block', lineHeight: 1.7 }}>
                Every player is dealt a character and a private hand of clues. They table a clue to
                make it public, question the suspects, and post theories. You close each act when
                the room is ready. Nobody speaks to this console — read the room, not the screen.
              </span>
            </span>
          </div>
        </div>
      )}

      {phase !== 'lobby' && view && !view.screenConnected && (
        <div className="warn-bar small">
          The big screen is not open. The room cannot see the evidence board, the suspects, or the
          reveal. Open <span className="url-chip">{screenUrl}</span> on the large display.
        </div>
      )}

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
          {phase === 'lobby' && view?.hasPrologue === true && (
            <button
              className="ghost"
              disabled={!view.screenConnected}
              title={
                view.screenConnected
                  ? 'Roughly seventy seconds on the big screen. Play it once the room is seated.'
                  : 'The big screen is not open.'
              }
              onClick={() => {
                send({ type: 'prologue', playing: !view.prologuePlaying });
              }}
            >
              {view.prologuePlaying ? 'Stop the opening' : 'Play the opening'}
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
        {phase === 'act' && overrunning(view, now) && (
          <p className="small mt cue">
            The clock has run out. Nothing happens on its own — close the act when the room is
            ready, which may not be yet.
          </p>
        )}
        {phase === 'commitment' && view?.votesIn && (
          <p className="small mt cue">
            {view.votesIn.voted} of {view.votesIn.of} have voted.{' '}
            {view.votesIn.voted < view.votesIn.of
              ? 'Give the rest a moment, then move on — a missing vote is a finding, not a fault.'
              : 'Everyone is in.'}
          </p>
        )}
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
          {view.teamReveal.moments.length > 0 && (
            <>
              <div className="deco-rule mt">The eight moments</div>
              {view.teamReveal.moments.map((m) => (
                <div className="moment-row" key={m.moment}>
                  <span
                    className={`moment-dot${m.offered ? (m.landed ? ' landed' : ' missed') : ''}`}
                  >
                    {m.offered ? (m.landed ? '●' : '◐') : '○'}
                  </span>
                  <span className="grow">
                    <strong>{m.label}</strong>
                    <span className="muted small" style={{ display: 'block', lineHeight: 1.6 }}>
                      {m.offered
                        ? m.landed
                          ? `Opened with “${m.clueTitle}”, and the room answered with ${m.response ?? 'something'}.`
                          : `Opened with “${m.clueTitle}” — and the room moved straight past it.`
                        : (m.absentNote ?? 'Never happened.')}
                    </span>
                  </span>
                </div>
              ))}
              <p className="muted small mt">
                ● reached and answered · ◐ offered and passed over · ○ never happened
              </p>
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

/** The clock is advisory (D5), but the console still has to say whose move it is. */
function overrunning(view: ConsoleView | null, now: number): boolean {
  if (!view?.actStartedAt) return false;
  return now > view.actStartedAt + view.actMinutes * 60_000;
}
