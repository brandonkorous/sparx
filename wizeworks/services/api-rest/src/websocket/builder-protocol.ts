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

/** One editor present in a site, as their peers see them.
 *
 *  `selection` and `claim` are the two halves of silicaui's `Peer` (docs/silicaui/01 §16),
 *  carried here so the engine can DRAW one and HONOR the other. They are deliberately
 *  separate facts: everything selected is drawn, only what is being EDITED is claimed. */
export interface BuilderPresence {
  socketId: string;
  userId: string;
  name: string;
  /** The page id they're currently looking at, for "Alice is on About". */
  activePage?: string;
  /** Node ids this editor has selected. Every other client draws a named ring on them —
   *  never enforced, because a selection is where someone is LOOKING and blocking edits
   *  on that would make clicking around the canvas a way to lock colleagues out. */
  selection?: string[];
  /** Node ids this editor is actively EDITING, each covering that node and its whole
   *  subtree. Enforced by the receiving engine (the subtree greys and refuses local
   *  mutation) and self-expiring: the holder re-states it while typing and clears it
   *  when they stop, so a claim can never outlive the work it protects. */
  claim?: string[];
}

export interface ServerToClientEvents {
  /** Another author's persisted ops. `batchId` lets the originator skip its own echo;
   *  `seq` is the log's new high-water mark, which the receiver `ackSeq`s after applying.
   *  An AGENT'S write arrives here too (docs/126 §4.5) — a scripted write in api-mcp
   *  synthesizes the same ops and emits them into this room over the Redis backplane, so
   *  a human co-editor folds an agent's page in through the identical `applyRemoteOps`
   *  path, with no client code that knows or cares the author was an agent. */
  'ops:relay': (payload: { batchId: string; seq: number; ops: RelayOp[] }) => void;
  /** The full set of editors in the site right now — sent on join and on every change. */
  'presence:list': (editors: BuilderPresence[]) => void;
  /** An AGENT is authoring this site right now (docs/126 §4.5). Distinct from
   *  `presence:list` because an agent holds no socket — it is a transient signal the
   *  client shows as an "⚡ an assistant is editing" indicator (with its own client-side
   *  fade), plus `reloadHints`: pages — or the `'frame'` sentinel — the agent REPLACED
   *  with no live-appliable op, which the client offers to reload rather than force over
   *  the operator's in-progress edits. */
  'builder:agentActivity': (payload: { actor: { name: string }; reloadHints: string[] }) => void;
  error: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  /** Sent right after connect: "my document is at `baseSeq` — what did I miss?" The
   *  server replies through the ack with the ops after that sequence. */
  catchup: (baseSeq: number, ack: (payload: { seq: number; ops: RelayOp[] }) => void) => void;
  /** Update which page this editor is looking at (drives presence "where"). */
  'presence:active': (activePage: string | null) => void;
  /** Which nodes this editor has selected, so everyone else can draw a ring on them.
   *  Sent on a trailing throttle rather than per click — selection changes at the speed
   *  of a mouse, and each one costs a roster gather. */
  'presence:selection': (nodeIds: string[]) => void;
  /** Which subtrees this editor is holding while they edit. Sent only when the SET
   *  changes — not per keystroke — and cleared when editing stops. An empty array is a
   *  real message meaning "I have let go", never an absence. */
  'presence:claim': (nodeIds: string[]) => void;
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
  selection?: string[];
  claim?: string[];
}

/** The most nodes one editor may claim to have selected or be holding.
 *
 *  A BOUND, not a feature. These arrays are relayed verbatim to every other client in
 *  the room and held on the socket for the life of the connection, so an unbounded one
 *  is a client-supplied array this server stores and re-broadcasts — the shape of thing
 *  that turns one misbehaving tab into everyone else's problem. Multi-select in the
 *  editor is a handful of nodes; 64 is far above any real selection and far below
 *  anything that costs a room a frame. */
const MAX_PRESENCE_NODES = 64;

/** A client-supplied node-id list, made safe to store and re-broadcast.
 *
 *  Socket.io payloads are whatever the sender wrote — a typed `ClientToServerEvents`
 *  describes the CONTRACT, never what actually arrived — so this validates rather than
 *  casts. Non-strings are dropped instead of rejecting the whole list: a client one
 *  version ahead sending a richer entry should lose that entry, not its whole selection. */
export function sanitizeNodeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const value of input) {
    if (typeof value !== 'string' || value === '') continue;
    out.push(value);
    if (out.length === MAX_PRESENCE_NODES) break;
  }
  return out;
}

/** The room every editor of one site joins — keyed by property, matching the op log's
 *  per-property scope. */
export function propertyRoom(propertyId: string): string {
  return `builder:${propertyId}`;
}
