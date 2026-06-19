// Blueprint three-way merge engine (docs/55 §5, §8) — a pure, DB-free reconcile
// over canonical JSON content. The three inputs:
//   · base     — the stamped baseline captured at install (the merge ANCESTOR)
//   · current  — the tenant's live row, in the same canonical shape
//   · incoming — the new blueprint version's content
//
// The load-bearing invariant (docs/55 U1): a tenant edit is NEVER overwritten
// automatically. A field fast-forwards to `incoming` ONLY when the tenant did not
// touch it (current == base). When both sides changed the same field it is a
// CONFLICT — kept as the tenant's value unless a resolution explicitly says
// otherwise. Everything recurses to the smallest unit (U4), so a tenant who tweaked
// one token still receives every other upstream change with no interaction (U5).
//
// Zod/DB/React-free: unit-testable in isolation and safe to import anywhere.

import type { BuilderNode } from '@sparx/builder-schemas';

export type ConflictSide = 'mine' | 'theirs';

export interface FieldChange {
  /** Dotted path within the artifact (e.g. `presentation.color.accent`). */
  path: string;
  /** `auto` = tenant untouched + upstream changed (a safe fast-forward).
   *  `conflict` = both sides changed the same field (kept `mine` by default). */
  type: 'auto' | 'conflict';
  base: unknown;
  mine: unknown;
  theirs: unknown;
  /** Which side the merged value took (`auto` is always `theirs`). */
  taken: ConflictSide;
}

export interface MergeResult {
  /** The value to write back. */
  merged: unknown;
  /** Auto fast-forwards + conflicts. A tenant-only edit or a no-op yields nothing. */
  changes: FieldChange[];
  /** Whether `merged` differs from `current` (i.e. there is anything to write). */
  changed: boolean;
}

