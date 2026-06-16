// Binding RESOLUTION — the pure runtime shared by every renderer (docs/44 §2.3).
//
// The editor canvas (preview data) and the storefront renderer (real records)
// resolve a node's binding the same way, so this lives with the model rather
// than in either app — no drift on the core single-vs-scope-vs-iterate semantic.
// Pure functions + types only (no zod, no DB, no React) — client + server safe.

/** A resolved value's shape, which decides render-once vs set-scope vs iterate. */
export type Cardinality = 'scalar' | 'object' | 'array' | 'empty';

/** The root data a page composes from — one key per source (`cms.<type>`,
 *  `commerce.product`, …). Mock placeholders in the editor; real records on the
 *  storefront. */
export type DataSources = Record<string, unknown>;

/** A resolution context: the module-level root, plus the current `item` when
 *  inside an iterating/scope container (so descendants resolve `item.*`). */
export interface Scope {
  root: DataSources;
  item?: unknown;
  /** Zero-based position within the current iteration (for `index`). */
  index?: number;
}

// ── The v2 binding spine (docs/98 Pillar 7) ───────────────────────────────────
//
// Entity pins + collection sources don't resolve from a free path — they resolve
// from records the data loader fetched BY ID and parked under two reserved roots:
//
//   · root.__pins[`${entity}:${id}`]  — one pinned record (a product / collection
//                                        / category / cms entry).
//   · root.__sources[sourceKey]       — the product array a collection source loads.
//
// The editor's buildPreviewData and the storefront's loadBuilderData both populate
// these, so the SAME resolveBinding drives canvas + live (no drift).

export const PINS_ROOT = '__pins';
export const SOURCES_ROOT = '__sources';

/** The reserved-root key a pinned entity record lives at (`product:<id>`). */
export function entityPinKey(entity: string, id: string): string {
  return `${entity}:${id}`;
}

/** A stable key for a collection source: `all`, `collection:<id>`, `category:<id>`. */
export function collectionSourceKey(source: { from: string; id?: string }): string {
  return source.from === 'all' || !source.id ? source.from : `${source.from}:${source.id}`;
}

/** The shape of a node's binding the resolver + ref-walk read (a structural subset
 *  of the Zod `Binding`, kept here so runtime stays import-cycle-free with node.ts). */
export interface NodeBinding {
  path?: string;
  entity?: string;
  id?: string;
  cmsType?: string;
  source?: { from: string; id?: string; limit?: number };
  action?: string;
  href?: string;
}

/** Resolve a node's binding to its data value, dispatching on kind:
 *   · field      → the value at its path (the original behavior)
 *   · entity     → the pinned record under `root.__pins`
 *   · collection → the product array under `root.__sources`
 *   · action     → undefined (a trigger resolves no display value)
 *  Undefined when the record/array hasn't been loaded (the caller falls back). */
export function resolveBinding(scope: Scope, binding: NodeBinding | undefined | null): unknown {
  if (!binding) return undefined;
  if (binding.action) return undefined;
  const root = scope.root as Record<string, unknown>;
  if (binding.source) {
    const sources = root[SOURCES_ROOT] as Record<string, unknown> | undefined;
    return sources?.[collectionSourceKey(binding.source)];
  }
  if (binding.entity && binding.id) {
    const pins = root[PINS_ROOT] as Record<string, unknown> | undefined;
    return pins?.[entityPinKey(binding.entity, binding.id)];
  }
  if (binding.path) return resolvePath(scope, binding.path);
  return undefined;
}

/** Resolve a dotted/bracketed path against a scope. Paths beginning with `item`
 *  resolve against the iteration item; `index` is the loop counter; everything
 *  else resolves against the module root. */
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

/** Classify a resolved value so a component (and the renderer) can decide
 *  between render-once, set-scope, and iterate. */
export function cardinalityOf(value: unknown): Cardinality {
  if (value == null) return 'empty';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'scalar';
}

// ── Binding-path introspection (which sources a tree references) ──────────────
//
// Pure tree walks used to decide what a tree binds to WITHOUT resolving data:
// selective data resolution (resolve only referenced sources) and personalization
// detection (does any binding hit a per-recipient source). Decoupled from the full
// BuilderNode/Zod shape — just the binding + children the walk needs.

interface BindableNode {
  binding?: NodeBinding | null;
  children?: BindableNode[];
}

/** Every binding path in a node tree, depth-first (duplicates kept — callers
 *  dedupe if they need to). */
export function collectBindingPaths(node: BindableNode): string[] {
  const out: string[] = [];
  const walk = (n: BindableNode): void => {
    if (n.binding?.path) out.push(n.binding.path);
    for (const c of n.children ?? []) walk(c);
  };
  walk(node);
  return out;
}

// ── Commerce ref collection (docs/98 Pillar 7) ────────────────────────────────
//
// The data loaders (editor + storefront) need to know, WITHOUT resolving data,
// which concrete records a tree pins/iterates so they can batch-fetch them by id.
// One depth-first walk returns the deduped entity pins + collection sources.

export interface EntityRef {
  entity: string;
  id: string;
  cmsType?: string;
}

export interface BindingRefs {
  /** Entity pins (`{ entity, id }`) — product / collection / category / cms. */
  entities: EntityRef[];
  /** Collection sources to iterate (each loads a product array). */
  sources: { from: string; id?: string; limit?: number }[];
}

/** Collect every entity pin + collection source in a tree, deduped by their
 *  stable keys. Drives the by-id batch fetch in both data loaders. */
export function collectBindingRefs(node: BindableNode): BindingRefs {
  const entities = new Map<string, EntityRef>();
  const sources = new Map<string, { from: string; id?: string; limit?: number }>();
  const walk = (n: BindableNode): void => {
    const b = n.binding;
    if (b) {
      if (b.source) sources.set(collectionSourceKey(b.source), b.source);
      else if (b.entity && b.id && !b.action) {
        entities.set(entityPinKey(b.entity, b.id), {
          entity: b.entity,
          id: b.id,
          ...(b.cmsType ? { cmsType: b.cmsType } : {}),
        });
      }
    }
    for (const c of n.children ?? []) walk(c);
  };
  walk(node);
  return { entities: [...entities.values()], sources: [...sources.values()] };
}

/** The leading segment of a binding path — `commerce.product` → `commerce`,
 *  `recipient.firstName` → `recipient`, `item.title` → `item`, `cart[0]` →
 *  `cart`. '' for an empty path. */
export function bindingRoot(path: string): string {
  return (
    path
      .trim()
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .find(Boolean) ?? ''
  );
}

/** The SOURCE KEY a path roots at — the first segment, except two-level module
 *  sources (`cms.*`, `commerce.*`) keep their second segment so the resolver can
 *  tell `cms.blog_post` from `cms.page`. Scope-relative paths (`item.*`, `index`)
 *  return '' (they resolve from the enclosing scope, not a root source). */
export function bindingSourceKey(path: string): string {
  const segs = path
    .trim()
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  const head = segs[0];
  if (!head || head === 'item' || head === 'index') return '';
  if ((head === 'cms' || head === 'commerce') && segs[1]) return `${head}.${segs[1]}`;
  return head;
}
