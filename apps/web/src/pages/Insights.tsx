/**
 * Results across every session (PRD §18, §19).
 *
 * Not a dashboard. One number is on trial here — the share of players who did
 * not realise the session was about their team until the reveal — and §19 says
 * so outright. It gets the whole top of the page, with a plain-language reading
 * beside it, and everything below is context for it.
 *
 * The free text sits at the bottom and is the half most worth reading. A
 * percentage tells you the product works; "ask the quiet one first" tells you
 * what it did to somebody.
 */
import { useEffect, useState } from 'react';
import { readSurprise } from '@tmv/core';
import type { Insights as Data } from '../ws.js';

export function Insights() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const since = new URLSearchParams(location.search).get('since') ?? '';

  useEffect(() => {
    fetch(`/api/insights${since ? `?since=${encodeURIComponent(since)}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Data) => {
        setData(d);
      })
      .catch(() => {
        setError('No results yet. Games are only recorded when DATABASE_URL is set.');
      });
  }, [since]);

  if (error) return <div className="stage center muted">{error}</div>;
  if (!data) return <div className="stage center muted">Reading the sessions…</div>;

  if (data.sessions === 0 && data.answers === 0) {
    return (
      <div className="stage" style={{ maxWidth: 640 }}>
        <h1 className="title">Nothing yet</h1>
        <p className="muted center mt">
          {data.since === undefined
            ? 'No finished sessions have been recorded. Games only persist when DATABASE_URL is set.'
            : `Nothing since ${data.since.slice(0, 10)}. Earlier sessions are still stored — nothing was deleted.`}
        </p>
      </div>
    );
  }

  return (
    <div className="stage insights" style={{ maxWidth: 900 }}>
      <h1 className="title" style={{ fontSize: '2rem' }}>
        The Missing View
      </h1>
      <p className="muted center small">
        {data.sessions} session{data.sessions === 1 ? '' : 's'} · {data.answers} answer
        {data.answers === 1 ? '' : 's'}
        {data.since !== undefined && (
          <>
            {' · '}
            counting from {data.since.slice(0, 10)}{' '}
            <a href={`${location.pathname}?since=1970-01-01`}>show everything</a>
          </>
        )}
      </p>

      <div className="deco-frame mt">
        <div className="deco-rule">Did they see it coming?</div>
        <div className="headline-figure">{fmt(data.surprisedPct, '%')}</div>
        <p className="center muted small">
          of players had <strong>no idea</strong> the session was about their team until the reveal
        </p>
        <p className="center mt" style={{ lineHeight: 1.7 }}>
          {readSurprise(data)}
        </p>
        <div className="split mt">
          <Stat label="Suspected something" value={fmt(data.suspectedPct, '%')} />
          <Stat label="Knew all along" value={fmt(data.knewPct, '%')} />
        </div>
      </div>

      <div className="deco-frame mt">
        <div className="deco-rule">Did it land?</div>
        <div className="split">
          <Stat
            label="Showed them something about the team"
            value={fmt(data.sawSomethingPct, '%')}
          />
          <Stat label="Would play another" value={fmt(data.playAgainPct, '%')} />
        </div>
      </div>

      <div className="deco-frame mt">
        <div className="deco-rule">How the sessions ran</div>
        <div className="split">
          <Stat label="Reached the reveal" value={fmt(data.completionPct, '%')} />
          <Stat label="Named the culprit" value={fmt(data.solvedPct, '%')} />
          <Stat label="Median length" value={fmt(data.medianMinutes, ' min')} />
          <Stat label="Median players" value={fmt(data.medianPlayers, '')} />
        </div>
        <p className="muted small mt" style={{ lineHeight: 1.7 }}>
          Solving is not the measure. A room that named the wrong person having reached seven
          moments had a better session than one that guessed right in twenty minutes.
        </p>
      </div>

      <div className="deco-frame mt">
        <div className="deco-rule">How the teams behaved</div>
        <div className="split">
          <Stat
            label="Median moments reached"
            value={
              data.medianMomentsReached === null ? '—' : `${String(data.medianMomentsReached)}/8`
            }
          />
          <Stat label="Offered and passed over" value={String(data.totalPassedOver)} />
          <Stat label="Median dominance" value={fmt(data.medianDominance, '')} />
        </div>
        <p className="muted small mt" style={{ lineHeight: 1.7 }}>
          Dominance runs 0 to 1: zero when everyone contributed equally, one when a single player
          did everything. A rising figure means the game is letting one person carry the room, which
          it is designed not to.
        </p>
      </div>

      {data.changes.length > 0 && (
        <div className="deco-frame mt">
          <div className="deco-rule">What people said they would do differently</div>
          {data.changes.map((c: Data['changes'][number]) => (
            <p className="reflect" key={`${c.at}${c.text}`}>
              “{c.text}”
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/** A missing number is "—", never a zero pretending to be a measurement. */
function fmt(n: number | null, suffix: string): string {
  return n === null ? '—' : `${String(n)}${suffix}`;
}
