// Builder collaboration — /ws/builder server bootstrap (docs/126 Phase 4).
//
// A second socket.io server on the same Fastify HTTP server as chat, at its own path.
// Same shape as `attachChatWebsocket`: the NATS socket bus when SOCKET_BUS_URL is set
// (fan-out across api-rest replicas), in-memory otherwise; a broadcaster the REST write path
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

/** The socket bus key that scopes this server's cross-process channel (docs/126 §4.5).
 *  Distinct from chat's key so the two never share a channel — and, crucially, so
 *  api-mcp's socket bus emitter can target THIS server's rooms precisely when it relays
 *  an agent's write. Any process emitting into `/ws/builder` rooms MUST construct its
 *  emitter with this exact key. */
export const BUILDER_ADAPTER_KEY = 'sio-builder';

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

  let closeBus: (() => Promise<void>) | null = null;
  if (env.SOCKET_BUS_URL) {
    const { connectSocketBus, createSocketBusAdapter } = await import('@wizeworks/socket-bus');
    const onError = (err: unknown, what: string) =>
      log.error({ err }, `builder socket bus ${what} error`);
    const bus = connectSocketBus(env.SOCKET_BUS_URL, 'api-rest builder', onError);
    // Distinct key (see BUILDER_ADAPTER_KEY) so this channel is the builder server's
    // alone — chat never processes builder messages, and api-mcp's emitter targets it.
    io.adapter(createSocketBusAdapter(bus, { key: BUILDER_ADAPTER_KEY, onError }));
    closeBus = () => bus.close();
    log.info('builder websocket: socket bus adapter enabled');
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
      if (closeBus) await closeBus();
    },
  };
}
