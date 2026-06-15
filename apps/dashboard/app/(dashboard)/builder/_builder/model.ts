// The Site Builder node model — the backbone of /builder.
//
// The node SHAPE, box/layout/binding sub-shapes, the token-scale enums, and
// their defaults are defined ONCE in @sparx/builder-schemas (the serializable
// contract the backend matches — docs/41) and re-exported here, so the editor
// keeps importing them from `./model`. This file adds only the UI-side concerns
// the schema doesn't need: binding RESOLUTION, the in-memory page-template
// shape, immutable tree ops, fresh-node ids, and the inspector option tables.

// ── Canonical node-model types (defined in @sparx/builder-schemas) ────────────

export type { Binding, BuilderNode, Device } from '@sparx/builder-schemas';
// The class-first authoring vocabulary (docs/61) — the ergonomic box/layout DTO
// the editor's controls + seed data compile to a `class` string.
export {
  boxLayoutClass,
  legacyButtonStyleToClass,
  type BoxStyle,
  type LayoutStyle,
} from '@sparx/builder-schemas';

// Binding RESOLUTION lives with the model now (docs/44 §2.3) so the editor and
// the storefront renderer share one implementation. Re-exported here so the
// editor keeps importing `resolvePath` / `cardinalityOf` / `Scope` from './model'.
export { resolvePath, cardinalityOf } from '@sparx/builder-schemas';
export type { Cardinality, DataSources, Scope } from '@sparx/builder-schemas';

// The subset this file references in scope (the DEVICE option table + tree ops).
import type { BuilderNode, Device } from '@sparx/builder-schemas';

// ── Page templates (the editor's in-memory page shape) ────────────────────────

/** A page template = a named node tree the editor edits. The PERSISTED shape is
 *  BuilderPageDto (@sparx/builder-schemas) — this is the trimmed working copy.
 *   · singleton  — one specific page (Home, About); content authored inline.
 *   · collection — one template that renders EVERY record of a content type
 *                  (Product page → every product); nodes bind to `recordType`'s
 *                  fields and each record fills the same template. */
export interface PageTemplate {
  id: string;
  name: string;
  /** The storefront URL a published singleton page serves at (docs/44). Null
   *  for collection templates + unrouted pages. */
  slug: string | null;
  kind: 'singleton' | 'collection';
  /** For collection templates: the content type each record comes from
   *  (e.g. 'cms.post', 'commerce.product'). */
  recordType?: string;
  /** Whether this collection template is the DEFAULT for its recordType
   *  (docs/51 §6) — the per-type winner the storefront renders absent a
   *  per-record override. */
  isDefault: boolean;
  tree: BuilderNode;
  /** SEO for a published singleton (docs/50). Empty strings (not null) so the
   *  inspector's inputs stay controlled; the service stores '' as null. */
  seo: PageSeo;
}

/** The editable SEO fields for a singleton page. Mirrors the BuilderPageDto SEO
 *  columns, with nullable strings collapsed to '' for controlled inputs. */
export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  noindex: boolean;
}

// ── Immutable tree operations (addressed by node id) ─────────────────────────

export function findNode(root: BuilderNode, id: string): BuilderNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

