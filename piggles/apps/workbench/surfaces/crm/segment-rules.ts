'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SEGMENT RULE TREE
//
// A segment's membership is a recursive boolean tree stored in `segments.rules`,
// shaped by `SegmentRule` in `@wizeworks/crm-schemas` — the same Zod the server
// validates and evaluates against, so the builder cannot drift from it. Field
// labels live in ./segment-fields, operator labels in ./segment-operators.
//
// ── The server's tree ──────────────────────────────────────────────────────
//   leaf : { kind:'predicate', field, op, value? }
//   and  : { kind:'and', children: SegmentRule[] }   (1–20 children)
//   or   : { kind:'or',  children: SegmentRule[] }
//   not  : { kind:'not', child: SegmentRule }
//
// ── The EDITOR's tree ───────────────────────────────────────────────────────
// A group carries a combinator AND a `negate` flag, so "none of these" is one
// node rather than a not() wrapping an and(). `serializeNode` collapses that
// back to the server's tree and `parseServerRule` lifts a stored one into it —
// lossless for anything the builder can author, safe for anything it cannot.
// ══════════════════════════════════════════════════════════════════════════

import type {
  PredicateLeaf,
  SegmentFieldPath,
  SegmentOperator,
  SegmentRule,
} from '@wizeworks/crm-schemas';
import { fieldMeta, type CustomFieldIndex, type ValueKind } from './segment-fields';
import {
  defaultOperator,
  operatorIsList,
  operatorIsRange,
  operatorTakesValue,
} from './segment-operators';

// One import site for the whole surface: the field and operator vocabularies
// reach call sites through here rather than making each know three files.
export * from './segment-fields';
export * from './segment-operators';

/** A JSON scalar — the concrete leaf a predicate value can be. Not a server enum,
 *  just the shape `coerceScalar` produces before it goes into a `PredicateLeaf`. */
type Literal = string | number | boolean | null;

export type Combinator = 'and' | 'or';

export interface PredNode {
  id: string;
  kind: 'predicate';
  field: SegmentFieldPath;
  op: SegmentOperator;
  /** Single value, or the low bound of a `between`, or a comma list for in/not_in. */
  value: string;
  /** High bound of a `between`; unused otherwise. */
  value2: string;
}

export interface GroupNode {
  id: string;
  kind: 'group';
  combinator: Combinator;
  /** True → "none of these" (wraps the group in a `not` on serialize). */
  negate: boolean;
  children: EditorNode[];
}

export type EditorNode = PredNode | GroupNode;

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `n_${Math.random().toString(36).slice(2)}`;
}

export function newPredicate(
  field: SegmentFieldPath = 'customer.type',
  custom: CustomFieldIndex = {}
): PredNode {
  const op = defaultOperator(field, custom);
  const meta = fieldMeta(field, custom);
  const value =
    meta.kind === 'enum' ? (meta.options?.[0]?.value ?? '') : meta.kind === 'boolean' ? 'true' : '';
  return { id: newId(), kind: 'predicate', field, op, value, value2: '' };
}

export function newGroup(combinator: Combinator = 'and'): GroupNode {
  return { id: newId(), kind: 'group', combinator, negate: false, children: [] };
}

export function emptyRoot(): GroupNode {
  return {
    id: newId(),
    kind: 'group',
    combinator: 'and',
    negate: false,
    children: [newPredicate()],
  };
}

/* ── Serialize: editor → server ─────────────────────────────────────────── */

