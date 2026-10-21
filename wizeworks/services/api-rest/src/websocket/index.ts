// Live Chat — WebSocket server bootstrap (docs/56, docs/69 A-2).
//
// Attaches a socket.io server at path `/ws/chat` to the Fastify HTTP server.
// When SOCKET_BUS_URL is set, broadcasts fan out across every api-rest replica
// over NATS (@wizeworks/socket-bus); unset, the default in-memory adapter is
// correct for a single process (dev).
//
// Only the index.ts bootstrap calls this — createApp() (used by tests) never
// loads socket.io, so the broadcaster stays null and REST stays self-contained.

import type { Server as HttpServer } from 'node:http';
import type { FastifyBaseLogger } from 'fastify';
import { Server } from 'socket.io';

import { env } from '../env.js';
import { setChatBroadcaster, type ChatBroadcaster } from '../lib/chat/broadcaster.js';
import { registerChatHandlers } from './chat-namespace.js';
import {
  conversationRoom,
  tenantRoom,
  type ChatSocketData,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
} from './chat-protocol.js';

/** Scopes chat's traffic on the socket bus, apart from the builder's. */
const CHAT_BUS_KEY = 'sio-chat';

export interface ChatWebsocketHandle {
  close(): Promise<void>;
}

export async function attachChatWebsocket(
  httpServer: HttpServer,
  log: FastifyBaseLogger
): Promise<ChatWebsocketHandle> {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    ChatSocketData
  >(httpServer, {
    path: '/ws/chat',
    // Auth is enforced per-socket on the handshake (JWT / visitor token), so
    // reflecting the origin is safe — the widget connects from arbitrary tenant
    // storefront domains.
    cors: { origin: true, credentials: true },
    serveClient: false,
  });

  let closeBus: (() => Promise<void>) | null = null;
  if (env.SOCKET_BUS_URL) {
    // Lazy-import so the NATS client is only pulled in when configured.
    const { connectSocketBus, createSocketBusAdapter } = await import('@wizeworks/socket-bus');
    const onError = (err: unknown, what: string) =>
      log.error({ err }, `chat socket bus ${what} error`);
    const bus = connectSocketBus(env.SOCKET_BUS_URL, 'api-rest chat', onError);
    io.adapter(createSocketBusAdapter(bus, { key: CHAT_BUS_KEY, onError }));
    closeBus = () => bus.close();
    log.info('chat websocket: socket bus adapter enabled');
  } else {
    log.info('chat websocket: in-memory adapter (single instance)');
  }

  // The broadcaster routes call after a REST write. Emits to the union of the
  // conversation room (open thread) + tenant room (staff inbox) so socket.io
  // delivers exactly once to a staff socket that is in both.
  const broadcaster: ChatBroadcaster = {
    messageCreated(tenantId, conversationId, message) {
      io.to(conversationRoom(conversationId)).to(tenantRoom(tenantId)).emit('message:new', message);
    },
    conversationUpdated(tenantId, conversation) {
      io.to(conversationRoom(conversation.id))
        .to(tenantRoom(tenantId))
        .emit('conversation:updated', conversation);
    },
  };

  setChatBroadcaster(broadcaster);
  registerChatHandlers(io, broadcaster, log);

  return {
    async close() {
      setChatBroadcaster(null);
      await io.close();
      if (closeBus) await closeBus();
    },
  };
}
