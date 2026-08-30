/**
 * Optional Postgres persistence. When DATABASE_URL is unset (local dev,
 * tests), everything is in-memory and this module is a no-op.
 */
import pg from 'pg';
import type { GameState } from '@tmv/core';

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
      finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function saveFinishedGame(
  roomCode: string,
  caseId: string,
  state: GameState,
  emails: readonly { playerId: string; email: string }[],
): Promise<void> {
  if (!pool) return;
  await pool.query(
    'INSERT INTO games (room_code, case_id, state, emails) VALUES ($1, $2, $3, $4)',
    [roomCode, caseId, JSON.stringify(state), JSON.stringify(emails)],
  );
}
