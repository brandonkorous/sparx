'use client';

// The unified studio's Layers tree (docs/builder/03 §2.1) — ONE structural view
// of the whole stack: the brand `Theme` root, the site `layout` chrome, and the
// active `page` grafted at the layout's Outlet ("Page content"). It mirrors the
// per-surface LayersPanel (flat list + one dnd SortableContext, the layers-tree.ts
// projection) but composes two trees and tags every row with its OWNERSHIP ZONE,
// so the author can see — and the editor can route by — which store a node belongs
// to.
//
//   ⚙ Theme              ← the brand/theme root (not a node; opens the Theme panel)
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
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Palette,
  X,
} from 'lucide-react';
import {
  DndContext,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@sparx/ui';
import {
  customKeyOf,
  isCustomType,
  type BindingCatalog,
  type ComponentDto,
} from '@sparx/builder-schemas';

import { updateNode, type BuilderNode } from './model';
import { NO_SCOPE, cardinalityForPath, moduleColor, moduleForPath } from './binding-catalog';
import { acceptsChildren, getDef } from './registry';
import {
  ancestorIds,
  collapsibleIds,
  descendantIds,
  flattenTree,
  projectDrop,
  type FlatNode,
  type Projection,
} from './layers-tree';
import { findOutletId } from './studio-routing';
import type { StudioSelection, StudioZone } from './use-studio-editor';

const INDENT = 16;
const COLLAPSE_STORE = 'sparx.builder.studio.layers.collapsed.v1:';

function loadCollapsed(treeId: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORE + treeId);
    if (!raw) return null;
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function saveCollapsed(treeId: string, ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(COLLAPSE_STORE + treeId, JSON.stringify([...ids]));
  } catch {
    /* private mode / quota — collapse state is a nicety */
  }
}

function bindMeta(
  node: BuilderNode,
  catalog: BindingCatalog
): { path: string; color: string; repeats: boolean } | null {
  if (!node.binding) return null;
  const path = node.binding.path;
  const color = moduleColor(moduleForPath(catalog, path));
  const repeats = path.startsWith('item')
    ? false
    : cardinalityForPath(catalog, NO_SCOPE, path) === 'array';
  return { path, color, repeats };
}

