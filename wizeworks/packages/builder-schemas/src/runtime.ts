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

/**
 * A stable key for a collection source: `all`, `collection:<id>`, `category:<id>`,
 * plus the ordering and tag filter when the author set either.
 *
 * The suffix matters because the key is what two repeaters on one page SHARE. Two
 * grids over the whole catalog — one newest-first, one showing only the `sale` tag —
 * are two different lists, and without the suffix the second would silently render
 * the first one's records. A source with no sort and no tag keys exactly as it always
 * did, so every stored binding resolves unchanged.
 *
 * Computed identically at author time and render time and never persisted, so the
 * format can change without a migration.
 */
export function collectionSourceKey(source: {
  from: string;
  id?: string;
  sort?: string;
  tag?: string;
}): string {
  const base = source.from === 'all' || !source.id ? source.from : `${source.from}:${source.id}`;
  const suffix = [
    ...(source.sort ? [`sort=${source.sort}`] : []),
    ...(source.tag ? [`tag=${source.tag}`] : []),
  ];
  return suffix.length > 0 ? `${base}|${suffix.join('|')}` : base;
}

/** The shape of a node's binding the resolver + ref-walk read (a structural subset
 *  of the Zod `Binding`, kept here so runtime stays import-cycle-free with node.ts). */
export interface NodeBinding {
  path?: string;
  entity?: string;
  id?: string;
  cmsType?: string;
  source?: { from: string; id?: string; limit?: number; sort?: string; tag?: string };
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
  return resolveBindingEx(scope, binding).value;
}

/** `resolveBinding` + the found/missing distinction (see `PathResolution`).
 *
 *  A pin/collection whose record has not been LOADED is reported as missing, not as
 *  an empty value: the data simply isn't here, so the authored placeholder is the
 *  honest thing to keep. An `action` binding resolves no display value at all and is
 *  likewise "not a value ref". */
export function resolveBindingEx(
  scope: Scope,
  binding: NodeBinding | undefined | null
): PathResolution {
  const miss: PathResolution = { found: false, value: undefined };
  if (!binding) return miss;
  if (binding.action) return miss;
  const root = scope.root as Record<string, unknown>;
  if (binding.source) {
    const sources = root[SOURCES_ROOT] as Record<string, unknown> | undefined;
    const key = collectionSourceKey(binding.source);
    if (!sources || !(key in sources)) return miss;
    return { found: true, value: sources[key] };
  }
  if (binding.entity && binding.id) {
    const pins = root[PINS_ROOT] as Record<string, unknown> | undefined;
    const key = entityPinKey(binding.entity, binding.id);
    if (!pins || !(key in pins)) return miss;
    return { found: true, value: pins[key] };
  }
  if (binding.path) return resolvePathEx(scope, binding.path);
  return miss;
}

/** A resolution that distinguishes "this host has no such ref" from "the ref is
 *  real and its value happens to be empty" — the distinction silica's `ResolveHost`
 *  requires (`resolveBinding` returns `undefined` for the former, `{value}` for the
 *  latter). Without it a renderer blanks the node either way, so a typo'd or stale
 *  binding silently DELETES authored content instead of reporting itself. */
export interface PathResolution {
  /** Did every segment of the path actually exist in the data? */
  found: boolean;
  value: unknown;
}

/** Resolve a dotted/bracketed path, reporting whether the path EXISTS.
 *
 *  `found` is key-presence, not truthiness: `site.identity.logo === null` on a tenant
 *  with no logo is FOUND (a real field, legitimately empty) and the node renders empty,
 *  while `logo` at the root is NOT found (no such key) and the node keeps what the
 *  author wrote. Presence is tested with `in`, so an explicit `undefined` still counts
 *  as found. */
export function resolvePathEx(scope: Scope, path: string): PathResolution {
  const miss: PathResolution = { found: false, value: undefined };
  const trimmed = path.trim();
  if (trimmed === '') return miss;
  if (trimmed === 'index') {
    return scope.index === undefined ? miss : { found: true, value: scope.index };
  }

  const segments = trimmed
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let cursor: unknown;
  if (segments[0] === 'item') {
    if (scope.item === undefined) return miss;
    cursor = scope.item;
    segments.shift();
    if (segments.length === 0) return { found: true, value: cursor };
  } else {
    cursor = scope.root;
  }

  for (const seg of segments) {
    if (cursor == null || typeof cursor !== 'object') return miss;
    if (!(seg in (cursor as Record<string, unknown>))) return miss;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return { found: true, value: cursor };
}

/** Resolve a dotted/bracketed path against a scope. Paths beginning with `item`
 *  resolve against the iteration item; `index` is the loop counter; everything
 *  else resolves against the module root. Value-only — use `resolvePathEx` when
 *  "missing" and "empty" must be told apart. */
export function resolvePath(scope: Scope, path: string): unknown {
  return resolvePathEx(scope, path).value;
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
  /** Collection sources to iterate (each loads a product array). Carries the
   *  author's `sort` / `tag` so the loader can ask the API for the right list
   *  rather than reorder an already-capped page of the wrong one. */
  sources: { from: string; id?: string; limit?: number; sort?: string; tag?: string }[];
}

/** Collect every entity pin + collection source in a tree, deduped by their
 *  stable keys. Drives the by-id batch fetch in both data loaders. */
export function collectBindingRefs(node: BindableNode): BindingRefs {
  const entities = new Map<string, EntityRef>();
  const sources = new Map<string, BindingRefs['sources'][number]>();
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
