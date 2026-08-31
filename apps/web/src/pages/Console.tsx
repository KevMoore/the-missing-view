/** The facilitator console (D4): create, monitor, drive the acts, see team shape. */
import { useEffect, useState } from 'react';
import {
  remaining,
  useGameSocket,
  type ClientMessage,
  type CaseList,
  type ConsoleView,
  type SessionMode,
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
  /** One house, or two playing the same case head to head (D38). */
  const [mode, setMode] = useState<SessionMode>('one-house');
  /** The player the facilitator is casting. Null while they pick one. */
  const [casting, setCasting] = useState<string | null>(null);

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
          <div className="deco-rule mt">How are they playing?</div>
          {/* Two houses is a different game, not a setting: it needs twice the
              people and the teams have to be decided before anybody is dealt in.
              Asking here, once, is the only place it can be asked. */}
          {(
            [
              [
                'one-house',
                'One house',
                'Four to eight players, one investigation, one accusation they all have to agree on.',
              ],
              [
                'two-houses',
                'Two houses, head to head',
                'Eight to sixteen. You split them into two teams; each gets the same case and never sees the other’s board. Compared at the end.',
              ],
            ] as const
          ).map(([value, label, blurb]) => (
            <button
              key={value}
              className={mode === value ? 'mb' : 'ghost mb'}
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => {
                setMode(value);
              }}
            >
              {label}
              <span className="muted small" style={{ display: 'block', lineHeight: 1.5 }}>
                {blurb}
              </span>
            </button>
          ))}
          <p className="muted small mb" style={{ lineHeight: 1.7 }}>
            You need a big screen in the room — a TV, a projector, a laptop on the table — and one
            phone per player. This page is yours alone: you run the game, you do not play it.
          </p>
          <button
            style={{ width: '100%' }}
            disabled={!connected || (cases.length > 1 && !chosen)}
            onClick={() => {
              send({ type: 'create-room', caseId: chosen || 'blackwood-hall', mode });
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

          {view && (
            <div className={`setup-step${allCast(view) ? ' done' : ''}`}>
              <span className="num">{allCast(view) ? '✓' : '3'}</span>
              <span className="what">
                <strong>
                  {view.mode === 'two-houses'
                    ? 'Split them into two houses, and cast them.'
                    : 'Cast them.'}
                </strong>
                <span className="muted small" style={{ display: 'block', lineHeight: 1.7 }}>
                  You know these people and the game is about how they work together, so put the
                  character on the person on purpose. Anybody you leave alone is cast at random from
                  what is left — and the brief under each name tells you who they are, so a quiet
                  person gets a part that suits them and nobody is asked to play the wrong sex.
                </span>
                <Casting view={view} casting={casting} setCasting={setCasting} send={send} />
              </span>
            </div>
          )}

          <div className="setup-step">
            <span className="num">4</span>
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
              disabled={!view?.houses.every((h) => h.ready)}
              onClick={() => {
                send({ type: 'facilitator', action: 'start' });
              }}
            >
              {view?.mode === 'two-houses'
                ? `Start Act 1 (${view.houses.map((h) => `${h.name} ${String(h.playerCount)}`).join(' · ')}, need 4+ each)`
                : `Start Act 1 (${String(view?.players.length ?? 0)} joined, need 4+)`}
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
              disabled={(view?.players.length ?? 0) >= (view?.mode === 'two-houses' ? 16 : 8)}
              onClick={() => {
                send({ type: 'add-bot' });
              }}
              title="Seats an AI player in whichever house needs one. They are dealt a character and play it."
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

      {/* Not in the lobby: the casting table above is the roster there, and
          showing every name twice on one page made the setup harder to read
          rather than easier. This panel is the in-play monitor. */}
      {phase !== 'lobby' && (
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
                {p.characterName !== undefined && (
                  <span className="muted small"> · {p.characterName}</span>
                )}
                {p.bot && <span className="muted small"> · AI</span>}
              </span>
              {view?.mode === 'two-houses' && (
                <span className="muted small">
                  {view.houses.find((h) => h.id === p.houseId)?.name ?? '—'}
                </span>
              )}
              <span className="muted small">{String(p.moveCount)} moves</span>
            </div>
          ))}
          <p className="muted small mt">
            {String(view?.boardCount ?? 0)} clues tabled · {String(view?.questionCount ?? 0)}{' '}
            questions asked
            {view?.accusationMade ? ' · accusation made' : ''}
          </p>
        </div>
      )}

      {view?.comparison && (
        <div className="deco-frame mb fade-up">
          <div className="deco-rule">Head to head</div>
          <div className="split">
            {view.comparison.map((h) => (
              <Stat
                key={h.id}
                label={h.name}
                value={h.solved ? 'Solved' : (h.culpritId ?? 'no accusation')}
              />
            ))}
          </div>
          <p className="muted small mt" style={{ lineHeight: 1.6 }}>
            Two teams, the same case, the same suspects, different hands. What is worth talking
            about is not who won — it is what each of them did differently with the same evidence,
            and which of the two behaviours below they recognise in themselves.
          </p>
          {view.comparison.map((h) => (
            <p className="small" key={h.id}>
              <strong>{h.name}</strong>{' '}
              <span className="muted">
                {h.minutes} min · {h.cluesTabled} clues tabled · {h.theoriesProposed} theories ·{' '}
                {h.questionsAsked} questions
              </span>
            </p>
          ))}
        </div>
      )}

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
          {view.teamReveal.postMortem && (
            <>
              <div className="deco-rule mt">How it went</div>
              <p className="mb" style={{ lineHeight: 1.7 }}>
                {view.teamReveal.postMortem.solved
                  ? `They named ${view.teamReveal.postMortem.culprit}, and they were right.`
                  : view.teamReveal.postMortem.accused
                    ? `They named ${view.teamReveal.postMortem.accused}. It was ${view.teamReveal.postMortem.culprit}.`
                    : `They never accused anybody. It was ${view.teamReveal.postMortem.culprit}.`}
              </p>
              <div className="split">
                <Stat label="Minutes" value={String(view.teamReveal.postMortem.minutes)} />
                <Stat
                  label="Clues tabled"
                  value={`${String(view.teamReveal.postMortem.cluesTabled)}/${String(view.teamReveal.postMortem.cluesTotal)}`}
                />
                <Stat label="Questions" value={String(view.teamReveal.postMortem.questionsAsked)} />
                <Stat
                  label="Theories"
                  value={String(view.teamReveal.postMortem.theoriesProposed)}
                />
                <Stat
                  label="Challenges"
                  value={String(view.teamReveal.postMortem.challengesRaised)}
                />
                <Stat label="Dominance" value={view.teamReveal.postMortem.dominance.toFixed(2)} />
              </div>
              <p className="muted small mt" style={{ lineHeight: 1.6 }}>
                Dominance runs 0 to 1: zero when everyone contributed equally, one when a single
                player did everything. It does not say who.
              </p>
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
          <p className="muted small mt">
            <a href="/insights" target="_blank" rel="noreferrer">
              Results across every session ↗
            </a>{' '}
            — including what players said they would do differently.
          </p>
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

/** A single figure with its label, for the post-mortem. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/** True once every seat has a house that can play and a character on it. */
function allCast(view: ConsoleView): boolean {
  return (
    view.houses.every((h) => h.ready) && view.players.every((p) => p.characterId !== undefined)
  );
}

/**
 * The casting table (D37, D38).
 *
 * Two lists and one rule: pick a person, then pick a face. The alternative was
 * a dropdown per player, which hides exactly the thing the facilitator needs to
 * see — who is still uncast, who is doubled up, and what each part actually is.
 * Here the whole cast is on screen at once with its briefs, and a character
 * already taken says so on its own card.
 *
 * Nothing here is compulsory. A facilitator who wants to just start can: every
 * empty seat is cast from what is left when the game is dealt.
 */
function Casting({
  view,
  casting,
  setCasting,
  send,
}: {
  view: ConsoleView;
  casting: string | null;
  setCasting: (id: string | null) => void;
  send: (msg: ClientMessage) => void;
}) {
  const selected = view.players.find((p) => p.id === casting);
  if (view.players.length === 0) return <p className="muted small mt">Nobody has joined yet.</p>;

  return (
    <div className="casting mt">
      {view.mode === 'two-houses' && (
        <div className="houses-row mb">
          {view.houses.map((h) => (
            <div className={`house-card${h.ready ? ' ready' : ''}`} key={h.id}>
              <input
                className="house-name"
                value={h.name}
                aria-label={`Name for ${h.name}`}
                maxLength={24}
                onChange={(e) => {
                  send({ type: 'name-house', houseId: h.id, name: e.target.value });
                }}
              />
              <span className="muted small">
                {h.playerCount} {h.playerCount === 1 ? 'player' : 'players'}
                {h.ready ? '' : ' · needs 4'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="cast-seats">
        {view.players.map((p) => (
          <button
            key={p.id}
            className={`seat${casting === p.id ? ' picked' : ''}${p.characterId === undefined ? ' bare' : ''}`}
            onClick={() => {
              setCasting(casting === p.id ? null : p.id);
            }}
          >
            <strong>
              <span aria-hidden>{p.bot ? '🤖' : p.connected ? '🟢' : '⚪️'}</span> {p.name}
            </strong>
            <span className="muted small">{p.characterName ?? 'not cast'}</span>
            {view.mode === 'two-houses' && (
              <span className="seat-house">
                {view.houses.find((h) => h.id === p.houseId)?.name ?? '—'}
              </span>
            )}
          </button>
        ))}
      </div>

      {selected && view.mode === 'two-houses' && (
        <div className="row mt" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="muted small">Put {selected.name} in</span>
          {view.houses.map((h) => (
            <button
              key={h.id}
              className={selected.houseId === h.id ? '' : 'ghost'}
              onClick={() => {
                send({ type: 'assign', playerId: selected.id, houseId: h.id });
              }}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}

      {selected && view.characters && (
        <>
          <div className="deco-rule mt">
            {selected.characterName === undefined
              ? `Who is ${selected.name}?`
              : `${selected.name} is ${selected.characterName}`}
          </div>
          <div className="cast-grid">
            {view.characters.map((c) => {
              const mine = selected.characterId === c.id;
              const gone = c.takenBy !== undefined && !mine;
              return (
                <button
                  key={c.id}
                  className={`cast-card${mine ? ' mine' : ''}${gone ? ' gone' : ''}`}
                  disabled={gone}
                  title={c.voiceDirection ?? c.role}
                  onClick={() => {
                    send({
                      type: 'assign',
                      playerId: selected.id,
                      characterId: mine ? '' : c.id,
                    });
                  }}
                >
                  {c.portraitAsset !== undefined && <img src={c.portraitAsset} alt="" />}
                  <span className="cast-name">{c.name}</span>
                  <span className="muted small">{c.role}</span>
                  {/* The vocal direction is the one field that states sex and
                      age plainly, which is what stops a mismatch between the
                      player and the voice their questions are read in. */}
                  {c.voiceDirection !== undefined && (
                    <span className="cast-brief">{c.voiceDirection}</span>
                  )}
                  {gone && <span className="cast-taken">{c.takenBy}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
