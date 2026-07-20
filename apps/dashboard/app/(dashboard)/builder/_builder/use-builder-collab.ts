'use client';

// Builder collaboration client (docs/126 Phase 4) — the browser half of /ws/builder.
//
// Persistence still rides the HTTP sync PUT (Phase 2); this socket is a RELAY + PRESENCE
// channel. It does NOT send edits: when THIS author saves, the server broadcasts the
// persisted ops, and this hook receives OTHER authors' ops and applies them straight into
// the live engine via `applyRemoteOps`. So the flow is one durable path (the PUT) plus a
// fan-out — never two writers of the same truth.
//
// Three responsibilities:
//   • apply remote ops — skip our own echo (matched by batchId), otherwise apply + ackSeq;
//   • presence — expose who else is editing, so the toolbar can show them;
//   • catch-up — on (re)connect, ask "I'm at seq N, what did I miss?" and apply the gap,
//     which closes the window between the HTTP load and the socket joining the room.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { BuilderHandle, Op } from '@wizeworks/silicaui-builder/react';

/** One co-editor, mirrored from the server's `BuilderPresence`. */
export interface CollabPeer {
  socketId: string;
  userId: string;
  name: string;
  activePage?: string;
}

interface RelayPayload {
  batchId: string;
  seq: number;
  ops: Op[];
}

interface ServerToClient {
  'ops:relay': (payload: RelayPayload) => void;
  'presence:list': (editors: CollabPeer[]) => void;
  error: (payload: { message: string }) => void;
}
interface ClientToServer {
  catchup: (baseSeq: number, ack: (payload: { seq: number; ops: Op[] }) => void) => void;
  'presence:active': (activePage: string | null) => void;
}
type CollabSocket = Socket<ServerToClient, ClientToServer>;

/** A bounded record of the batchIds THIS client originated, for echo suppression. Bounded
 *  because an own-echo returns within milliseconds of the save, so only recent ids can
 *  ever match — an unbounded set would leak on every edit for the session's life. */
export interface SentBatches {
  has(id: string): boolean;
  add(id: string): void;
}

export function createSentBatches(limit = 200): SentBatches {
  const set = new Set<string>();
  const order: string[] = [];
  return {
    has: (id) => set.has(id),
    add: (id) => {
      if (set.has(id)) return;
      set.add(id);
      order.push(id);
      if (order.length > limit) {
        const evicted = order.shift();
        if (evicted !== undefined) set.delete(evicted);
      }
    },
  };
}

export interface UseBuilderCollabArgs {
  /** The site being edited; null disables collaboration (single-site local editing). */
  propertyId: string | null | undefined;
  /** The live engine handle — `applyRemoteOps` for peers' edits, `ackSeq` to keep our
   *  sequence aligned with the server. */
  builderRef: RefObject<BuilderHandle | null>;
  /** batchIds we've sent, so we can drop our own relayed echo. */
  sentBatches: SentBatches;
  /** The sequence our document is currently at. The studio seeds it from the load and
   *  advances it on every successful save; the hook advances it on every applied relay.
   *  Read at connect time to request the right catch-up window. */
  lastSeqRef: RefObject<number>;
}

export interface UseBuilderCollabResult {
  peers: CollabPeer[];
  connected: boolean;
  /** Tell peers which page this author is looking at (presence "where"). */
  setActivePage: (pageId: string | null) => void;
}

export function useBuilderCollab({
  propertyId,
  builderRef,
  sentBatches,
  lastSeqRef,
}: UseBuilderCollabArgs): UseBuilderCollabResult {
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<CollabSocket | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    async function connect(): Promise<void> {
      let token: string;
      let apiUrl: string;
      try {
        const res = await fetch('/api/builder/ws-token', { cache: 'no-store' });
        if (!res.ok) return;
        ({ token, apiUrl } = (await res.json()) as { token: string; apiUrl: string });
      } catch {
        // The editor works fine solo without the socket — saves still persist over HTTP.
        return;
      }
      if (cancelled || !apiUrl) return;

      const s: CollabSocket = io(apiUrl, {
        path: '/ws/builder',
        transports: ['websocket'],
        auth: { token, propertyId },
      });
      socketRef.current = s;

      s.on('connect', () => {
        setConnected(true);
        // Catch up on anything that landed between our HTTP load and this join.
        s.emit('catchup', lastSeqRef.current, ({ seq, ops }) => {
          if (ops.length > 0) {
            builderRef.current?.applyRemoteOps(ops);
            builderRef.current?.ackSeq(seq);
            lastSeqRef.current = Math.max(lastSeqRef.current, seq);
          }
        });
      });
      s.on('disconnect', () => setConnected(false));

      s.on('ops:relay', ({ batchId, seq, ops }) => {
        // Our own save, echoed back to the room. We already have these ops locally —
        // re-applying a `node.insert` would duplicate it, so this suppression is load-
        // bearing, not just an optimization.
        if (sentBatches.has(batchId)) return;
        builderRef.current?.applyRemoteOps(ops);
        builderRef.current?.ackSeq(seq);
        lastSeqRef.current = Math.max(lastSeqRef.current, seq);
      });

      s.on('presence:list', (list) => {
        if (!cancelled) setPeers(list);
      });
    }

    void connect();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      setPeers([]);
    };
    // Reconnect from scratch when the site changes — a different room, a different token
    // scope. builderRef / sentBatches / lastSeqRef are stable refs, deliberately excluded.
  }, [propertyId]);

  // Stable so the studio can hand it to a memoized `onActivePageChange` without
  // recreating that callback (and thus the memoized host) on every render.
  const setActivePage = useCallback((pageId: string | null) => {
    socketRef.current?.emit('presence:active', pageId);
  }, []);

  return { peers, connected, setActivePage };
}
