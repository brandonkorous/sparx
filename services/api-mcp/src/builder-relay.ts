// Relay an agent's builder write to open editors (docs/126 §4.5).
//
// A silica write tool persists to the draft in THIS process (api-mcp), but the live
// editor sockets live in api-rest. This bridges the two the cheap way: api-rest's
// `/ws/builder` server runs the socket.io Redis adapter, so any process pointed at the
// same Redis can emit into a site's room via `@socket.io/redis-emitter`, and api-rest
// fans it out to the connected operators. No new infrastructure — it reuses the cluster
// Redis the socket adapter already depends on.
//
// Two things get emitted per write:
//   • `ops:relay` — the synthesized op batch (page.create / page.delete / theme.set…),
//     so a co-editor folds it in through the EXACT same `applyRemoteOps` path a human
//     edit takes. There is no agent-specific apply path on the client.
//   • `builder:agentActivity` — a transient "an assistant is editing" signal plus the
//     reload hints for changes with no live-appliable op (a body or frame REPLACE).
//
// The wire contract (event names, room naming, adapter key) is DUPLICATED from api-rest
// here on purpose: services never import each other, the same way the socket client
// redeclares the protocol. Keep in sync with services/api-rest/src/websocket/
// builder-protocol.ts (`propertyRoom`) and builder-index.ts (`BUILDER_ADAPTER_KEY`).

import { Emitter } from '@socket.io/redis-emitter';
import { Redis } from 'ioredis';

import { env } from './env.js';
import type { BuilderRelaySideChannel } from '@sparx/builder/mcp';

/** MUST match `BUILDER_ADAPTER_KEY` in api-rest's builder-index.ts, or the emit lands on
 *  a channel the builder server isn't listening to. */
const BUILDER_ADAPTER_KEY = 'sio-builder';

/** MUST match `propertyRoom` in api-rest's builder-protocol.ts. */
function builderRoom(propertyId: string): string {
  return `builder:${propertyId}`;
}

/** The label a co-editor sees for the agent. Deliberately generic + reassuring for a
 *  non-technical operator — "an assistant", not a tool name or key id. */
const AGENT_ACTOR = { name: 'An AI assistant' } as const;

let emitter: Emitter | null = null;
let redis: Redis | null = null;

/** The shared emitter, or null when no Redis is configured (dev, or a single-process
 *  deploy) — callers no-op, and the write still persisted; only the LIVE relay is
 *  absent, and a co-editor picks the change up on their next load. */
function getEmitter(): Emitter | null {
  if (!env.REDIS_URL) return null;
  if (!emitter) {
    redis = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null });
    redis.on('error', (err) => console.error('[api-mcp] builder relay redis error', err));
    emitter = new Emitter(redis, { key: BUILDER_ADAPTER_KEY });
  }
  return emitter;
}

/**
 * Relay one scripted write to the site's editor room. Fire-and-forget and fully
 * defensive: a relay failure must never fail the tool call that triggered it — the
 * agent's write already succeeded; only the live echo is best-effort.
 */
export function relayAgentWrite(side: BuilderRelaySideChannel): void {
  const em = getEmitter();
  if (!em) return;
  try {
    const room = em.to(builderRoom(side.propertyId));
    // Structural change (new page, deletion, theme) → relay the ops so co-editors apply
    // them live. Suppression by `batchId` is a client concern; no client originated this
    // batch, so every editor applies it.
    if (side.relay && side.relay.ops.length > 0) {
      room.emit('ops:relay', side.relay);
    }
    // Always announce the agent's presence + any reload hints (a body/frame REPLACE has
    // no op above, so this is the only signal a co-editor gets for it).
    room.emit('builder:agentActivity', { actor: AGENT_ACTOR, reloadHints: side.reloadHints });
  } catch (err) {
    console.error('[api-mcp] builder relay emit failed', err);
  }
}

/** Tear the relay connection down on shutdown (mirrors the socket bootstraps). */
export async function closeBuilderRelay(): Promise<void> {
  if (redis) {
    redis.disconnect();
    redis = null;
    emitter = null;
  }
  await Promise.resolve();
}
