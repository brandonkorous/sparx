'use client';

// Live co-editing for the studio (docs/126 §4.5).
//
// Rendered INSIDE `<Builder>` (via `statusBarSlot`), so `useEditor()` resolves to the
// live engine handle. It connects the site's `/ws/builder` room and folds every other
// author's change into this canvas as it lands — a human co-editor's ops (Slice 4) AND an
// agent's MCP write, which api-mcp relays as the identical `ops:relay` (docs/126 §4.5).
// There is no agent-specific path here: a relayed `page.create` is applied by
// `applyRemoteOps` the same way whoever authored it.
//
// WHAT IT RENDERS IS INDICATORS ONLY — who else is in the site, and an "an assistant is
// editing" pulse while an agent is active. Both are non-interactive, which is what lets
// this live in silicaui's `statusBarSlot` (0.41, docs/silicaui/01 §14): the editor's footer, beside
// the surface and device labels, where the engine keeps its own state. That slot is
// non-interactive by contract and more strictly than the header one — it is a 28px strip
// and the engine's own children there are plain text.
//
// ── WHERE people are, not just THAT they are (docs/silicaui/01 §16, silicaui 0.45) ──
//
// The count was the whole story for a while, and it was the thin half. Two authors on one
// page watched each other's edits land with nothing on screen connecting a heading that
// rewrote itself to a name in the footer. This file now also carries the two facts that
// close that gap, in both directions:
//
//   • OUR selection and OUR claim go OUT, on deliberately different rules. A selection is
//     where a person is LOOKING, so it is broadcast freely and binds nobody. A claim is
//     what they are CHANGING, so it is asserted only while they are actually changing it
//     and released a few seconds after they stop. Collapsing the two — claiming whatever
//     is selected — would make clicking a block to read it lock a colleague out of it.
//
//   • EVERYONE ELSE'S come back on the roster and are handed to the engine through
//     `peers`, which draws the selections and enforces the claims. That prop lives on
//     `<Builder>` and this component renders inside it, so the roster is reported UP to
//     the studio — the same shape as the Reload hints, and for the same reason.
//
// A claim is the SOFT half of a lock and never touches persistence: it is not relayed
// into anyone's op log, never reaches the undo stack, and `applyRemoteOps` ignores claims
// entirely. The document is already correct without it (per-node last-write-wins + the op
// log + draft history); the claim is only there to stop two people making a mess they
// then have to untangle by hand.
//
// So the Reload affordance — the one change with no live-appliable op, where an agent
// REPLACED a page body or the frame and force-applying it would destroy the operator's
// in-progress edits — is a BUTTON, and therefore does not belong here. Its hints are
// reported through `onReloadHints` and the studio renders the button in the ACTION slot
// with the other controls. That split is the whole point of there being two slots.
//
// The wire contract is DUPLICATED from api-rest (services never import each other, like
// the chat client). Keep in sync with wizeworks/services/api-rest/src/websocket/builder-protocol.ts.

import { useEditor, useSelection } from '@wizeworks/silicaui-builder/react';
import type { Op, Peer } from '@wizeworks/silicaui-builder/react';
import type { Site } from '@wizeworks/silicaui-html';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
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
  selection?: string[];
  claim?: string[];
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
  'presence:selection': (nodeIds: string[]) => void;
  'presence:claim': (nodeIds: string[]) => void;
}
type BuilderSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** How long the "an assistant is editing" pulse lingers after the last agent write. */
const AGENT_FADE_MS = 8000;

/** How long a claim outlives the last edit that renewed it.
 *
 *  This number is the whole ergonomics of the feature. Too short and a colleague's block
 *  flickers between held and free while they think between keystrokes, which is worse
 *  than no claim at all — it teaches people to ignore it. Too long and someone who has
 *  wandered off keeps a subtree locked, which is the failure a claim exists to avoid
 *  being. Six seconds covers a pause for thought and releases well inside the time it
 *  takes anyone to notice they wanted that block.
 *
 *  IT ALSO MAKES THIS THE HARDEST THING HERE TO VERIFY, so: a claim CANNOT be observed by
 *  making an edit and then going to look at the roster. Any out-of-band check — attaching
 *  a socket, querying the server, reading presence from a script — costs more than six
 *  seconds, so it reads back an EXPIRED claim and a working implementation looks broken.
 *  That misread cost a debugging session on 2026-08-02. Verify it the way a person
 *  experiences it: two clients, edit in one, and watch the OTHER inside the window. */
