// Builder collaboration — /ws/builder server bootstrap (docs/126 Phase 4).
//
// A second socket.io server on the same Fastify HTTP server as chat, at its own path.
// Same shape as `attachChatWebsocket`: Redis adapter when REDIS_URL is set (fan-out
// across api-rest replicas), in-memory otherwise; a broadcaster the REST write path
// calls after ops persist. Only the index.ts bootstrap calls this, so createApp()
// (tests) never loads socket.io and the broadcaster stays null.

import type { Server as HttpServer } from 'node:http';
import type { FastifyBaseLogger } from 'fastify';
import { Server } from 'socket.io';

import { env } from '../env.js';
import { setBuilderBroadcaster, type BuilderBroadcaster } from './builder-broadcast.js';
import { registerBuilderHandlers } from './builder-namespace.js';
import {
  propertyRoom,
  type BuilderSocketData,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
} from './builder-protocol.js';

export interface BuilderWebsocketHandle {
  close(): Promise<void>;
}

export async function attachBuilderWebsocket(
  httpServer: HttpServer,
  log: FastifyBaseLogger
): Promise<BuilderWebsocketHandle> {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    BuilderSocketData
  >(httpServer, {
    path: '/ws/builder',
    // The editor runs on the dashboard origin; a staff JWT gates every socket, so
    // reflecting the origin is safe.
    cors: { origin: true, credentials: true },
    serveClient: false,
  });

  let closeRedis: (() => Promise<void>) | null = null;
  if (env.REDIS_URL) {
    const [{ createAdapter }, { Redis }] = await Promise.all([
      import('@socket.io/redis-adapter'),
      import('ioredis'),
    ]);
    const pubClient = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => log.error({ err }, 'builder redis pub error'));
    subClient.on('error', (err) => log.error({ err }, 'builder redis sub error'));
    io.adapter(createAdapter(pubClient, subClient));
    closeRedis = async () => {
      pubClient.disconnect();
      subClient.disconnect();
      await Promise.resolve();
    };
    log.info('builder websocket: redis adapter enabled');
  } else {
    log.info('builder websocket: in-memory adapter (single instance)');
  }

  // The relay: after the sync PUT persists ops, it calls this. Emitting to the whole
  // room (originator included) is deliberate — the sender suppresses its own echo by
  // batchId, which keeps the HTTP path free of any socket identity.
  const broadcaster: BuilderBroadcaster = {
    opsAppended(propertyId, payload) {
      io.to(propertyRoom(propertyId)).emit('ops:relay', payload);
    },
  };

  setBuilderBroadcaster(broadcaster);
  registerBuilderHandlers(io, log);

  return {
    async close() {
      setBuilderBroadcaster(null);
      await io.close();
      if (closeRedis) await closeRedis();
    },
  };
}
