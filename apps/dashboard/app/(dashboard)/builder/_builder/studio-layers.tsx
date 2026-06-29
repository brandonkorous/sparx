'use client';

// The unified studio's Layers tree (docs/builder/03 §2.1) — ONE structural view
// of the whole stack: the site `layout` chrome and the active `page` grafted at the
// layout's Outlet ("Page content"). It mirrors the per-surface LayersPanel (flat
// list + one dnd SortableContext, the layers-tree.ts projection) but composes two
// trees and tags every row with its OWNERSHIP ZONE, so the author can see — and the
// editor can route by — which store a node belongs to.
//
//   ▾ Site layout        ← the active layout root (layout zone)
//     ▸ Header
//     ▾ Page content     ← the Outlet (layout zone)
//       ▾ Home           ← the active page root (page zone) — grafted here
//         ▸ Hero
//     ▸ Footer
//
// Drag is constrained WITHIN a zone: a drop whose target parent is in a different
// zone than the dragged node is dropped (no-op), so a node can never cross the
// Outlet boundary — the studio router treats a mis-routed save as a data-loss bug
// (docs/builder/03 §6). The two tree roots (Site layout, the page) are never
// draggable.

import * as React from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { BindingCatalog, ComponentDto } from '@sparx/builder-schemas';

import { updateNode, type BuilderNode } from './model';
import { LayerRow } from './layers-row';
import { useLayerTree } from './use-layer-tree';
import { descendantIds } from './layers-tree';
import { findOutletId } from './studio-routing';
import type { StudioSelection, StudioZone } from './use-studio-editor';
import type { SelectMods } from './use-builder-editor';

const COLLAPSE_STORE = 'sparx.builder.studio.layers.collapsed.v1:';

export function StudioLayers({
  layoutTree,
  pageTree,
  layoutCatalog,
  pageCatalog,
  components,
  selection,
  pageLabel,
  onSelectNode,
  onRemove,
  onMove,
}: {
  layoutTree: BuilderNode;
  pageTree: BuilderNode | null;
  layoutCatalog: BindingCatalog;
  pageCatalog: BindingCatalog;
  components?: ReadonlyMap<string, ComponentDto>;
  selection: StudioSelection;
  /** The active page's display name, used to label its root row. */
  pageLabel: string;
  onSelectNode: (id: string, mods?: SelectMods) => void;
  onRemove: (id: string) => void;
  onMove: (dragId: string, parentId: string, index: number) => void;
}) {
  // Secondary-selected rows within the active zone (all selected except primary).
  const multiSet = React.useMemo(
    () => new Set(selection.ids.filter((id) => id !== selection.id)),
    [selection]
  );
  // The COMPOSED display tree: the page grafted in as the Outlet's child, so one
  // flat list + one SortableContext covers the whole stack. The graft is for
  // display + drag projection only — the editor still persists the two trees apart.
  const outletId = React.useMemo(() => findOutletId(layoutTree), [layoutTree]);
  const composed = React.useMemo(() => {
    if (!pageTree || !outletId) return layoutTree;
    return updateNode(layoutTree, outletId, (o) => ({ ...o, children: [pageTree] }));
  }, [layoutTree, pageTree, outletId]);

  // Page-owned ids = the grafted page root + its descendants. Everything else in
  // the composed tree is layout-owned. Drives the per-row zone tag + the drag gate.
  const pageIds = React.useMemo(
    () =>
      pageTree ? new Set<string>([pageTree.id, ...descendantIds(pageTree)]) : new Set<string>(),
    [pageTree]
  );
  const zoneOf = React.useCallback(
    (id: string): 'layout' | 'page' => (pageIds.has(id) ? 'page' : 'layout'),
    [pageIds]
  );
  // The two non-draggable roots: the layout root (composed root) and the page root.
  const rootIds = React.useMemo(
    () => new Set<string>([layoutTree.id, ...(pageTree ? [pageTree.id] : [])]),
    [layoutTree.id, pageTree]
  );

  const selectedId = selection.id;

  // Collapse + flat + dnd + select→reveal, SHARED with the per-surface LayersPanel
  // via useLayerTree (over the COMPOSED tree). The studio's one extra rule lives in
  // `validateMove`: a drop is committed only when it stays inside the dragged node's
  // zone, so nothing crosses the Outlet boundary (the studio router would reject a
  // mis-routed save anyway — this keeps the drop indicator honest).
  const {
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
  } = useLayerTree({
    tree: composed,
    collapseStore: COLLAPSE_STORE,
    selectedId,
    onMove,
    validateMove: (active, parentId) => zoneOf(active) === zoneOf(parentId),
  });

  return (
    <div className="bx-layers" ref={layersRef}>
      <div className="bx-layers__bar">
        <button type="button" className="bx-layers__act" onClick={expandAll} title="Expand all">
          <ChevronsUpDown aria-hidden /> Expand all
        </button>
        <button type="button" className="bx-layers__act" onClick={collapseAll} title="Collapse all">
          <ChevronsDownUp aria-hidden /> Collapse all
        </button>
      </div>
      <DndContext {...dndContextProps}>
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          {flat.map((f) => {
            const zone = zoneOf(f.node.id);
            const isActive = f.node.id === activeId;
            // The composed root (layout) and the page root are never draggable; the
            // layout root is also relabeled "Site layout" for the stacked reading.
            const draggable = !rootIds.has(f.node.id);
            const labelOverride =
              f.node.id === layoutTree.id
                ? 'Site layout'
                : f.node.id === pageTree?.id
                  ? pageLabel
                  : null;
            return (
              <LayerRow
                key={f.node.id}
                flat={labelOverride ? { ...f, node: { ...f.node, name: labelOverride } } : f}
                zone={zone}
                catalog={zone === 'page' ? pageCatalog : layoutCatalog}
                components={components}
                selected={selectedId === f.node.id && selection.zone === zone}
                multi={multiSet.has(f.node.id) && selection.zone === zone}
                collapsed={collapsed.has(f.node.id)}
                draggable={draggable}
                dragDepth={isActive && projection ? projection.depth : f.depth}
                onSelect={onSelectNode}
                onRemove={onRemove}
                onToggle={toggle}
              />
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

/** Re-exported for the shell's zone indicator. */
export type { StudioZone };
