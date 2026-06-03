'use client';

// The Layers tree — the structural view of the page/layout. Every node shows its
// name, a binding chip (color-coded by the module that supplies the data) and a
// ↻ badge when it iterates. Clicking selects; the same selection drives the
// canvas and inspector.
//
// The tree renders as a FLAT list (one row per visible node, indented by depth)
// so a single dnd-kit SortableContext drives BOTH sibling reorder and
// re-parenting from one drag — see layers-tree.ts for the flatten + projection.
// Each container row has a disclosure caret (collapse hides its subtree); the
// panel header offers expand-all / collapse-all, and selecting a node from the
// canvas auto-reveals its row.

import * as React from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
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
import type { BindingCatalog } from '@sparx/builder-schemas';

import { type BuilderNode } from './model';
import { NO_SCOPE, cardinalityForPath, moduleColor, moduleForPath } from './binding-catalog';
import { acceptsChildren, getDef } from './registry';
import {
  ancestorIds,
  collapsibleIds,
  flattenTree,
  projectDrop,
  type FlatNode,
  type Projection,
} from './layers-tree';

// One indentation step, in px — shared by the row padding AND the drag projection
// (a ~one-step horizontal drag re-parents one level), so the depth you see while
// dragging is the depth you get.
const INDENT = 16;

function bindMeta(
  node: BuilderNode,
  catalog: BindingCatalog
): { path: string; color: string; repeats: boolean } | null {
  if (!node.binding) return null;
  const path = node.binding.path;
  const color = moduleColor(moduleForPath(catalog, path));
  // Best-effort cardinality for the ↻ badge (item.* can't be resolved here, so
  // it never shows the badge — its own iteration comes from an ancestor).
  const repeats = path.startsWith('item')
    ? false
    : cardinalityForPath(catalog, NO_SCOPE, path) === 'array';
  return { path, color, repeats };
}

function Row({
  flat,
  catalog,
  selectedId,
  collapsed,
  draggable,
  dragDepth,
  onSelect,
  onRemove,
  onToggle,
}: {
  flat: FlatNode;
  catalog: BindingCatalog;
  selectedId: string | null;
  collapsed: boolean;
  /** Root is shown but never dragged. */
  draggable: boolean;
  /** Depth to render at — the projected drop depth while this row is dragging,
   *  else its real depth. */
  dragDepth: number;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const { node } = flat;
  const def = getDef(node.type);
  const sortable = useSortable({ id: node.id, disabled: !draggable });
  if (!def) return null;
  const Icon = def.icon;
  const bind = bindMeta(node, catalog);
  const hasCaret = draggable && acceptsChildren(node.type) && (node.children?.length ?? 0) > 0;

  const style: React.CSSProperties = {
    paddingLeft: 8 + dragDepth * INDENT,
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      className={cn(
        'bx-layer',
        node.id === selectedId && 'bx-layer--on',
        sortable.isDragging && 'bx-layer--dragging'
      )}
      style={style}
      role="button"
      tabIndex={0}
      aria-pressed={node.id === selectedId}
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
      {draggable ? (
        <span
          className="bx-layer__grip"
          aria-hidden
          {...sortable.attributes}
          {...(sortable.listeners ?? {})}
        >
          <GripVertical />
        </span>
      ) : null}
      <Icon className="bx-layer__icon" aria-hidden />
      <span className="bx-layer__name">{node.box.name ?? def.label}</span>
      {bind ? (
        <span className="bx-layer__chip" style={{ color: bind.color }}>
          <span className="bx-layer__dot" style={{ background: bind.color }} />
          {bind.path}
        </span>
      ) : null}
      {bind?.repeats ? <span className="bx-layer__repeat">↻</span> : null}
      {draggable ? (
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

export function LayersPanel({
  tree,
  catalog,
  selectedId,
  onSelect,
  onRemove,
  onMove,
}: {
  tree: BuilderNode;
  catalog: BindingCatalog;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  /** Re-parent / reorder: move `dragId` to be child `index` of `parentId`. */
  onMove: (dragId: string, parentId: string, index: number) => void;
}) {
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set());
  // Live drag state — drives the projection (where the drop will land).
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [offsetX, setOffsetX] = React.useState(0);

  const sensors = useSensors(
    // A small activation distance lets a plain click still select (no drag) while
    // a deliberate drag picks the row up.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Selecting a node (often from the canvas) reveals its row by expanding any
  // collapsed ancestor.
  React.useEffect(() => {
    if (!selectedId) return;
    const trail = ancestorIds(tree, selectedId);
    setCollapsed((prev) => {
      if (!trail.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of trail) next.delete(id);
      return next;
    });
  }, [selectedId, tree]);

  const toggle = React.useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(collapsibleIds(tree)));

  // While dragging, hide the active node's subtree (add it to the collapse set)
  // so it travels as one unit and never projects against its own children.
  const flat = React.useMemo(() => {
    if (!activeId) return flattenTree(tree, collapsed);
    const withActive = new Set(collapsed);
    withActive.add(activeId);
    return flattenTree(tree, withActive);
  }, [tree, collapsed, activeId]);

  // The sortable context lists EVERY visible row (root included) so dnd-kit can
  // resolve each row's index; the root row's useSortable is `disabled`, so it can
  // be neither dragged nor dropped onto — only the descendants reorder.
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
      if (proj) onMove(active, proj.parentId, proj.index);
    }
    resetDrag();
  };

  return (
    <div className="bx-layers">
      <div className="bx-layers__bar">
        <button type="button" className="bx-layers__act" onClick={expandAll} title="Expand all">
          <ChevronsUpDown aria-hidden /> Expand all
        </button>
        <button type="button" className="bx-layers__act" onClick={collapseAll} title="Collapse all">
          <ChevronsDownUp aria-hidden /> Collapse all
        </button>
      </div>
      <DndContext
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
            const isRoot = f.parentId === null;
            const isActive = f.node.id === activeId;
            return (
              <Row
                key={f.node.id}
                flat={f}
                catalog={catalog}
                selectedId={selectedId}
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
