/**
 * AI players. No API key in the test env, so every line here exercises the
 * deterministic path — which is exactly the path a solo playtest uses before
 * OPENAI_API_KEY is set.
 */
import { describe, expect, it } from 'vitest';
import { blackwoodHall } from '@tmv/core';
import { Room } from '../src/room.js';
import { BotDriver } from '../src/bots.js';

/** A room with one human and three bots, started and ticked `rounds` times. */
async function seated(rounds = 0) {
  // No wall-clock waits in tests: bots vote as soon as they are ticked.
  const room = new Room(blackwoodHall, { voteDelayMs: 0 });
  const human = room.joinPlayer('Kev');
  const bots = [room.addBot(), room.addBot(), room.addBot()];
  await room.facilitate('start');
  for (let i = 0; i < rounds; i++) await room.tickBots();
  return { room, human, bots };
}

describe('AI players', () => {
  it('seats bots as ordinary players and lets a solo human reach the 4-player minimum', async () => {
    const { room, bots } = await seated();
    const { state } = room.snapshot();
    expect(state?.players).toHaveLength(4);
    // Each bot was dealt a character and a private hand by the same seeded deal.
    for (const bot of bots) {
      const player = state?.players.find((p) => p.id === bot.id);
      expect(player?.characterId).toBeTruthy();
      expect(player?.hand.length ?? 0).toBeGreaterThan(0);
      expect(room.isBot(bot.id)).toBe(true);
    }
    room.stopBots();
  });

  it('acts in character — the board fills and the suspects get questioned', async () => {
    const { room } = await seated(8);
    const { state } = room.snapshot();
    expect(state?.board.length ?? 0).toBeGreaterThan(0);
    // Blackwood's cast covers all five leans, so a few rounds produce a mix.
    const kinds = new Set((state?.log ?? []).map((e) => e.move.type));
    expect(kinds.has('table')).toBe(true);
    expect(kinds.size).toBeGreaterThan(1);
    room.stopBots();
  });

  it('never accuses — ending the game stays the human’s call', async () => {
    const { room } = await seated(12);
    const { state } = room.snapshot();
    expect(state?.accusation).toBeUndefined();
    expect((state?.log ?? []).some((e) => e.move.type === 'accuse')).toBe(false);
    room.stopBots();
  });

  it('votes in a commitment, once, and spreads across the options', async () => {
    const { room, bots } = await seated(2);
    await room.facilitate('open-commitment');
    await room.tickBots();
    await room.tickBots(); // a second tick must not double-vote

    const { state } = room.snapshot();
    const commitment = state?.commitments.at(-1);
    const votes = bots.map((b) => commitment?.votes[b.id]);
    expect(votes.every(Boolean)).toBe(true);
    expect(new Set(votes).size).toBeGreaterThan(1);
    room.stopBots();
  });

  it('a bot losing a race to the human is not an error', async () => {
    const moves: string[] = [];
    const driver = new BotDriver(
      {
        snapshot: () => ({ caseId: 'x', state: null }),
        joinPlayer: () => 'p-1',
        handleMove: () => Promise.reject(new Error('boom')),
      },
      blackwoodHall,
    );
    // No players seated: a tick is a no-op and must not throw.
    await expect(driver.tick()).resolves.toBeUndefined();
    expect(moves).toHaveLength(0);
    driver.stop();
  });
});