export interface MergeOptions {
  /** Resolve a conflict at `path`. Default keeps the tenant's value (`mine`). */
  resolve?: (path: string) => ConflictSide;
  /** Treat the value at `path` as ATOMIC (don't recurse). Used to hand a whole
   *  builder tree to the specialized node-keyed merge (docs/55 §7.2) instead of a
   *  blind field merge. */
  atomic?: (path: string) => boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Stable serialization: object keys sorted, `undefined` keys dropped (an unset
 *  optional must equal an absent one), arrays order-sensitive. */
function canonical(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}

/** Canonical structural equality (key order / undefined-vs-absent insensitive). */
export function canonicalEqual(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

/** Three-way merge `base`/`current`/`incoming`, recursing through plain objects.
 *  Returns the merged value + the list of auto changes and conflicts. */
export function mergeValue(
  base: unknown,
  current: unknown,
  incoming: unknown,
  opts: MergeOptions = {},
  path = ''
): MergeResult {
  // Already aligned (upstream never moved off current, or both converged) → keep.
  if (canonicalEqual(current, incoming)) return { merged: current, changes: [], changed: false };
  // Upstream unchanged from base but current differs ⇒ a tenant-only edit ⇒ keep it.
  if (canonicalEqual(incoming, base)) return { merged: current, changes: [], changed: false };
  // Tenant untouched, upstream changed ⇒ fast-forward to incoming (auto, U5).
  if (canonicalEqual(current, base)) {
    return {
      merged: incoming,
      changes: [{ path, type: 'auto', base, mine: current, theirs: incoming, taken: 'theirs' }],
      changed: true,
    };
  }
  // Both diverged. Field-merge when all three are plain objects (and not flagged
  // atomic) so a conflict surfaces at the smallest leaf, not the whole record.
  if (
    !opts.atomic?.(path) &&
    isPlainObject(base) &&
    isPlainObject(current) &&
    isPlainObject(incoming)
  ) {
    const keys = new Set<string>([
      ...Object.keys(base),
      ...Object.keys(current),
      ...Object.keys(incoming),
    ]);
    const merged: Record<string, unknown> = {};
    const changes: FieldChange[] = [];
    for (const k of keys) {
      const r = mergeValue(base[k], current[k], incoming[k], opts, path ? `${path}.${k}` : k);
      if (r.merged !== undefined) merged[k] = r.merged;
      changes.push(...r.changes);
    }
    return { merged, changes, changed: !canonicalEqual(merged, current) };
  }
  // Leaf / array / type-mismatch conflict — keep the tenant's value unless resolved.
  const take = opts.resolve?.(path) ?? 'mine';
  const merged = take === 'theirs' ? incoming : current;
  return {
    merged,
    changes: [{ path, type: 'conflict', base, mine: current, theirs: incoming, taken: take }],
    changed: !canonicalEqual(merged, current),
  };
}

/** A conflict resolution from the apply request: take `theirs` at these paths. */
export function resolverFrom(takeTheirs: Iterable<string>): (path: string) => ConflictSide {
  const set = new Set(takeTheirs);
  return (path: string) => (set.has(path) ? 'theirs' : 'mine');
}

// ── builder-tree merge (docs/55 §7.2) ───────────────────────────────────────────
//
// Trees merge NODE-KEYED by `BuilderNode.id`. This is tractable because the
// installer stamps manifest node ids unchanged and blueprint authors keep ids
// stable across versions — so base/current/incoming share ids for corresponding
// nodes. Each node's scalar/object fields (type, name, class, props, binding)
// three-way-merge via mergeValue; children merge by id with order best-effort.

const NODE_FIELDS = ['type', 'name', 'class', 'props', 'binding'] as const;

function pickFields(n: BuilderNode | undefined): Record<string, unknown> | undefined {
  if (!n) return undefined;
  const rec = n as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of NODE_FIELDS) if (rec[f] !== undefined) out[f] = rec[f];
  return out;
}

function indexById(nodes: BuilderNode[] | undefined): Map<string, BuilderNode> {
  const m = new Map<string, BuilderNode>();
  for (const n of nodes ?? []) m.set(n.id, n);
  return m;
}

function mergeChildren(
  base: BuilderNode[] | undefined,
  current: BuilderNode[] | undefined,
  incoming: BuilderNode[] | undefined,
  opts: MergeOptions,
  path: string
): { merged: BuilderNode[]; changes: FieldChange[] } {
  const baseM = indexById(base);
  const curM = indexById(current);
  const incM = indexById(incoming);
  const incIds = (incoming ?? []).map((n) => n.id);
  const changes: FieldChange[] = [];
  const merged: BuilderNode[] = [];

  // Walk the tenant's current order — the authoritative arrangement of what they have.
  for (const child of current ?? []) {
    const childPath = `${path}/${child.id}`;
    const b = baseM.get(child.id);
    const inc = incM.get(child.id);
    if (!inc) {
      // Author dropped this node. Untouched by the tenant ⇒ remove (auto); edited by
      // the tenant ⇒ keep as an orphan, never lose their work (U3).
      if (b && canonicalEqual(child, b)) {
        changes.push({
          path: childPath,
          type: 'auto',
          base: b,
          mine: child,
          theirs: undefined,
          taken: 'theirs',
        });
        continue;
      }
      merged.push(child);
      continue;
    }
    const r = mergeNode(b, child, inc, opts, childPath);
    if (r.merged !== undefined) merged.push(r.merged as BuilderNode);
    changes.push(...r.changes);
  }

  // Author-added nodes (in incoming, absent from base AND current). A node in base
  // but not current was deleted by the tenant — stay deleted, don't resurrect.
  for (const inc of incoming ?? []) {
    if (curM.has(inc.id) || baseM.has(inc.id)) continue;
    const childPath = `${path}/${inc.id}`;
    changes.push({
      path: childPath,
      type: 'auto',
      base: undefined,
      mine: undefined,
      theirs: inc,
      taken: 'theirs',
    });
    // Best-effort position: just after the nearest preceding incoming sibling already placed.
    const incIdx = incIds.indexOf(inc.id);
    let insertAt = merged.length;
    for (let i = incIdx - 1; i >= 0; i--) {
      const mi = merged.findIndex((m) => m.id === incIds[i]);
      if (mi >= 0) {
        insertAt = mi + 1;
        break;
      }
    }
    merged.splice(insertAt, 0, inc);
  }

  return { merged, changes };
}

/** Three-way merge a single node (and its subtree) by id. base/incoming may be
 *  absent (added/removed); `current` absent means the tenant deleted it. */
function mergeNode(
  base: BuilderNode | undefined,
  current: BuilderNode | undefined,
  incoming: BuilderNode | undefined,
  opts: MergeOptions,
  path: string
): MergeResult {
  if (!current) {
    if (incoming && !base) {
      return {
        merged: incoming,
        changes: [
          {
            path,
            type: 'auto',
            base: undefined,
            mine: undefined,
            theirs: incoming,
            taken: 'theirs',
          },
        ],
        changed: true,
      };
    }
    return { merged: undefined, changes: [], changed: false }; // tenant-deleted, not resurrected
  }
  if (!incoming) {
    if (base && canonicalEqual(current, base)) {
      return {
        merged: undefined,
        changes: [{ path, type: 'auto', base, mine: current, theirs: undefined, taken: 'theirs' }],
        changed: true,
      };
    }
    return { merged: current, changes: [], changed: false }; // author removed, but tenant edited ⇒ keep
  }
  // All present — merge fields, then children.
  const fieldRes = mergeValue(
    pickFields(base),
    pickFields(current),
    pickFields(incoming),
    opts,
    path
  );
  const merged = { ...(fieldRes.merged as Record<string, unknown>), id: current.id } as BuilderNode;
  const childRes = mergeChildren(base?.children, current.children, incoming.children, opts, path);
  if (current.children !== undefined || childRes.merged.length > 0)
    merged.children = childRes.merged;
  const changes = [...fieldRes.changes, ...childRes.changes];
  return { merged, changes, changed: !canonicalEqual(merged, current) };
}

/** Public entry: node-keyed three-way merge of a whole builder tree (docs/55 §7.2). */
export function mergeTree(
  base: BuilderNode | undefined,
  current: BuilderNode | undefined,
  incoming: BuilderNode | undefined,
  opts: MergeOptions = {},
  path = 'tree'
): MergeResult {
  return mergeNode(base, current, incoming, opts, path);
}
