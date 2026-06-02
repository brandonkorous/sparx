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
