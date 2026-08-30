/**
 * Optional Postgres persistence. When DATABASE_URL is unset (local dev,
 * tests), everything is in-memory and this module is a no-op.
 */
import pg from 'pg';
import { computeInsights, type GameState, type Insights } from '@tmv/core';

const url = process.env.DATABASE_URL;
const pool = url
  ? new pg.Pool({
      connectionString: url,
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : null;

/** True when a live Postgres is configured; false means finished games are lost. */
export function dbConfigured(): boolean {
  return pool !== null;
}

export async function initDb(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id          BIGSERIAL PRIMARY KEY,
      room_code   TEXT NOT NULL,
      case_id     TEXT NOT NULL,
      state       JSONB NOT NULL,
      emails      JSONB NOT NULL DEFAULT '[]',
      finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      metrics     JSONB NOT NULL DEFAULT '{}'
    )
  `);
  // Older deployments predate the column; adding it is cheaper than a migration tool.
  await pool.query(
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '{}'`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS debrief (
      id            BIGSERIAL PRIMARY KEY,
      room_code     TEXT NOT NULL,
      case_id       TEXT NOT NULL,
      player_id     TEXT NOT NULL,
      knew_before   TEXT NOT NULL,
      saw_something BOOLEAN NOT NULL,
      play_again    BOOLEAN NOT NULL,
      will_change   TEXT,
      at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (room_code, player_id)
    )
  `);
}

export async function saveFinishedGame(
  roomCode: string,
  caseId: string,
  state: GameState,
  emails: readonly { playerId: string; email: string }[],
  metrics: unknown = {},
): Promise<void> {
  if (!pool) return;
  await pool.query(
    'INSERT INTO games (room_code, case_id, state, emails, metrics) VALUES ($1, $2, $3, $4, $5)',
    [roomCode, caseId, JSON.stringify(state), JSON.stringify(emails), JSON.stringify(metrics)],
  );
}

export interface DebriefAnswer {
  knewBefore: 'no' | 'suspected' | 'yes';
  sawSomething: boolean;
  wouldPlayAgain: boolean;
  willChange?: string;
}

/**
 * One row per player per room. Re-answering overwrites rather than duplicating,
 * because a phone that reconnects and resubmits is not a second opinion.
 */
export async function saveDebrief(
  roomCode: string,
  caseId: string,
  playerId: string,
  answer: DebriefAnswer,
): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO debrief (room_code, case_id, player_id, knew_before, saw_something, play_again, will_change)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (room_code, player_id) DO UPDATE SET
       knew_before = EXCLUDED.knew_before,
       saw_something = EXCLUDED.saw_something,
       play_again = EXCLUDED.play_again,
       will_change = EXCLUDED.will_change,
       at = now()`,
    [
      roomCode,
      caseId,
      playerId,
      answer.knewBefore,
      answer.sawSomething,
      answer.wouldPlayAgain,
      answer.willChange ?? null,
    ],
  );
}

/**
 * Every session and every answer, aggregated. Null when there is no database:
 * the games were still played, we simply kept nothing.
 *
 * Bounded rather than paged. Beyond a few hundred sessions this wants a real
 * analytics story, and pretending otherwise here would hide that.
 */
export async function readInsights(): Promise<Insights | null> {
  if (!pool) return null;
  // Rows written before the metrics column existed carry null, not {}.
  const games = await pool.query<{ metrics: Record<string, unknown> | null; finished_at: Date }>(
    'SELECT metrics, finished_at FROM games ORDER BY finished_at DESC LIMIT 500',
  );
  const answers = await pool.query<{
    knew_before: 'no' | 'suspected' | 'yes';
    saw_something: boolean;
    play_again: boolean;
    will_change: string | null;
    at: Date;
  }>(
    'SELECT knew_before, saw_something, play_again, will_change, at FROM debrief ORDER BY at DESC LIMIT 2000',
  );
  return computeInsights(
    games.rows.map((r) => ({ metrics: r.metrics ?? {}, finishedAt: r.finished_at.toISOString() })),
    answers.rows.map((r) => ({
      knewBefore: r.knew_before,
      sawSomething: r.saw_something,
      playAgain: r.play_again,
      willChange: r.will_change,
      at: r.at.toISOString(),
    })),
  );
}
