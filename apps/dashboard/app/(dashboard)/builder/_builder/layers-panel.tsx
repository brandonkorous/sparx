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
  Boxes,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  SlidersHorizontal,
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

// Per-tree collapse state is remembered in localStorage, keyed by the tree's root
// id (stable per page/layout, distinct across them). New trees start collapsed —
// the default below — until the user expands something.
const COLLAPSE_STORE = 'sparx.builder.layers.collapsed.v1:';

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
    /* private mode / quota — collapse state is a nicety, not worth surfacing */
  }
}

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
  components,
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
  components?: ReadonlyMap<string, ComponentDto>;
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
  const custom = isCustomType(node.type);
  // A pinned node (the email_wordmark header, docs/52 §1) is present by
  // construction: still selectable + editable, but it can't be dragged or removed.
  const pinned = Boolean(def?.pinned);
  const canDrag = draggable && !pinned;
  const sortable = useSortable({ id: node.id, disabled: !canDrag });
  if (!def && !custom) return null;
  // A `custom:*` placement (docs/53 P-B) has no registry def — label it from the
  // resolved component (or its key) and use a generic component glyph.
  const customComp = custom ? components?.get(customKeyOf(node.type) ?? '') : undefined;
  const Icon = def?.icon ?? Boxes;
  const label = node.name ?? def?.label ?? customComp?.name ?? customKeyOf(node.type) ?? node.type;
  const bind = def ? bindMeta(node, catalog) : null;
  const hasCaret =
    draggable && !!def && acceptsChildren(node.type) && (node.children?.length ?? 0) > 0;

  const style: React.CSSProperties = {
    paddingLeft: 8 + dragDepth * INDENT,
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      // The WHOLE row is the drag target (no separate grip handle) — the house
      // pattern (drag the card, not a handle). A 4px PointerSensor activation
      // distance keeps a plain click selecting; the caret + remove buttons
      // stopPropagation on pointerdown so they never start a drag. Disabled rows
      // (root, pinned header — docs/52 §1) get no-op listeners. Dropping the grip
      // ALSO removes the ~13px column it reserved on every row, which was the real
      // cause of the tree reading as over-indented.
      {...(canDrag ? sortable.attributes : {})}
      {...(canDrag ? (sortable.listeners ?? {}) : {})}
      className={cn(
        'bx-layer',
        canDrag && 'bx-layer--draggable',
        node.id === selectedId && 'bx-layer--on',
        sortable.isDragging && 'bx-layer--dragging'
      )}
      style={style}
      data-layer-id={node.id}
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
      <Icon className="bx-layer__icon" aria-hidden />
      <span className="bx-layer__name">{label}</span>
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

export function LayersPanel({
  tree,
  catalog,
  components,
  selectedId,
  homeLabel,
  onSelect,
  onRemove,
  onMove,
}: {
  tree: BuilderNode;
  catalog: BindingCatalog;
  /** Tenant components keyed by key (docs/53 P-B) — labels `custom:*` rows. */
  components?: ReadonlyMap<string, ComponentDto>;
  selectedId: string | null;
  /** Label for the settings-home row pinned atop the tree ("Page" / "Site").
   *  Selecting it clears the selection → the inspector shows that surface's
   *  settings (URL + SEO for a page). */
  homeLabel: string;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  /** Re-parent / reorder: move `dragId` to be child `index` of `parentId`. */
  onMove: (dragId: string, parentId: string, index: number) => void;
}) {
  // Collapse state starts COLLAPSED BY DEFAULT (every collapsible row). This
  // initializer is deterministic from `tree`, so SSR and the first client render
  // match; the localStorage load below then overrides it post-mount (client only),
  // avoiding a hydration mismatch.
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

  // Stable, SSR-safe id for the DndContext. Without it, dnd-kit falls back to a
  // module-level counter for its a11y description nodes (`DndDescribedBy-N`),
  // which numbers differently on the server vs the client and trips a hydration
  // mismatch warning. `useId()` is deterministic across both renders.
  const dndId = React.useId();

  const sensors = useSensors(
    // A small activation distance lets a plain click still select (no drag) while
    // a deliberate drag picks the row up.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Set + remember collapse state. Persistence lives here (in the actual
  // mutators), not in a state-watching effect — so the post-mount load below can
  // restore state WITHOUT a stale write clobbering it.
  const commit = React.useCallback((next: ReadonlySet<string>) => {
    setCollapsed(next);
    saveCollapsed(treeRef.current.id, next);
  }, []);

  // Restore this tree's saved collapse state on mount, and again when switching to
  // a different page/layout. No saved state → collapsed-by-default. (Load only;
  // never writes, so it can't clobber what it just read.)
  React.useEffect(() => {
    const saved = loadCollapsed(tree.id);
    setCollapsed(saved ? new Set(saved) : new Set(collapsibleIds(treeRef.current)));
  }, [tree.id]);

  // Selecting a node (often from the canvas) reveals its row by expanding any
  // collapsed ancestor, and scrolls that row into view.
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
  // makes it a no-op when the row is already visible, so clicking a row never makes
  // the tree jump. Re-runs when the visible rows change (after a reveal expands an
  // ancestor) so the freshly shown row gets scrolled to.
  React.useEffect(() => {
    if (!selectedId) return;
    // `window.CSS` — the dnd-kit `CSS` transform helper shadows the global name here.
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
  const collapseAll = () => commit(new Set(collapsibleIds(treeRef.current)));

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
            const isRoot = f.parentId === null;
            const isActive = f.node.id === activeId;
            return (
              <Row
                key={f.node.id}
                flat={f}
                catalog={catalog}
                components={components}
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
