/**
 * The Missing View — game server.
 * HTTP serves the built web client; WS carries the game (D19/D20).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { blackwoodHall, IllegalMove, validateCase } from '@tmv/core';
import { Room, type Client } from './room.js';
import type { ClientMessage, ServerMessage } from './protocol.js';
import { dbConfigured, initDb, saveFinishedGame } from './persist.js';
import { llmConfigured } from './llm.js';

const PORT = Number(process.env.PORT ?? 3001);
const here = fileURLToPath(new URL('.', import.meta.url));
const WEB_DIST = process.env.WEB_DIST ?? join(here, '../../web/dist');

// Published cases only (D14); refuse to boot with an invalid case.
const cases = new Map([[blackwoodHall.id, blackwoodHall]]);
for (const pack of cases.values()) {
  const issues = validateCase(pack);
  if (issues.length) {
    console.error(`case ${pack.id} fails validation:`, issues);
    process.exit(1);
  }
}

const rooms = new Map<string, Room>();

/**
 * Bots act every 25s by default, which is a human pace at the table but far too
 * slow to watch during a playtest. Override to speed them up.
 */
const BOT_TICK_MS = Number(process.env.TMV_BOT_TICK_MS ?? 25_000);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
};

const server = createServer((req, res) => {
  void (async () => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          rooms: rooms.size,
          // Both degrade silently by design (D15), so report them: a game on
          // banked answers and no persistence looks exactly like a healthy one.
          llm: llmConfigured(),
          db: dbConfigured(),
        }),
      );
      return;
    }
    // A suspect's reply, spoken. Held in memory by the room that made it, so it
    // dies with the game and never reaches disk.
    const voice = /^\/voice\/([0-9A-F]{6})\/([\w-]+)\.mp3$/.exec(req.url ?? '');
    if (voice) {
      const [, roomCode = '', questionId = ''] = voice;
      const audio = rooms.get(roomCode)?.voice(questionId);
      if (!audio) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        'content-type': 'audio/mpeg',
        'content-length': audio.length,
        'cache-control': 'no-store',
      });
      res.end(audio);
      return;
    }

    // Test-only: simulate a proxy severing every WebSocket (Render does this to idle ones).
    if (process.env.TMV_TEST && req.method === 'POST' && req.url === '/test/drop-connections') {
      for (const socket of wss.clients) socket.terminate();
      res.writeHead(200);
      res.end('dropped');
      return;
    }
    // Static SPA serving with an index.html fallback for client routes.
    const path = normalize(req.url?.split('?')[0] ?? '/').replace(/^(\.\.[/\\])+/, '');
    const candidates = [
      join(WEB_DIST, path === '/' ? 'index.html' : path),
      join(WEB_DIST, 'index.html'),
    ];
    for (const file of candidates) {
      try {
        if (!(await stat(file)).isFile()) continue;
        res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
        res.end(await readFile(file));
        return;
      } catch {
        /* try next */
      }
    }
    res.writeHead(404);
    res.end('not found');
  })();
});

const wss = new WebSocketServer({ server, path: '/ws' });

// Heartbeat: keeps proxies (Render's included) from closing idle sockets,
// and reaps connections that died without a close frame.
const alive = new WeakSet<WebSocket>();
setInterval(() => {
  for (const socket of wss.clients) {
    if (!alive.has(socket)) {
      socket.terminate();
      continue;
    }
    alive.delete(socket);
    socket.ping();
  }
}, 30_000);

wss.on('connection', (socket: WebSocket) => {
  alive.add(socket);
  socket.on('pong', () => alive.add(socket));
  let room: Room | null = null;
  let client: Client | null = null;

  const send = (msg: ServerMessage) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
  };

  socket.on('message', (raw: Buffer) => {
    void (async () => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        send({ type: 'error', message: 'malformed message' });
        return;
      }
      try {
        switch (msg.type) {
          case 'create-room': {
            const pack = cases.get(msg.caseId);
            if (!pack) throw new IllegalMove(`unknown case ${msg.caseId}`);
            room = new Room(pack, { tickMs: BOT_TICK_MS });
            rooms.set(room.code, room);
            client = { role: 'console', send };
            room.addClient(client);
            send({ type: 'room-created', roomCode: room.code });
            room.pushViews();
            return;
          }
          case 'join': {
            const target = rooms.get(msg.roomCode.toUpperCase());
            if (!target) throw new IllegalMove('no such room');
            room = target;
            if (msg.role === 'phone') {
              const playerId = room.joinPlayer(msg.name, msg.playerId);
              client = { role: 'phone', playerId, send };
              send({ type: 'joined', playerId, roomCode: room.code });
            } else {
              client = { role: msg.role, send };
            }
            room.addClient(client);
            return;
          }
          case 'move': {
            if (!room) throw new IllegalMove('join a room first');
            await room.handleMove(msg.move);
            return;
          }
          case 'facilitator': {
            if (!room || client?.role !== 'console') throw new IllegalMove('facilitator only');
            await room.facilitate(msg.action);
            if (msg.action === 'trigger-reveal' || msg.action === 'next-act') {
              const snap = room.snapshot();
              if (snap.state?.phase === 'reveal') {
                await saveFinishedGame(room.code, snap.caseId, snap.state, room.emailOptIns);
              }
            }
            return;
          }
          case 'add-bot': {
            if (!room || client?.role !== 'console') throw new IllegalMove('facilitator only');
            room.addBot();
            room.pushViews();
            return;
          }
          case 'email-optin': {
            if (!room || !client?.playerId) throw new IllegalMove('players only');
            room.recordEmail(client.playerId, msg.email);
            return;
          }
        }
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof IllegalMove ? err.message : 'something went wrong',
        });
        if (!(err instanceof IllegalMove)) console.error(err);
      }
    })();
  });

  socket.on('close', () => {
    if (room && client) room.removeClient(client);
  });
});

await initDb();
server.listen(PORT, () => {
  console.log(
    `The Missing View server on :${String(PORT)} (cases: ${[...cases.keys()].join(', ')})`,
  );
  console.log(`  llm: ${llmConfigured() ? 'live' : 'banked answers (OPENAI_API_KEY unset)'}`);
  console.log(`  db: ${dbConfigured() ? 'postgres' : 'in-memory (DATABASE_URL unset)'}`);
});
