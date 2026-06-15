'use client';

// useStudioEditor — the editing BRAIN of the unified builder shell (docs/builder/03).
//
// The unified studio composes THREE ownership zones into one editor: the brand
// `theme`, the site `layout` (chrome), and the active `page` in the Outlet. This
// hook is the three-zone autosave ROUTER the phase turns on: it owns a single
// `{zone, id}` selection spanning the layout + page trees, routes every mutation
// to the tree that owns the selected node, and persists each zone through its OWN
// debounced save bound to its OWN store. That last point is the safety property —
// a layout edit and a page edit never share a debounce or a save call, so one can
// never stomp the other (docs/builder/03 §6, "a mis-routed save is a data-loss
// class of bug"). The zone of a node is derived from WHICH tree physically holds
// it, so routing can't drift from the data.
//
// The `theme` zone is edited by the ThemeCenter panel (its own debounced autosave
// to /v1/brand + the site config); this hook only force-flushes it via `flushTheme`
// when the unified toolbar's Save/Publish needs the latest brand on disk first.
//
// It deliberately mirrors `use-builder-editor` (selection, scope, the tree
// mutations, the confirm-gated delete/retype) rather than extending it: that hook
// is shared by four single-tree shells (page/site/email/component) and bundles
// per-tree UI state with persistence, which the studio's shared selection/device
// can't reuse cleanly. The two share every PURE tree op (model.ts) + scope/preview
// builder, so they can't diverge on the parts that matter.

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
  findNode,
  makeId,
  moveNode,
  removeNode,
  updateNode,
  type BuilderNode,
  type DataSources,
  type Device,
} from './model';
import { buildPreviewData, scopeAt, type ScopeInfo, type SitePreviewData } from './binding-catalog';
import { acceptsChildren, getDef, makeNode, retypeDropsChildren, retypeNode } from './registry';
import { studioMoveZone, studioZoneOf } from './studio-routing';
import type { MobilePane, RailTab, SaveStatus } from './use-builder-editor';

// The three ownership zones (docs/builder/03 §2.1). `theme` carries no node id
// (the brand is the theme root, not a draggable node — §2.3); `layout`/`page`
// carry the selected node id, or null for that zone's settings home.
export type StudioZone = 'theme' | 'layout' | 'page';

export interface StudioSelection {
  zone: StudioZone;
  /** The selected node id within a `layout`/`page` zone, or null for that zone's
   *  settings home (Site layout settings / Page settings). Always null for `theme`. */
  id: string | null;
}

/** The persisted, node-bearing zones — everything this hook autosaves + mutates.
 *  `theme` is excluded: it routes to the ThemeCenter panel, not a node tree. */
