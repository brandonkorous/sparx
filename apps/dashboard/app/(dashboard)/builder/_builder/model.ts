// The Site Builder node model — the backbone of /builder.
//
// The node SHAPE, box/layout/binding sub-shapes, the token-scale enums, and
// their defaults are defined ONCE in @sparx/builder-schemas (the serializable
// contract the backend matches — docs/41) and re-exported here, so the editor
// keeps importing them from `./model`. This file adds only the UI-side concerns
// the schema doesn't need: binding RESOLUTION, the in-memory page-template
// shape, immutable tree ops, fresh-node ids, and the inspector option tables.

// ── Canonical node-model types (defined in @sparx/builder-schemas) ────────────

export { DEFAULT_BOX, DEFAULT_LAYOUT } from '@sparx/builder-schemas';
export type {
  AlignItems,
  AlignX,
  Binding,
  BoxBase,
  BuilderNode,
  Device,
  Direction,
  GapScale,
  HeightScale,
  Justify,
  LayoutBase,
  SpaceScale,
  Surface,
  WidthMode,
} from '@sparx/builder-schemas';

// The subset this file references in scope (option tables + tree ops below).
import type {
  AlignX,
  BuilderNode,
  Device,
  Direction,
  GapScale,
  HeightScale,
  SpaceScale,
  Surface,
  WidthMode,
} from '@sparx/builder-schemas';

// ── Binding cardinality ───────────────────────────────────────────────────────

export type Cardinality = 'scalar' | 'object' | 'array' | 'empty';

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
  kind: 'singleton' | 'collection';
  /** For collection templates: the content type each record comes from
   *  (e.g. 'cms.post', 'commerce.product'). */
  recordType?: string;
  tree: BuilderNode;
}

// ── Data scope + binding resolution ──────────────────────────────────────────

/** The root data the page composes from — one key per active module. This is
 *  mock data in the UI-first phase; the backend will supply the real shapes. */
export type DataSources = Record<string, unknown>;

/** A resolution context: the module-level root, plus the current `item` when
 *  inside an iterating container (so descendants resolve `item.*`). */
export interface Scope {
  root: DataSources;
  item?: unknown;
  /** Zero-based position within the current iteration (for `index`). */
  index?: number;
}

/** Resolve a dotted/bracketed path against a scope. Paths beginning with
 *  `item` resolve against the iteration item; `index` is the loop counter;
 *  everything else resolves against the module root. */
export function resolvePath(scope: Scope, path: string): unknown {
  const trimmed = path.trim();
  if (trimmed === '') return undefined;
  if (trimmed === 'index') return scope.index;

  const segments = trimmed
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let cursor: unknown;
  if (segments[0] === 'item') {
    cursor = scope.item;
    segments.shift();
  } else {
    cursor = scope.root;
  }

  for (const seg of segments) {
    if (cursor == null) return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
}

/** Classify a resolved value so a component (and the canvas) can decide between
 *  render-once, set-scope, and iterate. */
export function cardinalityOf(value: unknown): Cardinality {
  if (value == null) return 'empty';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'scalar';
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

/** Find the parent node of `id`, or null if `id` is the root / not found. */
export function findParent(root: BuilderNode, id: string): BuilderNode | null {
  for (const child of root.children ?? []) {
    if (child.id === id) return root;
    const hit = findParent(child, id);
    if (hit) return hit;
  }
  return null;
}

let idCounter = 0;
/** Stable-ish unique id for newly added nodes (client-only). Persisted with the
 *  tree on save, so on reload the id comes back from the server as plain data. */
export function makeId(type: string): string {
  idCounter += 1;
  return `${type.toLowerCase()}-${idCounter}-${idCounter * 31 + 7}`;
}

// ── Option tables (drive the inspector controls) ─────────────────────────────

export const HEIGHT_OPTIONS: { value: HeightScale; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'sm', label: '¼' },
  { value: 'md', label: '½' },
  { value: 'lg', label: '¾' },
  { value: 'full', label: 'Full' },
];

export const WIDTH_OPTIONS: { value: WidthMode; label: string }[] = [
  { value: 'full', label: 'Edge to edge' },
  { value: 'contained', label: 'Contained' },
];

export const SURFACE_OPTIONS: { value: Surface; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'muted', label: 'Muted' },
  { value: 'inverse', label: 'Inverse' },
  { value: 'brand', label: 'Brand' },
];

export const SPACE_OPTIONS: { value: SpaceScale; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
];

export const ALIGN_OPTIONS: { value: AlignX; label: string }[] = [
  { value: 'start', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'Right' },
];

export const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: 'stack', label: 'Stack' },
  { value: 'row', label: 'Row' },
  { value: 'grid', label: 'Grid' },
];

export const GAP_OPTIONS: { value: GapScale; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
];

export const DEVICE_OPTIONS: { value: Device; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];