const CLAIM_TTL_MS = 6000;

/** Trailing throttle on broadcasting our own selection.
 *
 *  Selection changes at the speed of a mouse and each one costs the server a roster
 *  gather plus a broadcast to the room. Coalescing means a drag across the Navigator, or
 *  someone clicking through a dozen blocks looking for one, spends a couple of messages
 *  rather than a dozen — and nobody can perceive the difference, because what a person
 *  reads is where a colleague SETTLED, not the path they took. */
const SELECTION_THROTTLE_MS = 200;

interface Props {
  propertyId: string;
  /** The save-baseline the floor fix (docs/126 §4.4) computes deletions against. A relayed
   *  page.create means the server now has that page and so do we, so it joins the baseline
   *  — and a later LOCAL delete of it is then expressed as a real `deletedPageIds` entry;
   *  a relayed page.delete leaves it. Without this, an operator deleting an agent's
   *  folded-in page would fail to persist that deletion. */
  baselineIdsRef: MutableRefObject<Set<string>>;
  /** A change landed that CANNOT be applied live (an agent replaced a page body or the
   *  frame), so the operator has to be offered a reload. Reported rather than rendered:
   *  the affordance is a button, and a button cannot live in the status slot without
   *  breaking focus order (see the header). Called with the hint kinds as they arrive —
   *  the studio accumulates them, renders the control, and clears its own state. */
  onReloadHints: (hints: string[]) => void;
  /** Batch ids THIS client authored (Slice 4), so it skips the echo of its own ops. */
  ownBatchesRef: MutableRefObject<Set<string>>;
  /** Another author's edit landed on this canvas. It deliberately never reaches
   *  `<Builder onChange>` (a remote op must not echo back to its sender), so the
   *  studio is told here — its undo history computes each inverse against the
   *  document as it stood a moment earlier, and that snapshot has just moved. */
  onRemoteApplied: (site: Site) => void;
  /** The other editors, in the shape silicaui's `peers` prop takes (docs/silicaui/01 §16).
   *
   *  Reported UP rather than rendered here, for the same reason the Reload button is:
   *  `peers` is a prop on `<Builder>` and this component renders INSIDE it. The socket is
   *  the only thing that knows the roster and the engine is the only thing that can draw
   *  it, so the studio holds the state between them. */
  onPeers: (peers: Peer[]) => void;
  /** Filled by this component with "the local author just edited something", for the
   *  studio's `onChange` to call.
   *
   *  INVERTED ON PURPOSE, and the inversion is the finding. A claim has to be driven by
   *  a real EDIT, and `editor.subscribe` does not deliver one: it fires for `selection`,
   *  `peers` and `replace`, but a class change that returned `ok` — and that every other
   *  client received — arrives with `ops` EMPTY. The ops reach the host through
   *  `<Builder onChange>` instead, and that prop belongs to the studio, which is outside
   *  this component. So the studio calls in rather than this component listening out.
   *  Verified in the browser 2026-08-02; the same shape as `invertRef` in undo-history. */
  localEditRef: MutableRefObject<(() => void) | null>;
}

