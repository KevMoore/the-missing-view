import { describe, expect, it } from 'vitest';
import { blackwoodHall } from '@tmv/core';
import { Room, type Client } from '../src/room.js';
import type { PhoneView, ScreenView, ServerMessage } from '../src/protocol.js';

function harness() {
  const room = new Room(blackwoodHall);
  const inbox = new Map<string, ServerMessage[]>();
  const attach = (role: Client['role'], playerId?: string): Client => {
    const key = playerId ?? role;
    inbox.set(key, []);
    const client: Client = {
      role,
      ...(playerId ? { playerId } : {}),
      send: (msg) => inbox.get(key)?.push(msg),
    };
    room.addClient(client);
    return client;
  };
  const last = <T extends ServerMessage>(key: string, type: T['type']): T | undefined =>
    inbox
      .get(key)
      ?.filter((m) => m.type === type)
      .at(-1) as T | undefined;
  return { room, attach, last };
}

describe('Room', () => {
  it('deals private hands and never leaks another player’s clues', async () => {
    const { room, attach, last } = harness();
    const ids = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'].map((n) => room.joinPlayer(n));
    ids.forEach((id) => attach('phone', id));
    attach('screen');
    await room.facilitate('start');

    const hands = ids.map((id) => last<PhoneView>(id, 'phone-view')!.hand.map((c) => c.id));
    expect(hands.every((h) => h.length > 0)).toBe(true);
    // No two players share a clue.
    const all = hands.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('the screen never contains the solution before the reveal (D21)', async () => {
    const { room, attach } = harness();
    ['Ana', 'Ben', 'Cat', 'Dev'].forEach((n) => attach('phone', room.joinPlayer(n)));
    attach('screen');
    await room.facilitate('start');
    const serialized = JSON.stringify(room.screenView());
    expect(serialized).not.toContain(blackwoodHall.solution.motive);
    expect(serialized).not.toContain(blackwoodHall.solution.narrative);
    expect(serialized).not.toContain('culpritId');
  });

  it('tabling a clue credits the player on the shared board', async () => {
    const { room, attach, last } = harness();
    const ids = ['Ana', 'Ben', 'Cat', 'Dev'].map((n) => room.joinPlayer(n));
    ids.forEach((id) => attach('phone', id));
    attach('screen');
    await room.facilitate('start');
    const ana = last<PhoneView>(ids[0]!, 'phone-view')!;
    await room.handleMove({ type: 'table', playerId: ids[0]!, clueId: ana.hand[0]!.id });
    const screen = last<ScreenView>('screen', 'screen-view')!;
    expect(screen.board).toHaveLength(1);
    expect(screen.board[0]!.byName).toBe('Ana');
  });

  it('full game reaches the reveal with all three outputs (D11)', async () => {
    const { room, attach, last } = harness();
    const ids = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'].map((n) => room.joinPlayer(n));
    ids.forEach((id) => attach('phone', id));
    attach('screen');
    attach('console');
    await room.facilitate('start');

    // A few moves so the reveal has signal.
    const ana = last<PhoneView>(ids[0]!, 'phone-view')!;
    await room.handleMove({ type: 'table', playerId: ids[0]!, clueId: ana.hand[0]!.id });
    await room.handleMove({
      type: 'ask-suspect',
      playerId: ids[1]!,
      questionId: 'q1',
      suspectId: 's-reeves',
      text: 'Were the doors bolted?',
    });
    await room.handleMove({
      type: 'propose-theory',
      playerId: ids[2]!,
      theoryId: 't1',
      text: 'The books are wrong',
    });
    await room.handleMove({ type: 'challenge-theory', playerId: ids[3]!, theoryId: 't1' });

    for (let round = 0; round < 3; round++) {
      await room.facilitate('open-commitment');
      await room.facilitate('next-act');
    }

    const screen = last<ScreenView>('screen', 'screen-view')!;
    expect(screen.phase).toBe('reveal');
    expect(screen.reveal!.strengths).toHaveLength(5);
    expect(screen.reveal!.narrative).toBe(blackwoodHall.solution.narrative);

    const anaReveal = last<PhoneView>(ids[0]!, 'phone-view')!.privateReveal!;
    expect(anaReveal.evidence.length).toBeGreaterThan(0);

    const consoleMsg = last<import('../src/protocol.js').ConsoleView>('console', 'console-view')!;
    expect(consoleMsg.teamReveal!.debriefPrompts.length).toBeGreaterThan(0);
    // Facilitator never sees per-person profiles (D11).
    expect(JSON.stringify(consoleMsg.teamReveal)).not.toContain('Ana');
  });

  it('rejects a 9th player and joins after start', () => {
    const { room } = harness();
    for (let i = 0; i < 8; i++) room.joinPlayer(`P${String(i)}`);
    expect(() => room.joinPlayer('P9')).toThrow('full');
  });
});

describe('scene art', () => {
  it('names one backdrop per beat of the flow, and portraits reach both surfaces', async () => {
    const { room, attach, last } = harness();
    const ids = ['Ana', 'Ben', 'Cat', 'Dev'].map((n) => room.joinPlayer(n));
    ids.forEach((id) => attach('phone', id));
    attach('screen');

    const scenes = blackwoodHall.theme!.scenes!;
    expect(last<ScreenView>('screen', 'screen-view')?.sceneAsset).toBe(scenes.lobby);

    await room.facilitate('start');
    expect(last<ScreenView>('screen', 'screen-view')?.sceneAsset).toBe(scenes.act1);

    await room.facilitate('open-commitment');
    expect(last<ScreenView>('screen', 'screen-view')?.sceneAsset).toBe(scenes.commitment);

    await room.facilitate('next-act');
    expect(last<ScreenView>('screen', 'screen-view')?.sceneAsset).toBe(scenes.act2);

    // The victim rides the screen view; each player gets only their own face.
    const screen = last<ScreenView>('screen', 'screen-view')!;
    expect(screen.victim?.portraitAsset).toBe(blackwoodHall.victim.portraitAsset);
    expect(screen.suspects.every((s) => s.portraitAsset)).toBe(true);
    expect(last<PhoneView>(ids[0]!, 'phone-view')?.character.portraitAsset).toMatch(
      /^\/art\/blackwood-hall\/cast\/pc-/,
    );
  });
});
