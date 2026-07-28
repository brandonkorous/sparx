'use client';

// Live co-editing for the studio (docs/126 §4.5).
//
// Rendered INSIDE `<Builder>` (via `toolbarSlot`), so `useEditor()` resolves to the live
// engine handle. It connects the site's `/ws/builder` room and folds every other author's
// change into this canvas as it lands — a human co-editor's ops (Slice 4) AND an agent's
// MCP write, which api-mcp relays as the identical `ops:relay` (docs/126 §4.5). There is
// no agent-specific path here: a relayed `page.create` is applied by `applyRemoteOps` the
// same way whoever authored it.
//
// What it shows the operator: who else is in the site, an "an assistant is editing"
// pulse while an agent is active, and — for the one change with no live-appliable op (an
// agent REPLACING an existing page body or the frame) — a Reload affordance, because
// force-applying that would overwrite the operator's own in-progress edits.
//
// The wire contract is DUPLICATED from api-rest (services never import each other, like
// the chat client). Keep in sync with services/api-rest/src/websocket/builder-protocol.ts.

import { useEditor } from '@wizeworks/silicaui-builder/react';
import type { Op } from '@wizeworks/silicaui-builder/react';
import type { Site } from '@wizeworks/silicaui-html';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { RefreshCw, Sparkles, Users } from 'lucide-react';
import { getTokenState, peekToken } from '../../../lib/api/token';
import { getSiteSeq } from './data';

// ── Wire contract (client half) — keep in sync with builder-protocol.ts ───────
interface RelayOp {
  target: { scope: string; id?: string };
  kind: string;
  [k: string]: unknown;
}
interface BuilderPresence {
  socketId: string;
  userId: string;
  name: string;
  activePage?: string;
}
interface ServerToClientEvents {
  'ops:relay': (payload: { batchId: string; seq: number; ops: RelayOp[] }) => void;
  'presence:list': (editors: BuilderPresence[]) => void;
  'builder:agentActivity': (payload: { actor: { name: string }; reloadHints: string[] }) => void;
  error: (payload: { message: string }) => void;
}
interface ClientToServerEvents {
  catchup: (baseSeq: number, ack: (payload: { seq: number; ops: RelayOp[] }) => void) => void;
  'presence:active': (activePage: string | null) => void;
}
type BuilderSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** How long the "an assistant is editing" pulse lingers after the last agent write. */
const AGENT_FADE_MS = 8000;

interface Props {
  propertyId: string;
  /** The save-baseline the floor fix (docs/126 §4.4) computes deletions against. A relayed
   *  page.create means the server now has that page and so do we, so it joins the baseline
   *  — and a later LOCAL delete of it is then expressed as a real `deletedPageIds` entry;
   *  a relayed page.delete leaves it. Without this, an operator deleting an agent's
   *  folded-in page would fail to persist that deletion. */
  baselineIdsRef: MutableRefObject<Set<string>>;
  /** Reload the editor (refetch + remount) — the faithful response to a body/frame REPLACE,
   *  which has no live-appliable op. The operator chooses when (it discards local edits). */
  onReload: () => void;
  /** Batch ids THIS client authored (Slice 4), so it skips the echo of its own ops. */
  ownBatchesRef: MutableRefObject<Set<string>>;
  /** Another author's edit landed on this canvas. It deliberately never reaches
   *  `<Builder onChange>` (a remote op must not echo back to its sender), so the
   *  studio is told here — its undo history computes each inverse against the
   *  document as it stood a moment earlier, and that snapshot has just moved. */
  onRemoteApplied: (site: Site) => void;
}

