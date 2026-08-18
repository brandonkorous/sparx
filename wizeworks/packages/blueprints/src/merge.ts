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

import type { SilicaNode } from '@wizeworks/builder-schemas';

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

// ── silica-tree merge (docs/55 §7.2) ────────────────────────────────────────────
//
// Trees merge NODE-KEYED by `Node.id`. This is tractable because the installer
// writes manifest node ids UNCHANGED (it never re-stamps — `stampTree` mints a
// fresh id on every node, which would destroy the correspondence this merge needs)
// and blueprint authors keep ids stable across versions, so base/current/incoming
// share ids for corresponding nodes. Each node's own fields three-way-merge via
// mergeValue; element children merge by id with order best-effort.
//
// TWO silica shapes the legacy `BuilderNode` merge never had to handle:
//
//   · `Child = Node | string` — a text child is a bare string with no id, so it
//     cannot be keyed. A node whose children include ANY string (or any node
//     missing an id) merges its `children` ATOMICALLY as one value instead of
//     per-child. That keeps the core invariant intact (a tenant edit is still
//     never silently overwritten) without inventing synthetic ids that would not
//     survive a round-trip. In practice a text-bearing node is a leaf — a heading
//     with one string child — where whole-array merge is exactly right anyway.
//
//   · `id` is OPTIONAL on the silica type. Stored trees are always stamped, but a
//     hand-authored fragment may not be, so the id-keyed path is used only when
//     every child on all three sides actually has one.

const NODE_FIELDS = [
  'kind',
  'tag',
  'name',
  'class',
  'attrs',
  'props',
  'data',
  'component',
  'label',
  'locked',
  'pinned',
] as const;

function pickFields(n: SilicaNode | undefined): Record<string, unknown> | undefined {
  if (!n) return undefined;
  const rec = n as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of NODE_FIELDS) if (rec[f] !== undefined) out[f] = rec[f];
  return out;
}

/** Element children only — a string child has no identity to merge on. */
type ChildList = readonly (SilicaNode | string)[] | undefined;

/** A node's id, read off the record. `id` is declared on most silica node kinds
 *  but NOT on `OutletNode`, so the union has no common `.id` — reading it through
 *  the record shape keeps this merge total over every kind instead of excluding
 *  outlets (which do appear in a frame tree). */
function nodeId(n: SilicaNode | undefined): string | undefined {
  const v = (n as unknown as Record<string, unknown> | undefined)?.id;
  return typeof v === 'string' ? v : undefined;
}

/** A node's children, read off the record — same reason as `nodeId`: `OutletNode`
 *  declares none, so the union has no common `.children`. */
function nodeChildren(n: SilicaNode | undefined): ChildList {
  const v = (n as unknown as Record<string, unknown> | undefined)?.children;
  return Array.isArray(v) ? (v as ChildList) : undefined;
}

/** Can this children array take the id-keyed path? Only if every entry is a node
 *  carrying an id. Any string, or any id-less node, forces the atomic path. */
function keyable(children: ChildList): children is readonly SilicaNode[] {
  return (children ?? []).every(
    (c) => typeof c === 'object' && c !== null && nodeId(c) !== undefined
  );
}

function indexById(nodes: readonly SilicaNode[] | undefined): Map<string, SilicaNode> {
  const m = new Map<string, SilicaNode>();
  for (const n of nodes ?? []) {
    const id = nodeId(n);
    if (id) m.set(id, n);
  }
  return m;
}

