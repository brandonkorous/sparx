// Builder collaboration — /ws/builder wire contract (docs/126 Phase 4).
//
// The realtime layer that turns the op log (Phase 2) into multi-editor. Persistence
// stays on the HTTP sync PUT; this socket is a RELAY + PRESENCE channel:
//   • when one author's ops persist, the PUT handler broadcasts them here, and every
//     other client editing the same site applies them via `applyRemoteOps`;
//   • presence tells each author who else is in the site, and which page they're on.
//
// The op payloads are opaque to the server (silicaui owns the vocabulary — see the
// Phase 2 envelope). The dashboard hook redeclares these shapes on its side; api-rest
// can't be imported by the frontend, so the contract is duplicated across the boundary
// the way the chat protocol and REST DTOs already are. Keep the two in sync.

/** One relayed op — validated at the envelope only, stored + forwarded verbatim. */
export interface RelayOp {
  target: { scope: 'page' | 'frame' | 'symbol' | 'site'; id?: string };
  kind: string;
  [k: string]: unknown;
}

/** One editor present in a site, as their peers see them. */
export interface BuilderPresence {
  socketId: string;
  userId: string;
  name: string;
  /** The page id they're currently looking at, for "Alice is on About". */
  activePage?: string;
}

export interface ServerToClientEvents {
  /** Another author's persisted ops. `batchId` lets the originator skip its own echo;
   *  `seq` is the log's new high-water mark, which the receiver `ackSeq`s after applying. */
  'ops:relay': (payload: { batchId: string; seq: number; ops: RelayOp[] }) => void;
  /** The full set of editors in the site right now — sent on join and on every change. */
  'presence:list': (editors: BuilderPresence[]) => void;
  error: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  /** Sent right after connect: "my document is at `baseSeq` — what did I miss?" The
   *  server replies through the ack with the ops after that sequence. */
  catchup: (baseSeq: number, ack: (payload: { seq: number; ops: RelayOp[] }) => void) => void;
  /** Update which page this editor is looking at (drives presence "where"). */
  'presence:active': (activePage: string | null) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface BuilderSocketData {
  tenantId: string;
  userId: string;
  name: string;
  propertyId: string;
  activePage?: string;
}

/** The room every editor of one site joins — keyed by property, matching the op log's
 *  per-property scope. */
export function propertyRoom(propertyId: string): string {
  return `builder:${propertyId}`;
}
