// Pure tree↔flat-list machinery for the Layers panel's collapse + drag-reorder
// (docs/45). The Layers tree renders as a FLAT list (one row per visible node) so
// a single dnd-kit SortableContext can drive both sibling reorder AND
// re-parenting from one drag. This module owns the conversions, the small id
// helpers (collapse-all / auto-reveal), and the drag PROJECTION — which parent +
// index a drag currently targets, constrained so a node only ever nests under a
// container that can actually hold it. Everything here is pure (no React, no
// Date/random), so it stays trivially testable and SSR-safe.

import { type BuilderNode } from './model';
import { acceptsChildren } from './registry';

export interface FlatNode {
  node: BuilderNode;
  /** Root = 0, its children = 1, … (drives indentation + projection). */
  depth: number;
  /** This node's parent id, or null for the root. */
  parentId: string | null;
}

/** Depth-first flatten into render order. A node in `collapsed` keeps its own row
 *  but contributes none of its descendants — collapsing hides a subtree from both
 *  the view and the drag list. (During a drag the active node is added to
 *  `collapsed` so it travels as one unit and never projects against its own
 *  children.) */
export function flattenTree(root: BuilderNode, collapsed: ReadonlySet<string>): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (node: BuilderNode, depth: number, parentId: string | null) => {
    out.push({ node, depth, parentId });
    if (collapsed.has(node.id)) return;
    for (const child of node.children ?? []) walk(child, depth + 1, node.id);
  };
  walk(root, 0, null);
  return out;
}

/** Every node id beneath `node` (excluding `node` itself). */
export function descendantIds(node: BuilderNode): string[] {
  const out: string[] = [];
  for (const child of node.children ?? []) out.push(child.id, ...descendantIds(child));
  return out;
}

/** Ids of every node that CAN hold children (a container, or a children-accepting
 *  leaf like Button) AND currently has at least one — i.e. the rows that get a
 *  disclosure caret. Seeds "Collapse all". The root is excluded so the tree never
 *  collapses to nothing. */
export function collapsibleIds(root: BuilderNode): string[] {
  const out: string[] = [];
  const walk = (node: BuilderNode, isRoot: boolean) => {
    const kids = node.children ?? [];
    if (!isRoot && kids.length > 0 && acceptsChildren(node.type)) out.push(node.id);
    for (const child of kids) walk(child, false);
  };
  walk(root, true);
  return out;
}

/** Ancestors of `id`, root→…→parent (excluding `id` itself). [] if not found. */
export function ancestorIds(root: BuilderNode, id: string): string[] {
  const trail: string[] = [];
  const walk = (node: BuilderNode): boolean => {
    if (node.id === id) return true;
    for (const child of node.children ?? []) {
      trail.push(node.id);
      if (walk(child)) return true;
      trail.pop();
    }
    return false;
  };
  return walk(root) ? trail : [];
}

// ── Drag projection (re-parenting + reorder) ──────────────────────────────────

export interface Projection {
  /** Resolved parent for the drop. */
  parentId: string;
  /** Insertion index within that parent's children, AFTER the dragged node is
   *  pulled out of its current spot — exactly what moveNode expects. */
  index: number;
  /** Target depth — drives the drop indicator's indentation while dragging. */
  depth: number;
}

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

const maxDepthBelow = (prev: FlatNode | undefined): number =>
  prev ? (acceptsChildren(prev.node.type) ? prev.depth + 1 : prev.depth) : 1;

/**
 * Where a drag currently targets. `flat` is the flattened tree with the active
 * node still present but its descendants hidden (pass `collapsed ∪ {activeId}` to
 * flattenTree). Mirrors the well-trodden dnd-kit "sortable tree" projection — move
 * the active row to the hovered slot, read the row now above it, and let the
 * horizontal drag offset choose a depth — with one sparx constraint: you can only
 * nest one level deeper than the row above when that row CAN hold children
 * (`acceptsChildren`); otherwise you become its sibling. So a Section can never
 * land inside a Heading.
 *
 * Returns null when it can't resolve (empty list / unknown ids) — the caller
 * treats that as "no move".
 */
export function projectDrop(
  flat: FlatNode[],
  activeId: string,
  overId: string,
  dragOffsetX: number,
  indentWidth: number
): Projection | null {
  const overIndex = flat.findIndex((f) => f.node.id === overId);
  const activeIndex = flat.findIndex((f) => f.node.id === activeId);
  if (overIndex < 0 || activeIndex < 0) return null;
  const active = flat[activeIndex]!;
  const rootId = flat[0]!.node.id;

  const moved = arrayMove(flat, activeIndex, overIndex);
  const previous = moved[overIndex - 1];
  const next = moved[overIndex + 1];

  const dragDepth = Math.round(dragOffsetX / indentWidth);
  const projected = active.depth + dragDepth;
  const maxDepth = maxDepthBelow(previous);
  const minDepth = next ? next.depth : 1;
  let depth = projected;
  if (depth > maxDepth) depth = maxDepth;
  if (depth < minDepth) depth = minDepth;
  if (depth < 1) depth = 1; // everything stays under the root

  let parentId: string;
  if (!previous) parentId = rootId;
  else if (depth > previous.depth)
    parentId = previous.node.id; // nest into the row above
  else if (depth === previous.depth)
    parentId = previous.parentId ?? rootId; // its sibling
  else
    parentId =
      moved
        .slice(0, overIndex)
        .reverse()
        .find((f) => f.depth === depth)?.parentId ?? rootId;

  // Insertion index = how many of the target parent's existing children sit above
  // the active row in the reordered list. The active row is AT overIndex (never
  // counted), so this is the post-removal index moveNode wants.
  let index = 0;
  for (let i = 0; i < overIndex; i += 1) {
    if (moved[i]!.parentId === parentId) index += 1;
  }

  return { parentId, index, depth };
}
