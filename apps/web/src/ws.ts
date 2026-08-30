/** Tiny reconnecting WebSocket client shared by all three surfaces. */
import { useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@tmv/server/src/protocol.js';

export type { ClientMessage, ServerMessage };
export type { ConsoleView, Music, PhoneView, ScreenView } from '@tmv/server/src/protocol.js';
/** Not a wire message — the shape the insights endpoint returns. */
export type { Insights } from '@tmv/core';

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

/**
 * @param hello called on EVERY (re)connect; return a message to re-establish
 *   this client's seat (join/room context), or null if there is nothing yet.
 *   Without this, a dropped socket reconnects into a void — the 2026-08-29
 *   production bug.
 */
export function useGameSocket(
  onMessage: (msg: ServerMessage) => void,
  hello?: () => ClientMessage | null,
): {
  send: (msg: ClientMessage) => void;
  connected: boolean;
} {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;
  const helloRef = useRef(hello);
  helloRef.current = hello;
  const queueRef = useRef<ClientMessage[]>([]);

  useEffect(() => {
    let alive = true;
    let retry = 0;
    const connect = () => {
      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;
      socket.onopen = () => {
        retry = 0;
        setConnected(true);
        const greeting = helloRef.current?.();
        if (greeting) socket.send(JSON.stringify(greeting));
        for (const msg of queueRef.current.splice(0)) socket.send(JSON.stringify(msg));
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        handlerRef.current(JSON.parse(event.data) as ServerMessage);
      };
      socket.onclose = () => {
        setConnected(false);
        if (alive) setTimeout(connect, Math.min(500 * 2 ** retry++, 8000));
      };
    };
    connect();
    return () => {
      alive = false;
      socketRef.current?.close();
    };
  }, []);

  return {
    connected,
    send: (msg) => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
      else queueRef.current.push(msg);
    },
  };
}

/** mm:ss countdown for an act. */
export function remaining(actStartedAt: number | undefined, minutes: number, now: number): string {
  if (!actStartedAt) return `${String(minutes)}:00`;
  const left = actStartedAt + minutes * 60_000 - now;
  const abs = Math.abs(left);
  const m = Math.floor(abs / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  return `${left < 0 ? '−' : ''}${String(m)}:${String(s).padStart(2, '0')}`;
}
