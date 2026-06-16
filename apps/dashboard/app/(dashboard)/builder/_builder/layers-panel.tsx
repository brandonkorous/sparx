'use client';

// The per-surface Layers tree — the structural view of a single page/site/email
// tree. Every node shows its name, a binding chip (color-coded by the module that
// supplies the data) and a ↻ badge when it iterates. Clicking selects; the same
// selection drives the canvas and inspector.
//
// The tree renders as a FLAT list (one row per visible node, indented by depth) so
// a single dnd-kit SortableContext drives BOTH sibling reorder and re-parenting
// from one drag. The row rendering + drag wiring live in `LayerRow` and the
// collapse/projection/dnd engine in `useLayerTree` — SHARED with the unified
// studio's `StudioLayers`, so the two panels can never drift (the studio once lost
// its rows' `setNodeRef` that way). This panel only adds its own chrome: the
// settings-home row and the expand/collapse bar.

import * as React from 'react';
import { ChevronsDownUp, ChevronsUpDown, SlidersHorizontal } from 'lucide-react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@sparx/ui';
import type { BindingCatalog, ComponentDto } from '@sparx/builder-schemas';

import { type BuilderNode } from './model';
import type { SelectMods } from './use-builder-editor';
import { LayerRow } from './layers-row';
import { useLayerTree } from './use-layer-tree';

const COLLAPSE_STORE = 'sparx.builder.layers.collapsed.v1:';

export function LayersPanel({
  tree,
  catalog,
  components,
  selectedId,
  selectedIds,
  homeLabel,
  onSelect,
  onRemove,
  onMove,
}: {
  tree: BuilderNode;
  catalog: BindingCatalog;
  /** Tenant components keyed by key (docs/53 P-B) — labels `custom:*` rows. */
  components?: ReadonlyMap<string, ComponentDto>;
  /** The PRIMARY selected id (the inspector's focus). */
  selectedId: string | null;
  /** The full multi-selection set (docs/builder/05 §2.2). Omitted ⇒ single select. */
  selectedIds?: string[];
  /** Label for the settings-home row pinned atop the tree ("Page" / "Site").
   *  Selecting it clears the selection → the inspector shows that surface's
   *  settings (URL + SEO for a page). */
  homeLabel: string;
  onSelect: (id: string | null, mods?: SelectMods) => void;
  onRemove: (id: string) => void;
  /** Re-parent / reorder: move `dragId` to be child `index` of `parentId`. */
  onMove: (dragId: string, parentId: string, index: number) => void;
}) {
  // Secondary-selected rows (everything selected except the primary).
  const multiSet = React.useMemo(
    () => new Set((selectedIds ?? []).filter((id) => id !== selectedId)),
    [selectedIds, selectedId]
  );

  // Collapse + flat + dnd + select→reveal, shared with StudioLayers. A single tree
  // (no zones) drops nothing on drag — every legal move commits (no `validateMove`).
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
  } = useLayerTree({ tree, collapseStore: COLLAPSE_STORE, selectedId, onMove });

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
      {/* Settings home — the always-present top of the tree. Selecting it clears
          the node selection so the inspector shows the page/site settings (URL +
          SEO). Not a draggable layer: it sits above the content, like a document
          root, so there's a stable "back to settings" target. */}
      <button
        type="button"
        className={cn('bx-layers__home', selectedId === null && 'bx-layers__home--on')}
        aria-pressed={selectedId === null}
        onClick={() => onSelect(null)}
      >
        {/* Reserve the same caret column the tree rows carry, so this home row's
            icon lines up with the ROOT row's icon (both top-level peers). */}
        <span className="bx-layer__caret bx-layer__caret--spacer" aria-hidden />
        <SlidersHorizontal className="bx-layer__icon" aria-hidden />
        <span className="bx-layer__name">{homeLabel} settings</span>
      </button>
      <DndContext {...dndContextProps}>
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          {flat.map((f) => {
            const isRoot = f.parentId === null;
            const isActive = f.node.id === activeId;
            return (
              <LayerRow
                key={f.node.id}
                flat={f}
                catalog={catalog}
                components={components}
                selected={f.node.id === selectedId}
                multi={multiSet.has(f.node.id)}
                collapsed={collapsed.has(f.node.id)}
                draggable={!isRoot}
                dragDepth={isActive && projection ? projection.depth : f.depth}
                onSelect={onSelect}
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