export function BuilderLiveSync({
  propertyId,
  baselineIdsRef,
  onReload,
  ownBatchesRef,
  onRemoteApplied,
}: Props) {
  const editor = useEditor();
  const [presence, setPresence] = useState<BuilderPresence[]>([]);
  const [reloadHints, setReloadHints] = useState<string[]>([]);
  const [agentAt, setAgentAt] = useState(0);
  const [, forceTick] = useState(0);
  const lastSeqRef = useRef(0);
  const socketRef = useRef<BuilderSocket | null>(null);
  const onRemoteAppliedRef = useRef(onRemoteApplied);
  onRemoteAppliedRef.current = onRemoteApplied;

  // Apply a relayed batch to the live document and advance our sequence, keeping the
  // save-baseline in step. Held in a ref so the socket handlers (bound once on connect)
  // always call the current closure over `editor` + the baseline ref.
  const applyRelayed = (ops: RelayOp[], seq: number): void => {
    if (ops.length) {
      editor.applyRemoteOps(ops as unknown as Op[]);
      onRemoteAppliedRef.current(editor.extractSite());
      for (const op of ops) {
        if (op.kind === 'page.create') {
          const id = (op.page as { id?: string } | undefined)?.id;
          if (id) baselineIdsRef.current.add(id);
        } else if (op.kind === 'page.delete') {
          const id = (op as { pageId?: string }).pageId;
          if (id) baselineIdsRef.current.delete(id);
        }
      }
    }
    editor.ackSeq(seq);
    lastSeqRef.current = seq;
  };
  const applyRef = useRef(applyRelayed);
  applyRef.current = applyRelayed;

  useEffect(() => {
    let disposed = false;
    let socket: BuilderSocket | null = null;
    void (async () => {
      const state = await getTokenState();
      // Where the loaded snapshot stands, so catch-up returns only what we missed since.
      lastSeqRef.current = await getSiteSeq();
      if (disposed) return;
      socket = io(state.apiUrl, {
        path: '/ws/builder',
        transports: ['websocket'],
        // Called on every (re)connect — hand the freshest token so a reconnect after the
        // JWT rotated never authenticates with a dead one.
        auth: (cb) => cb({ token: peekToken() ?? state.token, propertyId }),
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket?.emit('catchup', lastSeqRef.current, ({ seq, ops }) => applyRef.current(ops, seq));
        try {
          socket?.emit('presence:active', editor.activePage);
        } catch {
          // No active page yet — presence "where" is best-effort.
        }
      });
      socket.on('ops:relay', ({ batchId, seq, ops }) => {
        // Skip our own echo (Slice 4) — we already have these ops locally; just advance.
        if (ownBatchesRef.current.has(batchId)) {
          editor.ackSeq(seq);
          lastSeqRef.current = seq;
          return;
        }
        applyRef.current(ops, seq);
      });
      socket.on('presence:list', setPresence);
      socket.on('builder:agentActivity', ({ reloadHints: hints }) => {
        setAgentAt(Date.now());
        if (hints.length) setReloadHints((prev) => Array.from(new Set([...prev, ...hints])));
      });
      socket.on('error', () => {
        // The write persisted regardless; the next load/catch-up reconciles.
      });
    })();
    return () => {
      disposed = true;
      socket?.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Re-render once to hide the pulse after the last agent write falls out of the window.
  useEffect(() => {
    if (!agentAt) return;
    const t = setTimeout(() => forceTick((x) => x + 1), AGENT_FADE_MS);
    return () => clearTimeout(t);
  }, [agentAt]);
  const agentActive = agentAt > 0 && Date.now() - agentAt < AGENT_FADE_MS;

  const others = presence.filter((p) => p.socketId !== socketRef.current?.id);
  const frameOnly = reloadHints.length === 1 && reloadHints[0] === 'frame';

  return (
    <div className="flex items-center gap-2">
      {others.length > 0 ? (
        <span title={others.map((p) => p.name).join(', ')}>
          <Badge color="neutral" variant="soft" size="sm">
            <Users className="size-3.5" aria-hidden /> {others.length} editing
          </Badge>
        </span>
      ) : null}
      {agentActive ? (
        <Badge color="module" variant="soft" size="sm">
          <Sparkles className="size-3.5" aria-hidden /> An assistant is editing
        </Badge>
      ) : null}
      {reloadHints.length > 0 ? (
        <Button
          size="sm"
          variant="soft"
          color="warning"
          onClick={() => {
            setReloadHints([]);
            onReload();
          }}
        >
          <RefreshCw className="size-4" aria-hidden />
          Reload to see {frameOnly ? 'the header/footer' : 'the update'}
        </Button>
      ) : null}
    </div>
  );
}
