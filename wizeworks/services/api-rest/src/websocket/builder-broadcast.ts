// Builder collaboration — the relay seam between the HTTP write path and the socket
// (docs/126 Phase 4).
//
// The sync PUT (`/v1/builder/site`) persists ops, then calls this to fan them out to
// every other editor of the site. Structured exactly like the chat broadcaster: a
// module-level singleton the socket bootstrap sets, and the REST route calls — so the
// route never imports socket.io and `createApp()` (tests) leaves it null, keeping REST
// self-contained and offline-safe.

import type { RelayOp } from './builder-protocol.js';

export interface BuilderBroadcaster {
  /** Relay one batch of just-persisted ops to the site's editors. The originator is in
   *  the room too and receives its own echo — it suppresses it by `batchId`, which is
   *  cheaper and more robust than teaching the HTTP path a socket identity. */
  opsAppended(propertyId: string, payload: { batchId: string; seq: number; ops: RelayOp[] }): void;
}

let active: BuilderBroadcaster | null = null;

export function setBuilderBroadcaster(b: BuilderBroadcaster | null): void {
  active = b;
}

/** The live broadcaster, or null when no socket server is attached (tests, or a
 *  REST-only process). Callers no-op on null — the write still succeeded; only the
 *  live relay is absent, and the next load/catchup reconciles. */
export function getBuilderBroadcaster(): BuilderBroadcaster | null {
  return active;
}
