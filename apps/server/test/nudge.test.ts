/**
 * Pacing (D12). An act running out with a quiet room gets one prompt: the clue
 * is named, its contents are not, and neither is the person holding it.
 */
import { describe, expect, it } from 'vitest';
import { blackwoodHall } from '@tmv/core';
import { Room } from '../src/room.js';
import type { PhoneView, ScreenView, ServerMessage } from '../src/protocol.js';

const MIN = 60_000;

/** A started game with four seated players and a captured view per surface. */
function table() {
  const room = new Room(blackwoodHall, { voteDelayMs: 0, seed: 4242 });
  const seen = new Map<string, ServerMessage[]>();
  const ids = ['Ana', 'Ben', 'Cat', 'Dev'].map((n) => room.joinPlayer(n));
  for (const id of ids) {
    seen.set(id, []);
    room.addClient({ role: 'phone', playerId: id, send: (m) => seen.get(id)?.push(m) });
  }
  seen.set('screen', []);
  room.addClient({ role: 'screen', send: (m) => seen.get('screen')?.push(m) });
  return { room, ids, seen };
}

const last = <T extends ServerMessage>(msgs: ServerMessage[], type: T['type']): T | undefined =>
  [...msgs].reverse().find((m) => m.type === type) as T | undefined;

describe('the pacing nudge', () => {
  it('says nothing while the act still has time on it', async () => {
    const { room, seen } = table();
    await room.facilitate('start');
    room.considerNudge(Date.now());
    expect(last<ScreenView>(seen.get('screen')!, 'screen-view')?.nudge).toBeUndefined();
  });

  it('says nothing in the closing minutes if the room is busy', async () => {
    const { room, ids, seen } = table();
    await room.facilitate('start');
    const hand = room.snapshot().state!.players.find((p) => p.id === ids[0])!.hand;
    // Deep into the act — but somebody moved thirty seconds ago.
    const deep = Date.now() + 12 * MIN;
    await room.handleMove({ type: 'table', playerId: ids[0]!, clueId: hand[0]! }, deep - 30_000);
    room.considerNudge(deep);
    expect(last<ScreenView>(seen.get('screen')!, 'screen-view')?.nudge).toBeUndefined();
  });

  it('prompts once the room has been quiet long enough', async () => {
    const { room, ids, seen } = table();
    await room.facilitate('start');
    const hand = room.snapshot().state!.players.find((p) => p.id === ids[0])!.hand;
    const deep = Date.now() + 12 * MIN;
    // The same move, but three minutes of silence after it.
    await room.handleMove({ type: 'table', playerId: ids[0]!, clueId: hand[0]! }, deep - 3 * MIN);
    room.considerNudge(deep);
    expect(last<ScreenView>(seen.get('screen')!, 'screen-view')?.nudge).toContain('gone quiet');
  });

  it('prompts the room when the act is running out and nothing is happening', async () => {
    const { room, seen } = table();
    await room.facilitate('start');
    // Act 1 is fifteen minutes; nothing has happened at all.
    room.considerNudge(Date.now() + 12 * MIN);
    const nudge = last<ScreenView>(seen.get('screen')!, 'screen-view')?.nudge;
    expect(nudge).toContain('gone quiet');
    expect(nudge).toContain('still holding');
  });

  it('names the clue on the screen but never who is holding it', async () => {
    const { room, ids, seen } = table();
    await room.facilitate('start');
    room.considerNudge(Date.now() + 12 * MIN);
    const nudge = last<ScreenView>(seen.get('screen')!, 'screen-view')?.nudge ?? '';
    for (const name of ['Ana', 'Ben', 'Cat', 'Dev']) expect(nudge).not.toContain(name);
    // and it does not give the clue's contents away either
    const named = blackwoodHall.clues.find((c) => nudge.includes(c.title));
    expect(named, 'no clue was named').toBeTruthy();
    expect(nudge).not.toContain(named!.text.slice(0, 30));
    void ids;
  });

  it('tells exactly one player, and it is the one holding it', async () => {
    const { room, ids, seen } = table();
    await room.facilitate('start');
    room.considerNudge(Date.now() + 12 * MIN);
    const told = ids.filter((id) => last<PhoneView>(seen.get(id)!, 'phone-view')?.nudge);
    expect(told).toHaveLength(1);
    const view = last<PhoneView>(seen.get(told[0]!)!, 'phone-view')!;
    const named = blackwoodHall.clues.find((c) => view.nudge?.includes(c.title))!;
    expect(view.hand.map((h) => h.id)).toContain(named.id);
  });

  it('prompts once per act, not every half minute', async () => {
    const { room, seen } = table();
    await room.facilitate('start');
    const at = Date.now() + 12 * MIN;
    room.considerNudge(at);
    const first = seen.get('screen')!.length;
    room.considerNudge(at + 30_000);
    room.considerNudge(at + 60_000);
    expect(seen.get('screen')!.length).toBe(first);
  });

  it('drops the prompt the moment the clue reaches the board', async () => {
    const { room, ids, seen } = table();
    await room.facilitate('start');
    room.considerNudge(Date.now() + 12 * MIN);
    const nudge = last<ScreenView>(seen.get('screen')!, 'screen-view')?.nudge ?? '';
    const named = blackwoodHall.clues.find((c) => nudge.includes(c.title))!;
    const holder = room.snapshot().state!.players.find((p) => p.hand.includes(named.id))!;
    await room.handleMove({ type: 'table', playerId: holder.id, clueId: named.id });
    expect(last<ScreenView>(seen.get('screen')!, 'screen-view')?.nudge).toBeUndefined();
    void ids;
  });
});