function coerceScalar(kind: ValueKind, raw: string): Literal {
  const s = raw.trim();
  if (kind === 'number') {
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  if (kind === 'boolean') return s === 'true';
  return s;
}

function serializePredicate(node: PredNode, custom: CustomFieldIndex = {}): PredicateLeaf | null {
  const kind = fieldMeta(node.field, custom).kind;
  if (!operatorTakesValue(node.op)) {
    return { kind: 'predicate', field: node.field, op: node.op };
  }
  if (operatorIsRange(node.op)) {
    const min = coerceScalar(kind, node.value);
    const max = coerceScalar(kind, node.value2);
    if (typeof min === 'number' && Number.isNaN(min)) return null;
    if (typeof max === 'number' && Number.isNaN(max)) return null;
    if (node.value.trim() === '' || node.value2.trim() === '') return null;
    return { kind: 'predicate', field: node.field, op: node.op, value: [min, max] };
  }
  if (operatorIsList(node.op)) {
    const parts = node.value
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '');
    if (parts.length === 0) return null;
    return {
      kind: 'predicate',
      field: node.field,
      op: node.op,
      value: parts.map((p) => coerceScalar(kind, p)),
    };
  }
  if (node.value.trim() === '' && kind !== 'boolean') return null;
  const value = coerceScalar(kind, node.value);
  if (typeof value === 'number' && Number.isNaN(value)) return null;
  return { kind: 'predicate', field: node.field, op: node.op, value };
}

/** Turn the editor tree into the server's rule, or a plain error naming the
 *  first thing that is not filled in. */
export function serializeNode(
  node: EditorNode
): { ok: true; rule: SegmentRule } | { ok: false; error: string } {
  if (node.kind === 'predicate') {
    const leaf = serializePredicate(node);
    if (!leaf) {
      return { ok: false, error: `Fill in a value for “${fieldMeta(node.field).label}”.` };
    }
    return { ok: true, rule: leaf };
  }
  if (node.children.length === 0) {
    return { ok: false, error: 'Add at least one condition to every group.' };
  }
  const children: SegmentRule[] = [];
  for (const child of node.children) {
    const result = serializeNode(child);
    if (!result.ok) return result;
    children.push(result.rule);
  }
  const base: SegmentRule = { kind: node.combinator, children };
  return { ok: true, rule: node.negate ? { kind: 'not', child: base } : base };
}

/* ── Parse: server → editor ─────────────────────────────────────────────── */

function literalToString(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '';
}

function parseLeaf(leaf: PredicateLeaf): PredNode {
  let value = '';
  let value2 = '';
  if (Array.isArray(leaf.value)) {
    if (leaf.op === 'between') {
      value = literalToString(leaf.value[0]);
      value2 = literalToString(leaf.value[1]);
    } else {
      value = leaf.value.map(literalToString).join(', ');
    }
  } else if (leaf.value !== undefined) {
    value = literalToString(leaf.value);
  }
  return { id: newId(), kind: 'predicate', field: leaf.field, op: leaf.op, value, value2 };
}

/** Lift a stored server rule into the editor tree. Always returns a GROUP at the
 *  root (a bare predicate is wrapped in an AND of one), and never throws — an
 *  unrecognised shape becomes an empty root the owner can rebuild. */
export function parseServerRule(rule: unknown): GroupNode {
  const node = parseNode(rule);
  if (node.kind === 'group') return node;
  return { id: newId(), kind: 'group', combinator: 'and', negate: false, children: [node] };
}

function parseNode(rule: unknown): EditorNode {
  if (!rule || typeof rule !== 'object') return emptyRoot();
  const r = rule as { kind?: string };
  if (r.kind === 'predicate') return parseLeaf(rule as PredicateLeaf);
  if (r.kind === 'and' || r.kind === 'or') {
    const children = (rule as { children?: unknown[] }).children ?? [];
    return {
      id: newId(),
      kind: 'group',
      combinator: r.kind,
      negate: false,
      children: children.map(parseNode),
    };
  }
  if (r.kind === 'not') {
    const child = (rule as { child?: unknown }).child;
    const inner = parseNode(child);
    if (inner.kind === 'group') return { ...inner, negate: true };
    // not(predicate) → a negated AND-of-one, so it round-trips as a group.
    return { id: newId(), kind: 'group', combinator: 'and', negate: true, children: [inner] };
  }
  return emptyRoot();
}

/* ── Slug ───────────────────────────────────────────────────────────────── */

/** Kebab-case slug the server accepts (`^[a-z][a-z0-9-]*$`, ≤63). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^([0-9])/, 's-$1')
    .slice(0, 63);
}

export const SLUG_RE = /^[a-z][a-z0-9-]*$/;