function Row({
  flat,
  zone,
  catalog,
  components,
  selected,
  collapsed,
  draggable,
  dragDepth,
  onSelect,
  onRemove,
  onToggle,
}: {
  flat: FlatNode;
  zone: 'layout' | 'page';
  catalog: BindingCatalog;
  components?: ReadonlyMap<string, ComponentDto>;
  selected: boolean;
  collapsed: boolean;
  draggable: boolean;
  dragDepth: number;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const { node } = flat;
  const def = getDef(node.type);
  const custom = isCustomType(node.type);
  const pinned = Boolean(def?.pinned);
  const canDrag = draggable && !pinned;
  const sortable = useSortable({ id: node.id, disabled: !canDrag });
  if (!def && !custom) return null;
  const customComp = custom ? components?.get(customKeyOf(node.type) ?? '') : undefined;
  const Icon = def?.icon ?? Boxes;
  const label = node.name ?? def?.label ?? customComp?.name ?? customKeyOf(node.type) ?? node.type;
  const bind = def ? bindMeta(node, catalog) : null;
  const hasCaret = !!def && acceptsChildren(node.type) && (node.children?.length ?? 0) > 0;

  const style: React.CSSProperties = {
    paddingLeft: 8 + dragDepth * INDENT,
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      {...(canDrag ? sortable.attributes : {})}
      {...(canDrag ? (sortable.listeners ?? {}) : {})}
      className={cn(
        'bx-layer',
        canDrag && 'bx-layer--draggable',
        selected && 'bx-layer--on',
        sortable.isDragging && 'bx-layer--dragging'
      )}
      style={style}
      data-layer-id={node.id}
      data-zone={zone}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(node.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      {hasCaret ? (
        <button
          type="button"
          className="bx-layer__caret"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          aria-expanded={!collapsed}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
        >
          {collapsed ? <ChevronRight aria-hidden /> : <ChevronDown aria-hidden />}
        </button>
      ) : (
        <span className="bx-layer__caret bx-layer__caret--spacer" aria-hidden />
      )}
      <Icon className="bx-layer__icon" aria-hidden />
      <span className="bx-layer__name">{label}</span>
      <span className="bx-layer__zone" data-zone={zone} aria-hidden>
        {zone === 'page' ? 'Page' : 'Layout'}
      </span>
      {custom ? <span className="bx-layer__component">component</span> : null}
      {bind ? (
        <span className="bx-layer__chip" style={{ color: bind.color }}>
          <span className="bx-layer__dot" style={{ background: bind.color }} />
          {bind.path}
        </span>
      ) : null}
      {bind?.repeats ? <span className="bx-layer__repeat">↻</span> : null}
      {canDrag ? (
        <button
          type="button"
          className="bx-layer__remove"
          aria-label="Remove layer"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(node.id);
          }}
        >
          <X aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function StudioLayers({
  layoutTree,
  pageTree,
  layoutCatalog,
  pageCatalog,
  components,
  selection,
  pageLabel,
  onSelectTheme,
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
  onSelectTheme: () => void;
  onSelectNode: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (dragId: string, parentId: string, index: number) => void;
}) {
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

  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(
    () => new Set(collapsibleIds(composed))
  );
  const composedRef = React.useRef(composed);
  composedRef.current = composed;
  const collapsedRef = React.useRef(collapsed);
  collapsedRef.current = collapsed;
  const layersRef = React.useRef<HTMLDivElement>(null);

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [offsetX, setOffsetX] = React.useState(0);

  const dndId = React.useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const selectedId = selection.zone === 'theme' ? null : selection.id;

  const commit = React.useCallback((next: ReadonlySet<string>) => {
    setCollapsed(next);
    saveCollapsed(composedRef.current.id, next);
  }, []);

  // Restore collapse state on mount + when the layout root changes (a different
  // site). Keyed on the composed root (the layout) — the page graft rides along.
  React.useEffect(() => {
    const saved = loadCollapsed(layoutTree.id);
    setCollapsed(saved ? new Set(saved) : new Set(collapsibleIds(composedRef.current)));
  }, [layoutTree.id]);

  // Reveal + scroll the selected row (select→reveal, both directions).
  React.useEffect(() => {
    if (!selectedId) return;
    const trail = ancestorIds(composedRef.current, selectedId);
    if (trail.some((id) => collapsedRef.current.has(id))) {
      const next = new Set(collapsedRef.current);
      for (const id of trail) next.delete(id);
      commit(next);
    }
  }, [selectedId, commit]);

  React.useEffect(() => {
    if (!selectedId) return;
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

  const expandAll = () => commit(new Set());
  const collapseAll = () => commit(new Set(collapsibleIds(composedRef.current)));

  const flat = React.useMemo(() => {
    if (!activeId) return flattenTree(composed, collapsed);
    const withActive = new Set(collapsed);
    withActive.add(activeId);
    return flattenTree(composed, withActive);
  }, [composed, collapsed, activeId]);

  const rowIds = React.useMemo(() => flat.map((f) => f.node.id), [flat]);

  const projection: Projection | null =
    activeId && overId ? projectDrop(flat, activeId, overId, offsetX, INDENT) : null;

  const resetDrag = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setOverId(String(e.active.id));
    setOffsetX(0);
  };
  const onDragMove = (e: DragMoveEvent) => setOffsetX(e.delta.x);
  const onDragOver = (e: DragOverEvent) => setOverId(e.over ? String(e.over.id) : null);
  const onDragEnd = (e: DragEndEvent) => {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (over) {
      const proj = projectDrop(flat, active, over, e.delta.x, INDENT);
      // Zone gate: only commit a move that stays inside the dragged node's zone, so
      // nothing crosses the Outlet boundary (the studio router would reject it as a
      // mis-routed save anyway — this keeps the drop indicator honest).
      if (proj && zoneOf(active) === zoneOf(proj.parentId))
        onMove(active, proj.parentId, proj.index);
    }
    resetDrag();
  };

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
      {/* The Theme root (docs/builder/03 §2.3) — the brand/theme context that wraps
          the whole stack. Not a node: it can't be dragged, removed, or nested;
          selecting it opens the Theme panel. */}
      <button
        type="button"
        className={cn('bx-layers__home', selection.zone === 'theme' && 'bx-layers__home--on')}
        aria-pressed={selection.zone === 'theme'}
        onClick={onSelectTheme}
      >
        <span className="bx-layer__caret bx-layer__caret--spacer" aria-hidden />
        <Palette className="bx-layer__icon" aria-hidden />
        <span className="bx-layer__name">Theme</span>
        <span className="bx-layer__zone" data-zone="theme" aria-hidden>
          Brand
        </span>
      </button>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={resetDrag}
      >
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
              <Row
                key={f.node.id}
                flat={labelOverride ? { ...f, node: { ...f.node, name: labelOverride } } : f}
                zone={zone}
                catalog={zone === 'page' ? pageCatalog : layoutCatalog}
                components={components}
                selected={selectedId === f.node.id && selection.zone === zone}
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
