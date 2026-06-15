'use client';

// useStudioEditor — the editing BRAIN of the unified builder shell (docs/builder/03).
//
// The unified studio composes THREE ownership zones into one editor: the brand
// `theme`, the site `layout` (chrome), and the active `page` in the Outlet. This
// hook is the three-zone autosave ROUTER the phase turns on: it owns a single
// `{zone, id, ids}` selection spanning the layout + page trees, routes every
// mutation to the tree that owns the selected node, and persists each zone through
// its OWN debounced save bound to its OWN store. That last point is the safety
// property — a layout edit and a page edit never share a debounce or a save call,
// so one can never stomp the other (docs/builder/03 §6, "a mis-routed save is a
// data-loss class of bug"). The zone of a node is derived from WHICH tree
// physically holds it, so routing can't drift from the data.
//
// The `theme` zone is edited by the ThemeCenter panel (its own debounced autosave
// to /v1/brand + the site config); this hook only force-flushes it via `flushTheme`
// when the unified toolbar's Save/Publish needs the latest brand on disk first.
//
// It deliberately mirrors `use-builder-editor` (selection, scope, the tree
// mutations, the confirm-gated delete/retype, AND the Phase-5 affordances: undo/
// redo, multi-select, clipboard, keyboard nudge) rather than extending it: that
// hook is shared by four single-tree shells and bundles per-tree UI state with
// persistence, which the studio's shared selection/device can't reuse cleanly. The
// two share every PURE tree op (model.ts) + the affordance engine (editor-history,
// editor-clipboard, class-conflicts), so they can't diverge on the parts that
// matter. Multi-select is constrained to ONE zone — a selection never spans the
// Outlet boundary, the same firewall the move router enforces.

import * as React from 'react';
import { useConfirm } from '@sparx/ui';
import {
  customKeyOf,
  makeCustomNode,
  type BindingCatalog,
  type ComponentDto,
} from '@sparx/builder-schemas';

import {
  appendChild,
  cloneWithFreshIds,
  findNode,
  findParent,
  idRange,
  insertAfter,
  makeId,
  moveNode,
  moveNodes,
  removeNode,
  topLevelSelected,
  updateNode,
  type BuilderNode,
  type DataSources,
  type Device,
} from './model';
import { buildPreviewData, scopeAt, type ScopeInfo, type SitePreviewData } from './binding-catalog';
import { acceptsChildren, getDef, makeNode, retypeDropsChildren, retypeNode } from './registry';
import { studioMoveZone, studioZoneOf } from './studio-routing';
import { useHistory } from './editor-history';
import { parseClipboard, serializeClipboard } from './editor-clipboard';
import { applyClassChangeToSibling } from './class-conflicts';
import type { MobilePane, RailTab, SaveStatus, SelectMods } from './use-builder-editor';

// The three ownership zones (docs/builder/03 §2.1). `theme` carries no node id
// (the brand is the theme root, not a draggable node — §2.3); `layout`/`page`
// carry the selected node id, or null for that zone's settings home.
export type StudioZone = 'theme' | 'layout' | 'page';

export interface StudioSelection {
  zone: StudioZone;
  /** The PRIMARY selected node id within a `layout`/`page` zone (the inspector's
   *  focus), or null for that zone's settings home. Always null for `theme`. */
  id: string | null;
  /** The full selection set within the active zone (docs/builder/05 §2.2), in
   *  selection order — `id` is its last member. Empty for a settings home / theme. */
  ids: string[];
}

/** The persisted, node-bearing zones — everything this hook autosaves + mutates.
 *  `theme` is excluded: it routes to the ThemeCenter panel, not a node tree. */
type NodeZone = 'layout' | 'page';

/** An undo snapshot of the whole studio (docs/builder/05 §2.1): both node trees +
 *  the selection. Restoring applies only the tree(s) that actually changed. */
interface StudioSnapshot {
  layout: BuilderNode | null;
  page: BuilderNode | null;
  selection: StudioSelection;
}

// Ancestors root→…→node (inclusive). [] when not found. (Mirrors use-builder-editor.)
function pathTo(root: BuilderNode, id: string, trail: BuilderNode[] = []): BuilderNode[] {
  const next = [...trail, root];
  if (root.id === id) return next;
  for (const child of root.children ?? []) {
    const hit = pathTo(child, id, next);
    if (hit.length) return hit;
  }
  return [];
}

