'use client';

// The shared Layers-tree ENGINE (docs/builder/03) — collapse state + persistence,
// the flat-list + drag PROJECTION, the dnd-kit wiring, and the select→reveal/scroll
// effects, in ONE place for BOTH the unified studio's `StudioLayers` and the
// per-surface `LayersPanel`. The two panels' drag/collapse logic was byte-for-byte
// identical except two knobs — the localStorage namespace and the cross-zone drop
// guard — so keeping it here (rather than copy-pasted) means a fix lands in both
// editors at once. Each panel still renders its OWN chrome (the home/theme row, the
// expand/collapse bar) and maps `flat` to <LayerRow> with its own per-row policy.

import * as React from 'react';
import {
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

import { type BuilderNode } from './model';
import { INDENT } from './layers-row';
import {
  ancestorIds,
  collapsibleIds,
  flattenTree,
  projectDrop,
  type FlatNode,
  type Projection,
} from './layers-tree';

// Per-tree collapse state is remembered in localStorage, keyed by the tree's root
// id (stable per page/layout, distinct across them). New trees start collapsed —
// the default below — until the user expands something.
function loadCollapsed(store: string, treeId: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(store + treeId);
    if (!raw) return null;
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function saveCollapsed(store: string, treeId: string, ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(store + treeId, JSON.stringify([...ids]));
  } catch {
    /* private mode / quota — collapse state is a nicety, not worth surfacing */
  }
}

export interface UseLayerTreeArgs {
  /** The tree to render — already composed (studio grafts the page at the Outlet);
   *  collapse persistence + the reveal trail both key off THIS tree. */
  tree: BuilderNode;
  /** localStorage namespace for this surface's collapse state. */
  collapseStore: string;
  /** The primary selected id (drives select→reveal + scroll-into-view). */
  selectedId: string | null;
  /** Re-parent / reorder: move `dragId` to be child `index` of `parentId`. */
  onMove: (dragId: string, parentId: string, index: number) => void;
  /** Gate a projected drop — return false to drop the move (the studio uses this to
   *  forbid crossing the Outlet zone boundary). Omitted ⇒ every legal move commits. */
  validateMove?: (activeId: string, parentId: string) => boolean;
}

export interface LayerTree {
  collapsed: ReadonlySet<string>;
  toggle: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  /** The flattened render order (the active node's subtree hidden while dragging). */
  flat: FlatNode[];
  /** Every visible row id, in order — the SortableContext `items`. */
  rowIds: string[];
  /** The row currently being dragged (null otherwise). */
  activeId: string | null;
  /** Where the live drag targets (drives the drop indicator's depth). */
  projection: Projection | null;
  /** Attach to the scroll container so select→reveal can scroll a row into view. */
  layersRef: React.RefObject<HTMLDivElement | null>;
  /** Spread onto <DndContext> — sensors, collision, measuring, and drag handlers. */
  dndContextProps: {
    id: string;
    sensors: ReturnType<typeof useSensors>;
    collisionDetection: CollisionDetection;
    measuring: { droppable: { strategy: MeasuringStrategy } };
    onDragStart: (e: DragStartEvent) => void;
    onDragMove: (e: DragMoveEvent) => void;
    onDragOver: (e: DragOverEvent) => void;
    onDragEnd: (e: DragEndEvent) => void;
    onDragCancel: () => void;
  };
}

export function useLayerTree({
  tree,
  collapseStore,
  selectedId,
  onMove,
  validateMove,
}: UseLayerTreeArgs): LayerTree {
  // Collapse state starts COLLAPSED BY DEFAULT (every collapsible row). This
  // initializer is deterministic from `tree`, so SSR and the first client render
  // match; the localStorage load below then overrides it post-mount (client only).
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(
    () => new Set(collapsibleIds(tree))
  );
  // Refs hold the latest tree + collapsed so the handlers/effects read current
  // values without stale closures or re-subscribing on every edit.
  const treeRef = React.useRef(tree);
  treeRef.current = tree;
  const collapsedRef = React.useRef(collapsed);
  collapsedRef.current = collapsed;
  const layersRef = React.useRef<HTMLDivElement>(null);

  // Live drag state — drives the projection (where the drop will land).
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [offsetX, setOffsetX] = React.useState(0);

  // Stable, SSR-safe id for the DndContext (else dnd-kit's a11y node ids differ
  // server vs client → hydration mismatch). `useId()` is deterministic across both.
  const dndId = React.useId();
  const sensors = useSensors(
    // A small activation distance lets a plain click still select (no drag).
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Set + remember collapse state. Persistence lives in the mutator (not a
  // state-watching effect) so the post-mount load below can restore WITHOUT a
  // stale write clobbering it.
  const commit = React.useCallback(
    (next: ReadonlySet<string>) => {
      setCollapsed(next);
      saveCollapsed(collapseStore, treeRef.current.id, next);
    },
    [collapseStore]
  );

  // Restore this tree's saved collapse state on mount, and again when switching to
  // a different page/layout (the root id changes). Load only; never writes.
  React.useEffect(() => {
    const saved = loadCollapsed(collapseStore, tree.id);
    setCollapsed(saved ? new Set(saved) : new Set(collapsibleIds(treeRef.current)));
  }, [tree.id, collapseStore]);

  // Select→reveal: expand any collapsed ancestor of the selected node so its row
  // shows (works whether the selection came from the tree or the canvas).
  React.useEffect(() => {
    if (!selectedId) return;
    const trail = ancestorIds(treeRef.current, selectedId);
    if (trail.some((id) => collapsedRef.current.has(id))) {
      const next = new Set(collapsedRef.current);
      for (const id of trail) next.delete(id);
      commit(next);
    }
  }, [selectedId, commit]);

  // Scroll the selected row into view (the tree side of select→reveal). `nearest`
  // makes it a no-op when already visible, so selecting never makes the tree jump.
  // Re-runs when the visible rows change (a reveal expanded an ancestor).
  React.useEffect(() => {
    if (!selectedId) return;
    // `window.CSS` — the dnd-kit `CSS` helper shadows the global name in the panels.
    const el = layersRef.current?.querySelector(
      `[data-layer-id="${window.CSS.escape(selectedId)}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedId, collapsed]);

  const toggle = React.useCallback(
    (id: string) => {
      const next = new Set(collapsedRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      commit(next);
    },
    [commit]
  );
  const expandAll = React.useCallback(() => commit(new Set()), [commit]);
  const collapseAll = React.useCallback(
    () => commit(new Set(collapsibleIds(treeRef.current))),
    [commit]
  );

  // While dragging, hide the active node's subtree (add it to the collapse set) so
  // it travels as one unit and never projects against its own children.
  const flat = React.useMemo(() => {
    if (!activeId) return flattenTree(tree, collapsed);
    const withActive = new Set(collapsed);
    withActive.add(activeId);
    return flattenTree(tree, withActive);
  }, [tree, collapsed, activeId]);
  // EVERY visible row (root included) so dnd-kit can resolve each row's index; the
  // root row's useSortable is `disabled`, so it can be neither dragged nor dropped.
  const rowIds = React.useMemo(() => flat.map((f) => f.node.id), [flat]);

  const projection: Projection | null =
    activeId && overId ? projectDrop(flat, activeId, overId, offsetX, INDENT) : null;

  const resetDrag = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  };

  const dndContextProps: LayerTree['dndContextProps'] = {
    id: dndId,
    sensors,
    collisionDetection: closestCenter,
    measuring: { droppable: { strategy: MeasuringStrategy.Always } },
    onDragStart: (e: DragStartEvent) => {
      setActiveId(String(e.active.id));
      setOverId(String(e.active.id));
      setOffsetX(0);
    },
    onDragMove: (e: DragMoveEvent) => setOffsetX(e.delta.x),
    onDragOver: (e: DragOverEvent) => setOverId(e.over ? String(e.over.id) : null),
    onDragEnd: (e: DragEndEvent) => {
      const active = String(e.active.id);
      const over = e.over ? String(e.over.id) : null;
      if (over) {
        const proj = projectDrop(flat, active, over, e.delta.x, INDENT);
        if (proj && (!validateMove || validateMove(active, proj.parentId)))
          onMove(active, proj.parentId, proj.index);
      }
      resetDrag();
    },
    onDragCancel: resetDrag,
  };

  return {
    collapsed,
    toggle,
    expandAll,
    collapseAll,
    flat,
    rowIds,
    activeId,
    projection,
    layersRef,
    dndContextProps,
  };
}