function mergeChildren(
  base: readonly SilicaNode[] | undefined,
  current: readonly SilicaNode[] | undefined,
  incoming: readonly SilicaNode[] | undefined,
  opts: MergeOptions,
  path: string
): { merged: SilicaNode[]; changes: FieldChange[] } {
  const baseM = indexById(base);
  const curM = indexById(current);
  const incM = indexById(incoming);
  const incIds = (incoming ?? []).map((n) => nodeId(n) ?? '');
  const changes: FieldChange[] = [];
  const merged: SilicaNode[] = [];

  // Walk the tenant's current order — the authoritative arrangement of what they have.
  for (const child of current ?? []) {
    const cid = nodeId(child) ?? '';
    const childPath = `${path}/${cid}`;
    const b = baseM.get(cid);
    const inc = incM.get(cid);
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
    if (r.merged !== undefined) merged.push(r.merged as SilicaNode);
    changes.push(...r.changes);
  }

  // Author-added nodes (in incoming, absent from base AND current). A node in base
  // but not current was deleted by the tenant — stay deleted, don't resurrect.
  for (const inc of incoming ?? []) {
    const iid = nodeId(inc) ?? '';
    if (curM.has(iid) || baseM.has(iid)) continue;
    const childPath = `${path}/${iid}`;
    changes.push({
      path: childPath,
      type: 'auto',
      base: undefined,
      mine: undefined,
      theirs: inc,
      taken: 'theirs',
    });
    // Best-effort position: just after the nearest preceding incoming sibling already placed.
    const incIdx = incIds.indexOf(iid);
    let insertAt = merged.length;
    for (let i = incIdx - 1; i >= 0; i--) {
      const mi = merged.findIndex((m) => nodeId(m) === incIds[i]);
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
  base: SilicaNode | undefined,
  current: SilicaNode | undefined,
  incoming: SilicaNode | undefined,
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
  const curId = nodeId(current);
  const mergedRec = { ...(fieldRes.merged as Record<string, unknown>) };
  if (curId !== undefined) mergedRec.id = curId;
  const merged = mergedRec as unknown as SilicaNode;

  // Children. The id-keyed walk needs every child on all three sides to BE an
  // id-carrying node; a string (text) child or an unstamped one makes the array
  // unkeyable, so it merges as a single atomic value instead. Doing otherwise
  // would drop text children on the floor — they have no id to match on.
  const baseKids = nodeChildren(base);
  const curKids = nodeChildren(current);
  const incKids = nodeChildren(incoming);
  const canKey = keyable(baseKids) && keyable(curKids) && keyable(incKids);
  let changes: FieldChange[];
  if (canKey) {
    const childRes = mergeChildren(baseKids, curKids, incKids, opts, path);
    if (curKids !== undefined || childRes.merged.length > 0) mergedRec.children = childRes.merged;
    changes = [...fieldRes.changes, ...childRes.changes];
  } else {
    const childRes = mergeValue(baseKids, curKids, incKids, opts, `${path}/children`);
    if (childRes.merged !== undefined) mergedRec.children = childRes.merged;
    changes = [...fieldRes.changes, ...childRes.changes];
  }
  return { merged, changes, changed: !canonicalEqual(merged, current) };
}

/** Public entry: node-keyed three-way merge of a whole silica tree (docs/55 §7.2). */
export function mergeTree(
  base: SilicaNode | undefined,
  current: SilicaNode | undefined,
  incoming: SilicaNode | undefined,
  opts: MergeOptions = {},
  path = 'tree'
): MergeResult {
  return mergeNode(base, current, incoming, opts, path);
}

// ── keyed-array merge (docs/55 §7.3) ────────────────────────────────────────────
//
// A flat array of objects correlated by a stable key field (e.g. product variants
// by `sku`). Each element three-way-merges by mergeValue; an element the author
// dropped is removed if the tenant never touched it, kept (orphan) if they did; an
// author-added element is appended. Mirrors the children logic of mergeTree without
// recursion.

type Row = Record<string, unknown>;

export function mergeByKey(
  base: Row[] | undefined,
  current: Row[] | undefined,
  incoming: Row[] | undefined,
  keyField: string,
  opts: MergeOptions = {},
  path = ''
): MergeResult {
  const index = (arr: Row[] | undefined): Map<string, Row> => {
    const m = new Map<string, Row>();
    for (const el of arr ?? []) m.set(String(el[keyField]), el);
    return m;
  };
  const baseM = index(base);
  const curM = index(current);
  const incM = index(incoming);
  const changes: FieldChange[] = [];
  const merged: Row[] = [];

  for (const el of current ?? []) {
    const k = String(el[keyField]);
    const elPath = `${path}[${k}]`;
    const b = baseM.get(k);
    const inc = incM.get(k);
    if (!inc) {
      if (b && canonicalEqual(el, b)) {
        changes.push({
          path: elPath,
          type: 'auto',
          base: b,
          mine: el,
          theirs: undefined,
          taken: 'theirs',
        });
        continue;
      }
      merged.push(el);
      continue;
    }
    const r = mergeValue(b, el, inc, opts, elPath);
    if (r.merged !== undefined) merged.push(r.merged as Row);
    changes.push(...r.changes);
  }

  for (const inc of incoming ?? []) {
    const k = String(inc[keyField]);
    if (curM.has(k) || baseM.has(k)) continue;
    changes.push({
      path: `${path}[${k}]`,
      type: 'auto',
      base: undefined,
      mine: undefined,
      theirs: inc,
      taken: 'theirs',
    });
    merged.push(inc);
  }

  return { merged, changes, changed: !canonicalEqual(merged, current) };
}
