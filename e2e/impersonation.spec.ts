/**
 * A move carries a playerId, and nothing checked it against the socket that
 * sent it — while the phone view hands every player every other player's id,
 * for the whisper list. Any phone could act as anybody, up to and including
 * accusing, which ends the game for the whole room.
 *
 * Tested at the protocol rather than through the UI: the UI has no way to do
 * this, which is exactly why it went unnoticed.
 */
import { expect, test } from '@playwright/test';

const WS = (base: string) => `${base.replace(/^http/, 'ws')}/ws`;

/** A raw client that keeps every message it is sent. */
interface Message {
  type: string;
  message?: string;
  roomCode?: string;
  playerId?: string;
  theories?: { text?: string }[];
}

function client(url: string) {
  // Node's own WebSocket: `ws` is a dependency of the server, not of the repo
  // root, and this test has no business reaching into it.
  const socket = new WebSocket(url);
  const seen: Message[] = [];
  socket.addEventListener('message', (e: MessageEvent<string>) => {
    seen.push(JSON.parse(e.data) as Record<string, unknown>);
  });
  const open = new Promise<void>((r) => {
    socket.addEventListener('open', () => {
      r();
    });
  });
  return {
    seen,
    open,
    send: (msg: unknown) => {
      socket.send(JSON.stringify(msg));
    },
    close: () => {
      socket.close();
    },
    /** The most recent message of this type. The views are pushed repeatedly,
     *  so the first one is almost never the one being asked about. */
    async wait(type: string, ms = 5000) {
      const until = Date.now() + ms;
      for (;;) {
        const found = [...seen].reverse().find((m) => m.type === type);
        if (found) return found;
        if (Date.now() > until) return null;
        await new Promise((r) => setTimeout(r, 50));
      }
    },
  };
}

test('a move made as somebody else is refused', async ({ baseURL }) => {
  test.setTimeout(60_000);
  const url = WS(baseURL!);

  const facilitator = client(url);
  await facilitator.open;
  facilitator.send({ type: 'create-room', caseId: 'blackwood-hall' });
  const created = await facilitator.wait('room-created');
  const roomCode = created?.roomCode ?? '';
  expect(roomCode).toBeTruthy();

  const phones = [];
  for (const name of ['Ana', 'Ben', 'Cat', 'Dev']) {
    const p = client(url);
    await p.open;
    p.send({ type: 'join', role: 'phone', roomCode, name });
    const joined = await p.wait('joined');
    phones.push({ ...p, id: joined?.playerId ?? '' });
  }
  facilitator.send({ type: 'facilitator', action: 'start' });
  await facilitator.wait('console-view');

  const [ana, ben] = phones;
  ana!.seen.length = 0;

  // Ana's socket, Ben's id. This is what the whisper list makes possible.
  ana!.send({
    type: 'move',
    move: { type: 'propose-theory', playerId: ben!.id, text: 'Not mine to say' },
  });
  const error = await ana!.wait('error');
  expect(error?.message, 'a move as another player was accepted').toContain('not your move');

  // And the theory never reached the board.
  const view = await ana!.wait('phone-view', 1000);
  expect((view?.theories ?? []).some((t) => t.text === 'Not mine to say')).toBe(false);

  // Ana can still act as Ana.
  ana!.seen.length = 0;
  ana!.send({
    type: 'move',
    move: { type: 'propose-theory', playerId: ana!.id, text: 'Mine to say' },
  });
  await expect
    .poll(
      async () => {
        const v = await ana!.wait('phone-view', 500);
        return (v?.theories ?? []).some((t) => t.text === 'Mine to say');
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  for (const p of [facilitator, ...phones]) p.close();
});