// Subtree size beneath `node` (every descendant, excluding the node itself) — used
// to tell the user how much a delete / lossy retype takes with it.
function countDescendants(node: BuilderNode): number {
  return (node.children ?? []).reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

// A drop targeting index 0 of a parent whose first child is PINNED (the
// email_wordmark header, docs/52 §1 — not present on site/page, but the guard is
// cheap + uniform) is bumped below it so nothing lands above a pinned lead child.
function moveWithPinGuard(
  tree: BuilderNode,
  dragIds: string[],
  parentId: string,
  index: number
): BuilderNode {
  const parent = findNode(tree, parentId);
  const firstChild = parent?.children?.[0];
  const leadPinned = Boolean(firstChild && getDef(firstChild.type)?.pinned);
  const at = leadPinned && index < 1 ? 1 : index;
  if (dragIds.length > 1) return moveNodes(tree, dragIds, parentId, at);
  return moveNode(tree, dragIds[0]!, parentId, at);
}

export interface UseStudioEditorArgs {
  /** The active site layout tree (the chrome). Null while nothing is loaded. */
  layoutTree: BuilderNode | null;
  /** The active page tree (rendered at the layout's Outlet). Null while loading. */
  pageTree: BuilderNode | null;
  /** What the layout chrome can bind to — SITE_CATALOG (nav / brand / social). */
  layoutCatalog: BindingCatalog;
  /** What the active page can bind to — the tenant's CMS/commerce/CRM sources. */
  pageCatalog: BindingCatalog;
  /** Tenant custom components, keyed by key (docs/53 P-B) — version-pins a placed
   *  `custom:*` node + labels it. Shared by both zones. */
  components?: ReadonlyMap<string, ComponentDto>;
  /** Real site-chrome data (brand identity + social) overlaid onto the canvas
   *  preview so the header/footer preview the actual brand (parity with apps/site). */
  sitePreview?: SitePreviewData | null;
  /** Persist a changed LAYOUT tree (debounced). ok=true. */
  saveLayout: (tree: BuilderNode) => Promise<boolean>;
  /** Persist a changed PAGE tree (debounced). ok=true. */
  savePage: (tree: BuilderNode) => Promise<boolean>;
  /** Apply an optimistic layout tree to the owner's catalog state. */
  onLayoutChange: (next: BuilderNode) => void;
  /** Apply an optimistic page tree to the owner's catalog state. */
  onPageChange: (next: BuilderNode) => void;
  /** Force-flush the THEME zone's debounced autosave (ThemeCenter), so the unified
   *  Save/Publish persists the latest brand before acting. */
  flushTheme: () => Promise<void>;
}

export interface StudioEditor {
  // ── Shared UI state (one selection / device / rail across all zones) ──────────
  selection: StudioSelection;
  /** Select the brand theme root → the Theme inspector (docs/builder/03 §2.3). */
  selectTheme: () => void;
  /** Select a zone's settings home (no node) → that zone's settings panel. */
  selectZoneHome: (zone: NodeZone) => void;
  /** Select a node by id — the zone is RESOLVED from which tree holds it, so the
   *  canvas/layers never have to know a node's zone. Click modifiers build a
   *  multi-selection WITHIN that zone (docs/builder/05 §2.2). null → clear to the
   *  current node-zone's settings home (or page settings if currently on Theme). */
  selectNode: (id: string | null, mods?: SelectMods) => void;
  /** Select every node in the active zone (Cmd/Ctrl+A). No-op on theme. */
  selectAll: () => void;
  /** Move the selection to the primary's parent (Cmd/Ctrl+↑); clears at a root. */
  selectParent: () => void;
  device: Device;
  setDevice: (d: Device) => void;
  railTab: RailTab;
  setRailTab: (t: RailTab) => void;
  mobilePane: MobilePane;
  setMobilePane: (p: MobilePane) => void;

  // ── Derived from the active zone + selection ──────────────────────────────────
  /** The active node-bearing zone (`layout`/`page`), or null while on `theme`. */
  activeZone: NodeZone | null;
  selectedNode: BuilderNode | null;
  /** The binding catalog of the active zone (drives the inspector's data picker). */
  activeCatalog: BindingCatalog;
  scope: ScopeInfo;
  /** The canvas preview data — the page zone's sources overlaid with the real
   *  site-chrome brand, so chrome + page both preview faithfully (one data root). */
  previewData: DataSources;
  /** Where a palette drop lands in the active zone. */
  target: BuilderNode | null;
  targetName: string;

  // ── Undo / redo (docs/builder/05 §2.1) ──────────────────────────────────────
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // ── Persistence ───────────────────────────────────────────────────────────────
  saveStatus: SaveStatus;
  setSaveStatus: (s: SaveStatus) => void;
  /** Flush a single zone's pending save now. */
  flushZone: (zone: NodeZone) => Promise<void>;
  /** Flush EVERY zone (theme + layout + page) — await before publish / site swap. */
  flushAll: () => Promise<void>;

  // ── Mutations (route to the selected node's zone; schedule that zone's save) ───
  onProp: (key: string, value: unknown) => void;
  onName: (name: string) => void;
  onClass: (value: string) => void;
  onBind: (path: string | null) => void;
  onAdd: (type: string) => void;
  replaceNode: (id: string, next: BuilderNode) => void;
  onRemove: (id: string) => void;
  onMove: (dragId: string, parentId: string, index: number) => void;
  onRetype: (targetType: string) => void;

  // ── Clipboard + bulk (docs/builder/05 §2.5) — act within the active zone ──────
  copySelection: () => void;
  paste: () => Promise<void>;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  copyStyles: () => void;
  pasteStyles: () => void;
  canPasteStyles: boolean;
  nudge: (dir: 'up' | 'down' | 'left' | 'right') => void;
}

export function useStudioEditor({
  layoutTree,
  pageTree,
  layoutCatalog,
  pageCatalog,
  components,
  sitePreview,
  saveLayout,
  savePage,
  onLayoutChange,
  onPageChange,
  flushTheme,
}: UseStudioEditorArgs): StudioEditor {
  const confirm = useConfirm();
  const [selection, setSelectionState] = React.useState<StudioSelection>({
    zone: 'page',
    id: null,
    ids: [],
  });
  const [device, setDevice] = React.useState<Device>('desktop');
  const [railTab, setRailTab] = React.useState<RailTab>('layers');
  const [mobilePane, setMobilePane] = React.useState<MobilePane>('preview');
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');

  // Latest trees / change handlers / selection held in refs so the per-zone
  // autosave + the imperative handlers always read current values without
  // re-subscribing.
  const treesRef = React.useRef({ layout: layoutTree, page: pageTree });
  treesRef.current = { layout: layoutTree, page: pageTree };
  const onChangeRef = React.useRef({ layout: onLayoutChange, page: onPageChange });
  onChangeRef.current = { layout: onLayoutChange, page: onPageChange };
  const saveRef = React.useRef({ layout: saveLayout, page: savePage });
  saveRef.current = { layout: saveLayout, page: savePage };
  const selectionRef = React.useRef(selection);
  selectionRef.current = selection;
  // The fixed end of a range-select, with its zone (a Shift-click extends FROM it).
  const anchorRef = React.useRef<{ zone: NodeZone; id: string } | null>(null);

  const setSelection = React.useCallback((next: StudioSelection) => {
    selectionRef.current = next;
    setSelectionState(next);
  }, []);

  // ── Per-zone debounced autosave (the data-loss firewall) ──────────────────────
  // One timer + one pending payload PER zone, so a chrome edit and a page edit are
  // never coalesced and never overwrite each other (docs/builder/03 §2.2). Each
  // flush persists the exact tree scheduled for THAT zone through THAT zone's save.
  const timers = React.useRef<Record<NodeZone, ReturnType<typeof setTimeout> | null>>({
    layout: null,
    page: null,
  });
  const pending = React.useRef<Record<NodeZone, BuilderNode | null>>({ layout: null, page: null });

  const flushZone = React.useCallback(async (zone: NodeZone) => {
    const t = timers.current[zone];
    if (t) {
      clearTimeout(t);
      timers.current[zone] = null;
    }
    const next = pending.current[zone];
    if (!next) return;
    pending.current[zone] = null;
    setSaveStatus('saving');
    const ok = await saveRef.current[zone](next);
    setSaveStatus(ok ? 'saved' : 'error');
  }, []);

  const scheduleSave = React.useCallback(
    (zone: NodeZone, next: BuilderNode) => {
      pending.current[zone] = next;
      setSaveStatus('saving');
      const t = timers.current[zone];
      if (t) clearTimeout(t);
      timers.current[zone] = setTimeout(() => {
        void flushZone(zone);
      }, 800);
    },
    [flushZone]
  );

  React.useEffect(
    () => () => {
      if (timers.current.layout) clearTimeout(timers.current.layout);
      if (timers.current.page) clearTimeout(timers.current.page);
    },
    []
  );

  const flushAll = React.useCallback(async () => {
    await Promise.all([flushZone('layout'), flushZone('page'), flushTheme()]);
  }, [flushZone, flushTheme]);

  // ── Undo/redo history (docs/builder/05 §2.1) ──────────────────────────────────
  const history = useHistory<StudioSnapshot>();
  // Re-seed when the edited DOCUMENT changes — a different active page (page root
  // id) or a different layout swaps in. Undo never replays across that boundary.
  const docKey = `${layoutTree?.id ?? '∅'}:${pageTree?.id ?? '∅'}`;
  // history.seed is stable; this depends on the document identity (docKey) only —
  // re-running on every tree edit would wipe the undo stack.
  React.useEffect(() => {
    history.seed({
      layout: treesRef.current.layout,
      page: treesRef.current.page,
      selection: { zone: 'page', id: null, ids: [] },
    });
  }, [docKey]);

  // ── Clipboard buffers (in-app fallbacks for the system clipboard) ─────────────
  const clipboardRef = React.useRef<BuilderNode[] | null>(null);
  const [stylesClip, setStylesClip] = React.useState<string | null>(null);
  const stylesClipRef = React.useRef<string | null>(null);
  stylesClipRef.current = stylesClip;

  // ── Zone resolution (the routing key — derived from the trees, never stored) ───
  const zoneOf = React.useCallback(
    (id: string): NodeZone | null =>
      studioZoneOf(treesRef.current.layout, treesRef.current.page, id),
    []
  );

  // ── Selection ────────────────────────────────────────────────────────────────
  const selectTheme = React.useCallback(() => {
    anchorRef.current = null;
    setSelection({ zone: 'theme', id: null, ids: [] });
  }, [setSelection]);

  const selectZoneHome = React.useCallback(
    (zone: NodeZone) => {
      anchorRef.current = null;
      setSelection({ zone, id: null, ids: [] });
    },
    [setSelection]
  );

  const selectNode = React.useCallback(
    (id: string | null, mods?: SelectMods) => {
      if (id === null) {
        anchorRef.current = null;
        setSelection({
          zone: selectionRef.current.zone === 'theme' ? 'page' : selectionRef.current.zone,
          id: null,
          ids: [],
        });
        return;
      }
      const zone = zoneOf(id);
      if (!zone) return; // unknown id (vanished mid-drag) — leave selection put
      const cur = selectionRef.current;
      const tree = treesRef.current[zone];

      // Range-select within the SAME zone (the anchor's zone must match).
      if (mods?.range && anchorRef.current?.zone === zone && tree) {
        const range = idRange(tree, anchorRef.current.id, id);
        if (range.length) {
          setSelection({ zone, id, ids: range });
          return;
        }
      }
      // Additive toggle only when staying in the current zone; a cross-zone click
      // can't extend a selection (it would span the Outlet) — it replaces instead.
      if (mods?.additive && cur.zone === zone) {
        const has = cur.ids.includes(id);
        const ids = has ? cur.ids.filter((x) => x !== id) : [...cur.ids, id];
        anchorRef.current = { zone, id };
        setSelection({ zone, id: has ? (ids[ids.length - 1] ?? null) : id, ids });
        return;
      }
      anchorRef.current = { zone, id };
      setSelection({ zone, id, ids: [id] });
    },
    [zoneOf, setSelection]
  );

  const selectAll = React.useCallback(() => {
    const cur = selectionRef.current;
    if (cur.zone === 'theme') return;
    const tree = treesRef.current[cur.zone];
    if (!tree) return;
    const ids: string[] = [];
    const walk = (n: BuilderNode) => {
      for (const c of n.children ?? []) {
        ids.push(c.id);
        walk(c);
      }
    };
    walk(tree);
    if (ids.length === 0) return;
    anchorRef.current = { zone: cur.zone, id: ids[0]! };
    setSelection({ zone: cur.zone, id: ids[ids.length - 1]!, ids });
  }, [setSelection]);

  const selectParent = React.useCallback(() => {
    const cur = selectionRef.current;
    if (cur.zone === 'theme' || !cur.id) return;
    const tree = treesRef.current[cur.zone];
    if (!tree) return;
    const parent = findParent(tree, cur.id);
    if (!parent || parent.id === tree.id) {
      setSelection({ zone: cur.zone, id: null, ids: [] });
      return;
    }
    anchorRef.current = { zone: cur.zone, id: parent.id };
    setSelection({ zone: cur.zone, id: parent.id, ids: [parent.id] });
  }, [setSelection]);

  // ── Derived (active zone) ─────────────────────────────────────────────────────
  const activeZone: NodeZone | null = selection.zone === 'theme' ? null : selection.zone;
  const activeTree = activeZone ? (activeZone === 'page' ? pageTree : layoutTree) : null;
  const activeCatalog = selection.zone === 'layout' ? layoutCatalog : pageCatalog;

  const selectedNode = activeTree && selection.id ? findNode(activeTree, selection.id) : null;
  const chain = React.useMemo(
    () => (activeTree && selection.id ? pathTo(activeTree, selection.id) : []),
    [activeTree, selection.id]
  );
  const scope = React.useMemo(() => scopeAt(activeCatalog, chain), [activeCatalog, chain]);

  // The canvas renders chrome + page against ONE data root. The page zone's sources
  // (overlaid with the real brand/social) drive it — the header/footer bind only to
  // the sitePreview-supplied identity, and the page binds to its content sources, so
  // the page catalog's preview data serves both faithfully (parity with the page
  // editor's locked-chrome framing).
  const previewData = React.useMemo(
    () => buildPreviewData(pageCatalog.sources, sitePreview),
    [pageCatalog, sitePreview]
  );

  // Where a palette drop lands in the active zone: the selected container, else its
  // nearest container ancestor, else the active tree's root.
  const target = React.useMemo<BuilderNode | null>(() => {
    if (!activeTree) return null;
    if (!selectedNode) return activeTree;
    if (acceptsChildren(selectedNode.type)) return selectedNode;
    return chain[chain.length - 2] ?? activeTree;
  }, [activeTree, selectedNode, chain]);

  // ── Mutation plumbing (route to a zone · autosave · record history) ───────────
  // Every node-tree mutation funnels through `commitZone`: it pushes the optimistic
  // tree to the owner, schedules THAT zone's autosave, optionally moves the
  // selection, and records BOTH trees on the undo stack — so every edit is undoable
  // and the other zone rides along unchanged (docs/builder/05 §5). Undo/redo restore
  // through `applySnapshot`, which writes only the zone(s) that changed.
  const commitZone = React.useCallback(
    (zone: NodeZone, next: BuilderNode, selAfter?: StudioSelection) => {
      onChangeRef.current[zone](next);
      scheduleSave(zone, next);
      if (selAfter) setSelection(selAfter);
      const sel = selAfter ?? selectionRef.current;
      history.push({
        layout: zone === 'layout' ? next : treesRef.current.layout,
        page: zone === 'page' ? next : treesRef.current.page,
        selection: sel,
      });
    },
    [scheduleSave, setSelection, history]
  );

  // Mutate the ACTIVE zone's tree (the selected node's zone).
  const updateActiveTree = React.useCallback(
    (fn: (t: BuilderNode) => BuilderNode, selAfter?: StudioSelection) => {
      const zone = selectionRef.current.zone;
      if (zone === 'theme') return;
      const tree = treesRef.current[zone];
      if (!tree) return;
      const next = fn(tree);
      if (next === tree) return; // no-op edit shouldn't grow the undo stack
      commitZone(zone, next, selAfter);
    },
    [commitZone]
  );

  const applySnapshot = React.useCallback(
    (snap: StudioSnapshot) => {
      const cur = treesRef.current;
      if (snap.layout && snap.layout !== cur.layout) {
        onChangeRef.current.layout(snap.layout);
        scheduleSave('layout', snap.layout);
      }
      if (snap.page && snap.page !== cur.page) {
        onChangeRef.current.page(snap.page);
        scheduleSave('page', snap.page);
      }
      setSelection(snap.selection);
      anchorRef.current =
        snap.selection.zone !== 'theme' && snap.selection.id
          ? { zone: snap.selection.zone, id: snap.selection.id }
          : null;
    },
    [scheduleSave, setSelection]
  );

  const undo = React.useCallback(() => {
    const snap = history.undo();
    if (snap) applySnapshot(snap);
  }, [history, applySnapshot]);

  const redo = React.useCallback(() => {
    const snap = history.redo();
    if (snap) applySnapshot(snap);
  }, [history, applySnapshot]);

  const mutateSelected = React.useCallback(
    (fn: (n: BuilderNode) => BuilderNode) => {
      const id = selectionRef.current.id;
      if (!id) return;
      updateActiveTree((t) => updateNode(t, id, fn));
    },
    [updateActiveTree]
  );

  const onProp = (key: string, value: unknown) =>
    mutateSelected((n) => ({ ...n, props: { ...n.props, [key]: value } }));
  const onName = (name: string) =>
    mutateSelected((n) => {
      const next = { ...n };
      if (name) next.name = name;
      else delete next.name;
      return next;
    });

  // Class edit (docs/47) — applied to the primary, fanned out group-aware to the
  // rest of the active-zone selection (docs/builder/05 §2.2).
  const onClass = (value: string) => {
    const { id, ids } = selectionRef.current;
    if (!id) return;
    updateActiveTree((t) => {
      const oldPrimaryClass = findNode(t, id)?.class;
      let next = updateNode(t, id, (n) => ({ ...n, class: value || undefined }));
      for (const other of ids) {
        if (other === id) continue;
        next = updateNode(next, other, (n) => {
          const sib = applyClassChangeToSibling(oldPrimaryClass, value, n.class);
          return { ...n, class: sib || undefined };
        });
      }
      return next;
    });
  };

  const onBind = (path: string | null) =>
    mutateSelected((n) => {
      if (!path) {
        const next = { ...n };
        delete next.binding;
        return next;
      }
      return { ...n, binding: { path } };
    });

  // Add a node inside the active zone's drop target. A `custom:<key>` drops a
  // pinned component placement (docs/53 P-B); everything else a fresh system node.
  const onAdd = (type: string) => {
    if (!target) return;
    const key = customKeyOf(type);
    let child: BuilderNode;
    if (key) {
      const comp = components?.get(key);
      if (!comp) return;
      child = makeCustomNode(key, comp.latestVersion, makeId('custom'));
    } else {
      child = makeNode(type);
    }
    const targetId = target.id;
    const zone = selectionRef.current.zone;
    // Select the new node directly: it was just appended to the ACTIVE zone, so its
    // zone is known (zoneOf would resolve via the trees ref, which still holds the
    // pre-append tree this render — the new id isn't found yet).
    updateActiveTree((t) => appendChild(t, targetId, child), {
      zone,
      id: child.id,
      ids: [child.id],
    });
    setRailTab('layers');
  };

  // Swap node `id` for `next` (same position) — "Save as component". `id` is always
  // in the active zone (the action originates from the selected node), so select the
  // replacement directly (same reason as onAdd — the trees ref lags this render).
  const replaceNode = (id: string, next: BuilderNode) => {
    const zone = selectionRef.current.zone;
    updateActiveTree((t) => updateNode(t, id, () => next), {
      zone,
      id: next.id,
      ids: [next.id],
    });
  };

  // Delete a node (its WHOLE subtree) — confirm first, naming how much goes with it.
  // Routed by the node's own zone, so the layers remove control works on any row.
  const onRemove = (id: string) => {
    const zone = zoneOf(id);
    if (!zone) return;
    const tree = treesRef.current[zone];
    if (!tree) return;
    const node = findNode(tree, id);
    if (!node) return;
    if (getDef(node.type)?.pinned) return; // a pinned node is structural — never removed
    const ckey = customKeyOf(node.type);
    const label =
      node.name ??
      getDef(node.type)?.label ??
      (ckey ? components?.get(ckey)?.name : undefined) ??
      node.type;
    const nested = countDescendants(node);
    void (async () => {
      const ok = await confirm({
        title: `Delete “${label}”?`,
        description:
          nested > 0
            ? `This also removes its ${nested} nested item${nested === 1 ? '' : 's'}. This can’t be undone.`
            : 'This can’t be undone.',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      const cur = treesRef.current[zone];
      if (!cur) return;
      const next = removeNode(cur, id);
      const sel = selectionRef.current;
      const ids = sel.zone === zone ? sel.ids.filter((x) => x !== id) : sel.ids;
      const selAfter: StudioSelection =
        sel.zone === zone
          ? { zone, id: sel.id === id ? (ids[ids.length - 1] ?? null) : sel.id, ids }
          : sel;
      commitZone(zone, next, selAfter);
    })();
  };

  // Delete the WHOLE active-zone selection (docs/builder/05 §2.2) — confirm once.
  const deleteSelection = () => {
    const cur = selectionRef.current;
    if (cur.zone === 'theme') return;
    const tree = treesRef.current[cur.zone];
    if (!tree) return;
    const zone = cur.zone;
    const tops = topLevelSelected(tree, new Set(cur.ids)).filter(
      (id) => !getDef(findNode(tree, id)?.type ?? '')?.pinned
    );
    if (tops.length === 0) return;
    if (tops.length === 1) {
      onRemove(tops[0]!);
      return;
    }
    const total = tops.reduce((sum, id) => {
      const n = findNode(tree, id);
      return sum + 1 + (n ? countDescendants(n) : 0);
    }, 0);
    void (async () => {
      const ok = await confirm({
        title: `Delete ${tops.length} blocks?`,
        description: `This removes ${total} item${total === 1 ? '' : 's'} in total. This can’t be undone.`,
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      const fresh = treesRef.current[zone];
      if (!fresh) return;
      const next = tops.reduce((acc, id) => removeNode(acc, id), fresh);
      commitZone(zone, next, { zone, id: null, ids: [] });
    })();
  };

  // Re-parent / reorder WITHIN a zone. The dragged node's zone is resolved from the
  // trees; a drop whose target parent lives in a DIFFERENT zone is rejected (a
  // no-op), so a drag can never move a node across the Outlet boundary — that would
  // be a mis-routed save (docs/builder/03 §6). A multi-selection in the dragged
  // node's zone moves together. moveNode itself no-ops illegal moves.
  const onMove = (dragId: string, parentId: string, index: number) => {
    const zone = studioMoveZone(treesRef.current.layout, treesRef.current.page, dragId, parentId);
    if (!zone) return; // cross-zone / unknown parent → no-op
    const tree = treesRef.current[zone];
    if (!tree) return;
    const sel = selectionRef.current;
    const dragIds =
      sel.zone === zone && sel.ids.length > 1 && sel.ids.includes(dragId) ? sel.ids : [dragId];
    const next = moveWithPinGuard(tree, dragIds, parentId, index);
    if (next === tree) return; // illegal move — nothing changed
    commitZone(zone, next);
  };

  // Change the selected node's type. Same-kind targets keep children; the lossy
  // case (a leaf target that can't nest) is confirmed first, counting what's lost.
  const onRetype = (targetType: string) => {
    if (!selectedNode || !selection.id) return;
    const to = getDef(targetType);
    if (!to || targetType === selectedNode.type) return;
    const apply = () => mutateSelected((n) => retypeNode(n, targetType));
    if (retypeDropsChildren(selectedNode, targetType)) {
      const lost = countDescendants(selectedNode);
      void (async () => {
        const ok = await confirm({
          title: `Change to ${to.label}?`,
          description: `A ${to.label} can’t hold the ${lost} nested item${lost === 1 ? '' : 's'} inside this — ${lost === 1 ? 'it' : 'they'} will be removed. This can’t be undone.`,
          confirmLabel: 'Change type',
          tone: 'danger',
        });
        if (ok) apply();
      })();
    } else {
      apply();
    }
  };

  // ── Clipboard + duplicate + copy-styles (docs/builder/05 §2.5) ────────────────
  const copySelection = () => {
    const cur = selectionRef.current;
    if (cur.zone === 'theme') return;
    const tree = treesRef.current[cur.zone];
    if (!tree) return;
    const tops = topLevelSelected(tree, new Set(cur.ids));
    const nodes = tops.map((id) => findNode(tree, id)).filter((n): n is BuilderNode => n !== null);
    if (nodes.length === 0) return;
    clipboardRef.current = nodes;
    void navigator.clipboard?.writeText(serializeClipboard(nodes)).catch(() => {
      // Clipboard API blocked — the in-app ref still serves same-tab paste.
    });
  };

  const paste = async () => {
    const cur = selectionRef.current;
    if (cur.zone === 'theme') return;
    const zone = cur.zone;
    const tree = treesRef.current[zone];
    if (!tree) return;
    let nodes: BuilderNode[] | null = null;
    try {
      const text = await navigator.clipboard?.readText();
      if (text) nodes = parseClipboard(text);
    } catch {
      // ignore — fall back to the in-app buffer
    }
    nodes ??= clipboardRef.current ? clipboardRef.current.map(cloneWithFreshIds) : null;
    if (!nodes || nodes.length === 0) return;

    const primary = cur.id;
    const parent = primary ? findParent(tree, primary) : null;
    let next = tree;
    if (primary && parent) {
      let afterId = primary;
      for (const node of nodes) {
        next = insertAfter(next, afterId, node);
        afterId = node.id;
      }
    } else {
      for (const node of nodes) next = appendChild(next, tree.id, node);
    }
    const ids = nodes.map((n) => n.id);
    commitZone(zone, next, { zone, id: ids[ids.length - 1]!, ids });
    setRailTab('layers');
  };

  const duplicateSelection = () => {
    const cur = selectionRef.current;
    if (cur.zone === 'theme') return;
    const zone = cur.zone;
    const tree = treesRef.current[zone];
    if (!tree) return;
    const tops = topLevelSelected(tree, new Set(cur.ids));
    if (tops.length === 0) return;
    let next = tree;
    const newIds: string[] = [];
    for (const id of tops) {
      const node = findNode(next, id);
      if (!node) continue;
      const clone = cloneWithFreshIds(node);
      next = insertAfter(next, id, clone);
      newIds.push(clone.id);
    }
    if (newIds.length === 0) return;
    commitZone(zone, next, { zone, id: newIds[newIds.length - 1]!, ids: newIds });
  };

  const copyStyles = () => {
    const cur = selectionRef.current;
    if (cur.zone === 'theme' || !cur.id) return;
    const tree = treesRef.current[cur.zone];
    const node = tree ? findNode(tree, cur.id) : null;
    if (!node) return;
    setStylesClip(node.class ?? '');
  };

  const pasteStyles = () => {
    const cls = stylesClipRef.current;
    if (cls === null) return;
    const cur = selectionRef.current;
    if (cur.zone === 'theme' || cur.ids.length === 0) return;
    updateActiveTree((t) =>
      cur.ids.reduce(
        (acc, id) => updateNode(acc, id, (n) => ({ ...n, class: cls || undefined })),
        t
      )
    );
  };

  const nudge = (dir: 'up' | 'down' | 'left' | 'right') => {
    const cur = selectionRef.current;
    if (cur.zone === 'theme' || !cur.id) return;
    const tree = treesRef.current[cur.zone];
    if (!tree) return;
    const primary = cur.id;
    const node = findNode(tree, primary);
    if (!node || getDef(node.type)?.pinned) return;
    const parent = findParent(tree, primary);
    if (!parent) return;
    const siblings = parent.children ?? [];
    const i = siblings.findIndex((c) => c.id === primary);
    if (i === -1) return;

    if (dir === 'up' || dir === 'down') {
      const to = dir === 'up' ? i - 1 : i + 1;
      if (to < 0 || to >= siblings.length) return;
      onMove(primary, parent.id, dir === 'up' ? to : to);
    } else if (dir === 'left') {
      const grand = findParent(tree, parent.id);
      if (!grand) return;
      const pIndex = (grand.children ?? []).findIndex((c) => c.id === parent.id);
      onMove(primary, grand.id, pIndex + 1);
    } else {
      const prev = siblings[i - 1];
      if (!prev || !acceptsChildren(prev.type)) return;
      onMove(primary, prev.id, prev.children?.length ?? 0);
    }
  };

  const targetDef = target ? getDef(target.type) : undefined;
  const targetName =
    target?.name ?? targetDef?.label ?? (activeZone === 'page' ? 'page' : 'layout');

  return {
    selection,
    selectTheme,
    selectZoneHome,
    selectNode,
    selectAll,
    selectParent,
    device,
    setDevice,
    railTab,
    setRailTab,
    mobilePane,
    setMobilePane,
    activeZone,
    selectedNode,
    activeCatalog,
    scope,
    previewData,
    target,
    targetName,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    saveStatus,
    setSaveStatus,
    flushZone,
    flushAll,
    onProp,
    onName,
    onClass,
    onBind,
    onAdd,
    replaceNode,
    onRemove,
    onMove,
    onRetype,
    copySelection,
    paste,
    duplicateSelection,
    deleteSelection,
    copyStyles,
    pasteStyles,
    canPasteStyles: stylesClip !== null,
    nudge,
  };
}