/** Return a new tree with the node `id` replaced by `updater(node)`. */
export function updateNode(
  root: BuilderNode,
  id: string,
  updater: (node: BuilderNode) => BuilderNode
): BuilderNode {
  if (root.id === id) return updater(root);
  if (!root.children) return root;
  let changed = false;
  const children = root.children.map((child) => {
    const next = updateNode(child, id, updater);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

/** Remove the node `id` (and its subtree). The root itself is never removed. */
export function removeNode(root: BuilderNode, id: string): BuilderNode {
  if (!root.children) return root;
  const kept = root.children.filter((c) => c.id !== id).map((c) => removeNode(c, id));
  return { ...root, children: kept };
}

/** Append `child` to the children of container `parentId`. */
export function appendChild(root: BuilderNode, parentId: string, child: BuilderNode): BuilderNode {
  return updateNode(root, parentId, (parent) => ({
    ...parent,
    children: [...(parent.children ?? []), child],
  }));
}

/** Move `dragId` to be a child of `parentId`, inserted at `index` within that
 *  parent's children (the list AFTER the dragged node is pulled out of wherever
 *  it currently sits). Drives the Layers tree's drag-reorder + re-parenting.
 *
 *  Returns the tree UNCHANGED when the move is illegal, so a bad drop is a no-op
 *  rather than a corruption:
 *    · moving the root (it has no parent),
 *    · an unknown drag/parent id, or
 *    · dropping a node into its own subtree (a cycle — `parentId` is the node
 *      itself or one of its descendants). */
export function moveNode(
  root: BuilderNode,
  dragId: string,
  parentId: string,
  index: number
): BuilderNode {
  if (dragId === root.id) return root;
  const dragged = findNode(root, dragId);
  if (!dragged) return root;
  // Cycle guard: `parentId` must live OUTSIDE the dragged subtree (findNode on the
  // subtree also catches parentId === dragId).
  if (findNode(dragged, parentId)) return root;
  if (!findNode(root, parentId)) return root;
  const without = removeNode(root, dragId);
  return updateNode(without, parentId, (parent) => {
    const children = [...(parent.children ?? [])];
    const at = Math.max(0, Math.min(index, children.length));
    children.splice(at, 0, dragged);
    return { ...parent, children };
  });
}

/** Find the parent node of `id`, or null if `id` is the root / not found. */
export function findParent(root: BuilderNode, id: string): BuilderNode | null {
  for (const child of root.children ?? []) {
    if (child.id === id) return root;
    const hit = findParent(child, id);
    if (hit) return hit;
  }
  return null;
}

/** Depth-first PRE-ORDER list of every node id (root first). The canonical
 *  document order — drives range-select (shift-click spans this order) and the
 *  preorder normalization of a multi-node move/duplicate, so bulk ops keep the
 *  visual top-to-bottom order regardless of click order. */
export function preorderIds(root: BuilderNode): string[] {
  const out: string[] = [root.id];
  for (const child of root.children ?? []) out.push(...preorderIds(child));
  return out;
}

/** The contiguous span of ids between `a` and `b` (inclusive) in document order
 *  — the set a shift-click selects from the anchor to the clicked node. Order of
 *  the args doesn't matter. Empty when either id isn't in the tree. */
export function idRange(root: BuilderNode, a: string, b: string): string[] {
  const order = preorderIds(root);
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  if (i === -1 || j === -1) return [];
  return order.slice(Math.min(i, j), Math.max(i, j) + 1);
}

/** Reduce a selection set to its TOP-LEVEL members — ids whose ancestors are not
 *  themselves selected — in document order. Moving/duplicating a parent already
 *  carries its children, so a bulk op acts only on these roots (selecting a
 *  container AND a node inside it moves the container once, not both). The root
 *  is never included (it isn't movable). */
export function topLevelSelected(root: BuilderNode, ids: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const walk = (node: BuilderNode, ancestorSelected: boolean) => {
    const selected = ids.has(node.id);
    if (selected && !ancestorSelected && node.id !== root.id) out.push(node.id);
    for (const child of node.children ?? []) walk(child, ancestorSelected || selected);
  };
  walk(root, false);
  return out;
}

/** Insert `node` immediately AFTER the sibling `afterId` (same parent). A no-op
 *  if `afterId` is the root or not found. Drives "duplicate" (the clone lands
 *  next to its original) and same-parent paste. */
export function insertAfter(root: BuilderNode, afterId: string, node: BuilderNode): BuilderNode {
  const parent = findParent(root, afterId);
  if (!parent) return root;
  return updateNode(root, parent.id, (p) => {
    const children = [...(p.children ?? [])];
    const at = children.findIndex((c) => c.id === afterId);
    if (at === -1) return p;
    children.splice(at + 1, 0, node);
    return { ...p, children };
  });
}

/** Move SEVERAL nodes to be children of `parentId` at `index`, preserving their
 *  document order. The multi-select counterpart of `moveNode`: it normalizes the
 *  set to its top-level members (an already-carried descendant is dropped), then
 *  pulls them all out and splices them in together — so a bulk canvas/layers drag
 *  lands as one contiguous run.
 *
 *  Returns the tree UNCHANGED (a no-op) when the move is illegal for the same
 *  reasons as `moveNode`: an unknown parent, or `parentId` living inside any of
 *  the moved subtrees (a cycle). `index` is interpreted against the child list
 *  AFTER the dragged nodes are removed, matching `moveNode`. */
export function moveNodes(
  root: BuilderNode,
  dragIds: readonly string[],
  parentId: string,
  index: number
): BuilderNode {
  const tops = topLevelSelected(root, new Set(dragIds));
  if (tops.length === 0) return root;
  if (!findNode(root, parentId)) return root;
  const dragged: BuilderNode[] = [];
  for (const id of tops) {
    const node = findNode(root, id);
    if (!node) continue;
    // The drop target can't be one of the moved nodes, nor inside any of them.
    if (id === parentId || findNode(node, parentId)) return root;
    dragged.push(node);
  }
  if (dragged.length === 0) return root;
  let without = root;
  for (const node of dragged) without = removeNode(without, node.id);
  return updateNode(without, parentId, (parent) => {
    const children = [...(parent.children ?? [])];
    const at = Math.max(0, Math.min(index, children.length));
    children.splice(at, 0, ...dragged);
    return { ...parent, children };
  });
}

/** Deep-clone a subtree with EVERY id regenerated, so the clone can coexist with
 *  its original (duplicate) or be pasted into another tree without an id clash.
 *  (`ensureUniqueIds` only re-ids true duplicates — a clone needs all-fresh ids.)
 *  Names/props/binding/class are copied verbatim. */
export function cloneWithFreshIds(node: BuilderNode): BuilderNode {
  const next: BuilderNode = { ...node, id: makeId(node.type) };
  if (node.children) next.children = node.children.map(cloneWithFreshIds);
  return next;
}

let idCounter = 0;
/** Stable-ish unique id for newly added nodes (client-only). Persisted with the
 *  tree on save, so on reload the id comes back from the server as plain data. */
export function makeId(type: string): string {
  idCounter += 1;
  return `${type.toLowerCase()}-${idCounter}-${idCounter * 31 + 7}`;
}

// ── Option tables (drive the inspector controls) ─────────────────────────────
// The box/layout option tables retired with the box model (docs/61) — arrangement
// + skin are authored as `class` via the control registry (class-controls.ts).
// Only the device switcher (canvas responsive preview) remains here.

export const DEVICE_OPTIONS: { value: Device; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];
