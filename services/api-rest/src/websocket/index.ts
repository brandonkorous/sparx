// Live Chat — WebSocket server bootstrap (docs/56, docs/69 A-2).
//
// Attaches a socket.io server at path `/ws/chat` to the Fastify HTTP server.
// When REDIS_URL is set the socket.io Redis adapter fans broadcasts out across
// every api-rest replica (the k8s/redis StatefulSet is the backplane); unset,
// the default in-memory adapter is correct for a single process (dev).
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

  let closeRedis: (() => Promise<void>) | null = null;
  if (env.REDIS_URL) {
    // Lazy-import so the Redis adapter is only pulled in when configured.
    const [{ createAdapter }, { Redis }] = await Promise.all([
      import('@socket.io/redis-adapter'),
      import('ioredis'),
    ]);
    const pubClient = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => log.error({ err }, 'chat redis pub error'));
    subClient.on('error', (err) => log.error({ err }, 'chat redis sub error'));
    io.adapter(createAdapter(pubClient, subClient));
    closeRedis = async () => {
      pubClient.disconnect();
      subClient.disconnect();
      await Promise.resolve();
    };
    log.info('chat websocket: redis adapter enabled');
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
      if (closeRedis) await closeRedis();
    },
  };
}
