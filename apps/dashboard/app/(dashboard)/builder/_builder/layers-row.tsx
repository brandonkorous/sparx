'use client';

// The shared Layers-tree ROW (docs/builder/03) — ONE source of truth for a single
// structural-tree row, used by BOTH the unified studio's zone-aware `StudioLayers`
// and the per-surface `LayersPanel`. Before this was extracted the two panels each
// carried their own copy of the row, and they drifted: the studio's copy lost its
// `ref={sortable.setNodeRef}`, so dnd-kit never measured those rows and tree drag
// silently never landed. Keeping the row (and especially its drag wiring) in one
// place makes that class of bug impossible — a fix here lands in both editors.
//
// The row is presentation + drag wiring; the OWNING panel computes per-row policy
// (which catalog, which zone, whether it's selected/draggable) and passes it in.

import * as React from 'react';
import { Boxes, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
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
import type { SelectMods } from './use-builder-editor';
import type { FlatNode } from './layers-tree';

// One indentation step, in px — shared by the row padding AND the drag projection
// (a ~one-step horizontal drag re-parents one level), so the depth you see while
// dragging is the depth you get.
export const INDENT = 16;

/** The binding chip shown on a bound row — color-coded by the module that supplies
 *  the data, with a ↻ badge when the binding iterates. Identical for both panels. */
export function bindMeta(
  node: BuilderNode,
  catalog: BindingCatalog
): { path: string; color: string; repeats: boolean } | null {
  const b = node.binding;
  if (!b) return null;
  // Entity / collection / action bindings (docs/98 Pillar 7) carry no field path —
  // show a friendly summary + the commerce/cms accent, and the ↻ badge for a repeater.
  if (!b.path) {
    const label = b.action
      ? `action · ${b.action}`
      : b.source
        ? `repeat · ${b.source.from === 'all' ? 'all products' : b.source.from}`
        : b.entity
          ? `${b.entity} · ${b.label ?? b.id ?? ''}`
          : '';
    return {
      path: label,
      color: moduleColor(b.entity === 'cms' ? 'cms' : 'commerce'),
      repeats: Boolean(b.source),
    };
  }
  const path = b.path;
  const color = moduleColor(moduleForPath(catalog, path));
  // Best-effort cardinality for the ↻ badge (item.* can't be resolved here, so it
  // never shows the badge — its own iteration comes from an ancestor).
  const repeats = path.startsWith('item')
    ? false
    : cardinalityForPath(catalog, NO_SCOPE, path) === 'array';
  return { path, color, repeats };
}

export interface LayerRowProps {
  flat: FlatNode;
  /** The binding catalog for THIS row's zone (the studio resolves it per zone). */
  catalog: BindingCatalog;
  /** Tenant components keyed by key (docs/53 P-B) — labels `custom:*` rows. */
  components?: ReadonlyMap<string, ComponentDto>;
  /** The owning store this row belongs to (studio only) — renders the zone tag. */
  zone?: 'layout' | 'page';
  selected: boolean;
  /** Part of a multi-selection but not the primary (docs/builder/05 §2.2). */
  multi: boolean;
  collapsed: boolean;
  /** Root rows are shown but never dragged. */
  draggable: boolean;
  /** Depth to render at — the projected drop depth while this row is dragging,
   *  else its real depth. */
  dragDepth: number;
  onSelect: (id: string, mods?: SelectMods) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}

export function LayerRow({
  flat,
  catalog,
  components,
  zone,
  selected,
  multi,
  collapsed,
  draggable,
  dragDepth,
  onSelect,
  onRemove,
  onToggle,
}: LayerRowProps) {
  const { node } = flat;
  const def = getDef(node.type);
  const custom = isCustomType(node.type);
  // A pinned node (the Outlet, the email_wordmark header — docs/52 §1) is present
  // by construction: still selectable + editable, but it can't be dragged or removed.
  const pinned = Boolean(def?.pinned);
  const canDrag = draggable && !pinned;
  // dnd-kit MUST hold the row's DOM node to measure it — without this ref the node
  // stays unmeasured (`activeNodeRect`/droppable rects null), so collision detection
  // never runs and a drag activates but can never land. A pinned node stays a live
  // droppable (so siblings can reorder before/after it) and is kept un-draggable by
  // withholding its drag listeners below (the `canDrag` gate); only true roots fully
  // disable their sortable, which the owning panel signals with `draggable={false}`.
  const sortable = useSortable({ id: node.id, disabled: !draggable });
  if (!def && !custom) return null;
  // A `custom:*` placement (docs/53 P-B) has no registry def — label it from the
  // resolved component (or its key) and use a generic component glyph.
  const customComp = custom ? components?.get(customKeyOf(node.type) ?? '') : undefined;
  const Icon = def?.icon ?? Boxes;
  const label = node.name ?? def?.label ?? customComp?.name ?? customKeyOf(node.type) ?? node.type;
  const bind = def ? bindMeta(node, catalog) : null;
  // A disclosure caret on every collapsible container — including non-draggable
  // ROOTS (the studio's "Site layout"/"Home" rows), so a whole subtree can be
  // folded. NOT gated on `draggable`: roots are un-draggable yet still collapsible.
  const hasCaret = !!def && acceptsChildren(node.type) && (node.children?.length ?? 0) > 0;

  const style: React.CSSProperties = {
    paddingLeft: 8 + dragDepth * INDENT,
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      // The WHOLE row is the drag target (no separate grip handle) — the house
      // pattern (drag the card, not a handle). A 4px PointerSensor activation
      // distance keeps a plain click selecting; the caret + remove buttons
      // stopPropagation on pointerdown so they never start a drag.
      ref={sortable.setNodeRef}
      {...(canDrag ? sortable.attributes : {})}
      {...(canDrag ? (sortable.listeners ?? {}) : {})}
      className={cn(
        'bx-layer',
        canDrag && 'bx-layer--draggable',
        selected && 'bx-layer--on',
        multi && 'bx-layer--multi',
        sortable.isDragging && 'bx-layer--dragging'
      )}
      style={style}
      data-layer-id={node.id}
      data-zone={zone}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={(e) => onSelect(node.id, { additive: e.metaKey || e.ctrlKey, range: e.shiftKey })}
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
      {zone ? (
        <span className="bx-layer__zone" data-zone={zone} aria-hidden>
          {zone === 'page' ? 'Page' : 'Layout'}
        </span>
      ) : null}
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