type NodeZone = 'layout' | 'page';

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
  dragId: string,
  parentId: string,
  index: number
): BuilderNode {
  const parent = findNode(tree, parentId);
  const firstChild = parent?.children?.[0];
  const leadPinned = Boolean(firstChild && getDef(firstChild.type)?.pinned);
  return moveNode(tree, dragId, parentId, leadPinned && index < 1 ? 1 : index);
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
   *  canvas/layers never have to know a node's zone. null → clear to the current
   *  node-zone's settings home (or page settings if currently on Theme). */
  selectNode: (id: string | null) => void;
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
  const [selection, setSelection] = React.useState<StudioSelection>({ zone: 'page', id: null });
  const [device, setDevice] = React.useState<Device>('desktop');
  const [railTab, setRailTab] = React.useState<RailTab>('layers');
  const [mobilePane, setMobilePane] = React.useState<MobilePane>('preview');
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');

  // Latest trees / change handlers held in refs so the per-zone autosave + the
  // mutation closures always read current values without re-subscribing.
  const treesRef = React.useRef({ layout: layoutTree, page: pageTree });
  treesRef.current = { layout: layoutTree, page: pageTree };
  const onChangeRef = React.useRef({ layout: onLayoutChange, page: onPageChange });
  onChangeRef.current = { layout: onLayoutChange, page: onPageChange };
  const saveRef = React.useRef({ layout: saveLayout, page: savePage });
  saveRef.current = { layout: saveLayout, page: savePage };

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

  // ── Zone resolution (the routing key — derived from the trees, never stored) ───
  const zoneOf = React.useCallback(
    (id: string): NodeZone | null =>
      studioZoneOf(treesRef.current.layout, treesRef.current.page, id),
    []
  );

  // ── Selection ────────────────────────────────────────────────────────────────
  const selectTheme = React.useCallback(() => setSelection({ zone: 'theme', id: null }), []);
  const selectZoneHome = React.useCallback(
    (zone: NodeZone) => setSelection({ zone, id: null }),
    []
  );
  const selectNode = React.useCallback(
    (id: string | null) => {
      if (id === null) {
        setSelection((cur) => ({ zone: cur.zone === 'theme' ? 'page' : cur.zone, id: null }));
        return;
      }
      const zone = zoneOf(id);
      if (!zone) return; // unknown id (vanished mid-drag) — leave selection put
      setSelection({ zone, id });
    },
    [zoneOf]
  );

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

  // ── Mutation plumbing (route to the active zone) ──────────────────────────────
  const updateActiveTree = React.useCallback(
    (fn: (t: BuilderNode) => BuilderNode) => {
      const zone = selection.zone;
      if (zone === 'theme') return;
      const tree = treesRef.current[zone];
      if (!tree) return;
      const next = fn(tree);
      onChangeRef.current[zone](next);
      scheduleSave(zone, next);
    },
    [selection.zone, scheduleSave]
  );

  const mutateSelected = React.useCallback(
    (fn: (n: BuilderNode) => BuilderNode) => {
      if (!selection.id) return;
      const id = selection.id;
      updateActiveTree((t) => updateNode(t, id, fn));
    },
    [selection.id, updateActiveTree]
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
  const onClass = (value: string) => mutateSelected((n) => ({ ...n, class: value || undefined }));
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
    updateActiveTree((t) => appendChild(t, targetId, child));
    // Select the new node directly: it was just appended to the ACTIVE zone, so its
    // zone is known — `selectNode` would resolve via the trees ref, which still
    // holds the pre-append tree this render (the new id isn't found yet).
    setSelection({ zone: selection.zone, id: child.id });
    setRailTab('layers');
  };

  // Swap node `id` for `next` (same position) — "Save as component". `id` is always
  // in the active zone (the action originates from the selected node), so select the
  // replacement directly (same reason as onAdd — the trees ref lags this render).
  const replaceNode = (id: string, next: BuilderNode) => {
    updateActiveTree((t) => updateNode(t, id, () => next));
    setSelection({ zone: selection.zone, id: next.id });
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
      onChangeRef.current[zone](next);
      scheduleSave(zone, next);
      setSelection((s) => (s.zone === zone && s.id === id ? { zone, id: null } : s));
    })();
  };

  // Re-parent / reorder WITHIN a zone. The dragged node's zone is resolved from the
  // trees; a drop whose target parent lives in a DIFFERENT zone is rejected (a
  // no-op), so a drag can never move a node across the Outlet boundary — that would
  // be a mis-routed save (docs/builder/03 §6). moveNode itself no-ops illegal moves.
  const onMove = (dragId: string, parentId: string, index: number) => {
    const zone = studioMoveZone(treesRef.current.layout, treesRef.current.page, dragId, parentId);
    if (!zone) return; // cross-zone / unknown parent → no-op
    const tree = treesRef.current[zone];
    if (!tree) return;
    const next = moveWithPinGuard(tree, dragId, parentId, index);
    if (next === tree) return; // illegal move — nothing changed
    onChangeRef.current[zone](next);
    scheduleSave(zone, next);
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

  const targetDef = target ? getDef(target.type) : undefined;
  const targetName =
    target?.name ?? targetDef?.label ?? (activeZone === 'page' ? 'page' : 'layout');

  return {
    selection,
    selectTheme,
    selectZoneHome,
    selectNode,
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
  };
}
