// The Site Builder node model — the backbone of /builder.
//
// This is the UI-side source of truth for the composition model (docs/40). We
// build the editor against THIS, then shape the backend to match what the UI
// proves out — not the other way around.
//
// One recursive primitive. "Section / column / component" are ROLES, not
// levels: every node is either a CONTAINER (arranges children) or a LEAF
// (renders content). Every node carries the same shape:
//
//     { id, type, box, layout?, props, binding?, children? }
//
//   · box     — the universal spine EVERY node has (alignment, height, width
//               behaviour, spacing, surface, visibility).
//   · layout  — containers only (direction / columns / gap / justify / align).
//   · props   — component-specific (heading level, button label, …).
//   · binding — per-node. A leaf is static OR bound to a field; a container can
//               bind to an array to ITERATE its children once per item.
//
// Values are TOKEN-BACKED SCALES, never freeform — that consistency is the
// cure for the "disjointed" feeling. Components opt into the axes meaningful to
// them via the registry; the model just defines the vocabulary.

// ── Box base: the universal spine ───────────────────────────────────────────

/** Vertical size of a node, as a fraction of the viewport (or fit-content). */
export type HeightScale = 'auto' | 'sm' | 'md' | 'lg' | 'full';

/** Does the layer span edge-to-edge, or sit in a centered, contained column?
 *  Tracked SEPARATELY for the background and the content, so "full-bleed
 *  background, centered content" is one ordinary setting pair. */
export type WidthMode = 'full' | 'contained';

/** Surface fill — a token, never a raw color. `brand` follows the active
 *  module color via --module-active. */
export type Surface = 'none' | 'subtle' | 'muted' | 'inverse' | 'brand';

/** Spacing scale, used for inner padding. */
export type SpaceScale = 'none' | 'sm' | 'md' | 'lg' | 'xl';

/** Horizontal alignment of a node's content. */
export type AlignX = 'start' | 'center' | 'end';

/** The three preview breakpoints a node can be shown/hidden on. */
export type Device = 'desktop' | 'tablet' | 'mobile';

export interface BoxBase {
  /** Optional author-facing label, shown in the Layers tree. */
  name?: string;
  height: HeightScale;
  backgroundWidth: WidthMode;
  contentWidth: WidthMode;
  surface: Surface;
  padding: SpaceScale;
  align: AlignX;
  /** Breakpoints this node is visible on. Empty array is treated as "all". */
  hiddenOn: Device[];
}

export const DEFAULT_BOX: BoxBase = {
  height: 'auto',
  backgroundWidth: 'contained',
  contentWidth: 'contained',
  surface: 'none',
  // Leaves default to no padding — spacing comes from the parent container's
  // gap. Containers set their own padding (see registry defaults / the sample).
  padding: 'none',
  align: 'start',
  hiddenOn: [],
};

// ── Layout base: containers only ────────────────────────────────────────────

export type Direction = 'stack' | 'row' | 'grid';
export type GapScale = 'none' | 'sm' | 'md' | 'lg';
export type Justify = 'start' | 'center' | 'end' | 'between';

export interface LayoutBase {
  direction: Direction;
  /** Column count when direction === 'grid'. */
  columns: number;
  gap: GapScale;
  justify: Justify;
  /** Cross-axis alignment for row/stack. */
  alignItems: AlignX | 'stretch';
  wrap: boolean;
}

export const DEFAULT_LAYOUT: LayoutBase = {
  direction: 'stack',
  columns: 3,
  gap: 'md',
  justify: 'start',
  alignItems: 'stretch',
  wrap: true,
};

// ── Binding ─────────────────────────────────────────────────────────────────

/** A per-node binding to a path in the current data scope, e.g.
 *  "cms.posts", "commerce.products[0]", "item.title". A node with no binding
 *  is static / local content. */
export interface Binding {
  path: string;
}

export type Cardinality = 'scalar' | 'object' | 'array' | 'empty';

// ── The node ─────────────────────────────────────────────────────────────────

export interface BuilderNode {
  id: string;
  /** Registry key — what this node IS (Section, Heading, ImageDisplay, …). */
  type: string;
  box: BoxBase;
  layout?: LayoutBase;
  props: Record<string, unknown>;
  binding?: Binding;
  children?: BuilderNode[];
}

// ── Page templates ───────────────────────────────────────────────────────────

/** A page template = a named node tree. Sparx ships a curated handful (5–10);
 *  a user creates any number more. Two kinds:
 *   · singleton  — one specific page (Home, About); content authored inline.
 *   · collection — one template that renders EVERY record of a content type
 *                  (Product page → every product); nodes bind to `recordType`'s
 *                  fields and each record fills the same template.
 *  (This is the page-template builder; the app builder and email builder come
 *  later as sibling surfaces under /builder.) */
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
/** Stable-ish unique id for newly added nodes (client-only). */
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