export function BuilderLiveSync({
  propertyId,
  baselineIdsRef,
  onReloadHints,
  ownBatchesRef,
  onRemoteApplied,
  onPeers,
  localEditRef,
}: Props) {
  const editor = useEditor();
  // WHAT THE AUTHOR HAS SELECTED, as a RE-RENDER rather than an event.
  //
  // `useSelection()` is the engine's own observer and re-renders this component on every
  // change. It reports the PRIMARY id only; the full multi-select set is read from
  // `editor.selectedIds` at send time — so this is the TRIGGER and that is the PAYLOAD.
  //
  // `editor.subscribe` would also see it (it fires `kinds: ["selection"]`), but it is not
  // used here, because it is NOT a usable signal for the other half of this file: a real
  // edit arrives through it with `ops` EMPTY, so a claim driven from there never fires.
  // Both facts were established by instrumenting this in the browser on 2026-08-02, and
  // both are worth stating — a future reader will otherwise reach for `subscribe` for one
  // or the other and get a component that typechecks and silently does nothing.
  const selection = useSelection();
  const [presence, setPresence] = useState<BuilderPresence[]>([]);
  const [ownId, setOwnId] = useState<string | null>(null);
  const [agentAt, setAgentAt] = useState(0);
  // Through a ref, like `onRemoteApplied`: the socket handlers bind once on connect, so a
  // callback captured in that closure would go stale on the first parent re-render.
  const onReloadHintsRef = useRef(onReloadHints);
  onReloadHintsRef.current = onReloadHints;
  const [, forceTick] = useState(0);
  const lastSeqRef = useRef(0);
  const socketRef = useRef<BuilderSocket | null>(null);
  const onRemoteAppliedRef = useRef(onRemoteApplied);
  onRemoteAppliedRef.current = onRemoteApplied;

  // Raised while THIS client is folding in someone else's ops.
  //
  // `editor.subscribe` reports every committed action and cannot say who caused it, so
  // without this the claim logic below would treat a colleague's relayed edit as our own
  // and claim the subtree they are working in — the exact inversion of what a claim is
  // for. A counter rather than a boolean because a relayed batch can arrive while
  // another is still being applied.
  const remoteDepthRef = useRef(0);

  // Apply a relayed batch to the live document and advance our sequence, keeping the
  // save-baseline in step. Held in a ref so the socket handlers (bound once on connect)
  // always call the current closure over `editor` + the baseline ref.
  const applyRelayed = (ops: RelayOp[], seq: number): void => {
    if (ops.length) {
      remoteDepthRef.current += 1;
      try {
        editor.applyRemoteOps(ops as unknown as Op[]);
      } finally {
        // In a `finally` so a throw inside the engine cannot leave the guard raised —
        // which would silently disable claims for the rest of the session.
        remoteDepthRef.current -= 1;
      }
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

  // ── Broadcasting OUR selection and OUR claim (docs/silicaui/01 §16) ─────────────
  //
  // The two are separate facts and are sent on different rules, which is the whole
  // design: a SELECTION is where someone is looking, so it is broadcast freely and
  // enforced on nobody; a CLAIM is what someone is changing, so it is asserted only
  // while they are actually changing it and released when they stop. Collapsing them —
  // claiming whatever is selected — would mean clicking a block to look at it locks a
  // colleague out of it, and people would learn to distrust the greying.
  //
  // Both are compared as a joined key before sending. `selectedIds` hands back a fresh
  // array each read, so an identity check would send on every event and a length check
  // would miss a same-size change.
  const lastSelectionRef = useRef<string | null>(null);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claimKeyRef = useRef<string | null>(null);
  const claimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Assigned by the effect below and called from the connect handler, which is bound
  // once and would otherwise close over the first render's function.
  const emitSelectionRef = useRef<() => void>(() => undefined);
  const scheduleSelectionRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    /** Send the current selection, if it has actually moved since the last send. */
    const emitSelection = (): void => {
      const ids = [...editor.selectedIds];
      const key = ids.join(' ');
      if (key === lastSelectionRef.current) return;
      lastSelectionRef.current = key;
      socketRef.current?.emit('presence:selection', ids);
    };
    emitSelectionRef.current = emitSelection;

    /** Coalesce a burst of selection changes into one send at the end of it. Leading
     *  edge deliberately skipped: what a colleague wants to see is where someone
     *  SETTLED, not every block they passed through on the way. */
    const scheduleSelection = (): void => {
      if (selectionTimerRef.current) return;
      selectionTimerRef.current = setTimeout(() => {
        selectionTimerRef.current = null;
        emitSelection();
      }, SELECTION_THROTTLE_MS);
    };

    /** Let go of whatever we were holding. Safe to call when holding nothing. */
    const releaseClaim = (): void => {
      claimTimerRef.current = null;
      if (claimKeyRef.current === '' || claimKeyRef.current === null) {
        claimKeyRef.current = '';
        return;
      }
      claimKeyRef.current = '';
      socketRef.current?.emit('presence:claim', []);
    };

    /** We just changed the document. Hold what we have selected, and start the clock
     *  again — so a claim lasts as long as the editing does and no longer.
     *
     *  Sent only when the SET changes, never per keystroke: typing a paragraph is one
     *  claim held across a hundred events, and re-stating it each time would put a
     *  roster gather on the server for every character typed. The renewal is entirely
     *  local — the timer below — which is what keeps a long edit free. */
    const noteLocalEdit = (): void => {
      const ids = [...editor.selectedIds];
      const key = ids.join(' ');
      if (key !== claimKeyRef.current) {
        claimKeyRef.current = key;
        socketRef.current?.emit('presence:claim', ids);
      }
      if (claimTimerRef.current) clearTimeout(claimTimerRef.current);
      claimTimerRef.current = setTimeout(releaseClaim, CLAIM_TTL_MS);
    };

    // Exposed so the selection effect below can drive the same throttle.
    scheduleSelectionRef.current = scheduleSelection;

    // And so the studio's `onChange` — the only place a real edit's ops surface — can
    // renew the claim. `remoteDepthRef` guards the one case the studio cannot see: ops we
    // are folding in on someone else's behalf reach `applyRemoteOps`, not `onChange`, but
    // the guard costs nothing and states the intent.
    localEditRef.current = () => {
      if (remoteDepthRef.current === 0) noteLocalEdit();
    };

    return () => {
      localEditRef.current = null;
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      if (claimTimerRef.current) clearTimeout(claimTimerRef.current);
      selectionTimerRef.current = null;
      claimTimerRef.current = null;
    };
  }, [editor, localEditRef]);

  // Broadcast where we are whenever the author moves. Through the same trailing throttle
  // the rest of this uses, so clicking through a dozen blocks costs a couple of messages
  // rather than a dozen.
  useEffect(() => {
    scheduleSelectionRef.current();
  }, [selection]);

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
        setOwnId(socket?.id ?? null);
        socket?.emit('catchup', lastSeqRef.current, ({ seq, ops }) => applyRef.current(ops, seq));
        try {
          socket?.emit('presence:active', editor.activePage);
        } catch {
          // No active page yet — presence "where" is best-effort.
        }
        // Re-state where we are after a RECONNECT. The server holds selection on the
        // socket, so a dropped connection takes it with it — without this, an author who
        // briefly lost the network becomes invisible to everyone else until their next
        // click, which on a page someone is reading rather than editing can be a long time.
        lastSelectionRef.current = null;
        claimKeyRef.current = null;
        emitSelectionRef.current();
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
        if (hints.length) onReloadHintsRef.current(hints);
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

  const others = useMemo(
    () => presence.filter((p) => p.socketId !== (ownId ?? socketRef.current?.id)),
    [presence, ownId]
  );

  /** The roster as silicaui's `peers` prop wants it.
   *
   *  OURSELVES EXCLUDED, which is what makes a claim safe to hold: the engine enforces
   *  every claim in the list it is given, so including our own would grey the very block
   *  we are typing into and then refuse the next keystroke.
   *
   *  NOT FILTERED BY PAGE, deliberately. The obvious optimisation — only draw peers whose
   *  `activePage` matches ours — is wrong, because the header and footer are ONE tree
   *  shared by every page: a colleague editing the nav from the About page is editing the
   *  same nodes we can see from Home, and that is exactly the collision worth showing. An
   *  id belonging to a page we do not have open simply matches nothing in our tree.
   *
   *  `color` is omitted on purpose — the engine derives a stable one from `id`, and its
   *  own note says a peer must not wear a theme role, because two peers would then
   *  collide and a peer painted `primary` vanishes into a document that is mostly
   *  primary. Ours to pass, not ours to choose. */
  const peers = useMemo<Peer[]>(
    () =>
      others.map((p) => ({
        id: p.socketId,
        name: p.name,
        ...(p.selection?.length ? { selection: p.selection } : {}),
        ...(p.claim?.length ? { claim: p.claim } : {}),
      })),
    [others]
  );

  const onPeersRef = useRef(onPeers);
  onPeersRef.current = onPeers;
  useEffect(() => {
    onPeersRef.current(peers);
  }, [peers]);

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
    </div>
  );
}

/**
 * The Reload affordance — rendered by the studio in the ACTION slot, from the hints
 * `BuilderLiveSync` reports.
 *
 * It lives here rather than in `studio-surface.tsx` so the whole live-co-editing surface
 * stays in one file: the wording ("the header/footer" vs "the update") is a detail of the
 * hint vocabulary this file owns, and splitting the copy from the protocol is how the two
 * drift. Only the STATE moved out, because only the placement had to.
 */
export function BuilderReloadNotice({
  hints,
  onReload,
}: {
  hints: string[];
  onReload: () => void;
}) {
  if (hints.length === 0) return null;
  const frameOnly = hints.length === 1 && hints[0] === 'frame';
  return (
    <Button size="sm" variant="soft" color="warning" onClick={onReload}>
      <RefreshCw className="size-4" aria-hidden />
      Reload to see {frameOnly ? 'the header/footer' : 'the update'}
    </Button>
  );
}
