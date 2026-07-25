'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SEGMENT RULE MODEL
//
// A segment's membership is a recursive boolean tree stored in `segments.rules`.
// The tree's vocabulary — the field whitelist, the operator set, the predicate
// leaf and the recursive rule shape — comes STRAIGHT FROM `@sparx/crm-schemas`
// (`SegmentField` / `SegmentOperator` / `PredicateLeaf` / `SegmentRule`), the same
// Zod the server validates writes and evaluates membership against, so the builder
// can never drift from it. This file adds only workbench-side concerns on top: the
// editor's friendlier tree, the field metadata/labels, and serialize/parse.
//
// ── The server's tree ──────────────────────────────────────────────────────
//   leaf : { kind:'predicate', field, op, value? }
//   and  : { kind:'and', children: SegmentRule[] }   (1–20 children)
//   or   : { kind:'or',  children: SegmentRule[] }
//   not  : { kind:'not', child: SegmentRule }
//
// ── The EDITOR's tree ───────────────────────────────────────────────────────
// The builder works in a friendlier shape — a group carries a combinator AND a
// `negate` flag, so a "none of these" is one node rather than a not() wrapping an
// and(). `serializeNode` collapses that back to the server's tree; `parseServerRule`
// lifts a stored tree into it. A round-trip is lossless for anything the builder
// can author, and safe (never throws) for anything it cannot.
// ══════════════════════════════════════════════════════════════════════════

import type { PredicateLeaf, SegmentField, SegmentOperator, SegmentRule } from '@sparx/crm-schemas';
import {
  LEAD_STATUSES,
  LIFECYCLE_STAGES,
  RELATIONSHIP_TYPES,
  customerTypeMeta,
  leadStatusMeta,
  lifecycleStageMeta,
} from './customers-data';

// Re-exported so the rest of the surface imports these from one place — but they
// are the REAL shared types, not a local copy.
export type { PredicateLeaf, SegmentField, SegmentOperator, SegmentRule };

/** A JSON scalar — the concrete leaf a predicate value can be. Not a server enum,
 *  just the shape `coerceScalar` produces before it goes into a `PredicateLeaf`. */
type Literal = string | number | boolean | null;

/* ── Field metadata — what each field is and how it is edited ────────────── */

/** How a field's value is entered, which drives the operator set and the value
 *  control. `rep`/`account` are uuid fields backed by a live picker. */
export type ValueKind =
  | 'enum'
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'tags'
  | 'rep'
  | 'account';

interface FieldMeta {
  label: string;
  /** Which card the field is grouped under in the picker. */
  group: 'Customer' | 'Wholesale account' | 'Email';
  kind: ValueKind;
  /** For `enum` fields — the allowed values and their plain labels. */
  options?: { value: string; label: string }[];
  /** One line under the value control. */
  hint?: string;
}

export const FIELD_META: Record<SegmentField, FieldMeta> = {
  'customer.type': {
    label: 'Relationship',
    group: 'Customer',
    kind: 'enum',
    options: RELATIONSHIP_TYPES.map((t) => ({ value: t, label: customerTypeMeta(t).label })),
  },
  'customer.lifecycleStage': {
    label: 'Lifecycle stage',
    group: 'Customer',
    kind: 'enum',
    options: LIFECYCLE_STAGES.map((s) => ({ value: s, label: lifecycleStageMeta(s).label })),
  },
  'customer.leadStatus': {
    label: 'Lead status',
    group: 'Customer',
    kind: 'enum',
    options: LEAD_STATUSES.map((s) => ({ value: s, label: leadStatusMeta(s).label })),
  },
  'customer.email': { label: 'Email', group: 'Customer', kind: 'text' },
  'customer.tags': {
    label: 'Label',
    group: 'Customer',
    kind: 'tags',
    hint: 'Matches one of the labels on the customer.',
  },
  'customer.company': { label: 'Company', group: 'Customer', kind: 'text' },
  'customer.createdAt': { label: 'Date added', group: 'Customer', kind: 'date' },
  'customer.totalSpent': {
    label: 'Total spent',
    group: 'Customer',
    kind: 'number',
    hint: 'A whole amount, e.g. 500.',
  },
  'customer.orderCount': { label: 'Number of orders', group: 'Customer', kind: 'number' },
  'customer.firstOrderAt': { label: 'First order date', group: 'Customer', kind: 'date' },
  'customer.lastOrderAt': { label: 'Last order date', group: 'Customer', kind: 'date' },
  'customer.daysSinceLastOrder': {
    label: 'Days since last order',
    group: 'Customer',
    kind: 'number',
    hint: 'E.g. more than 365 for “not bought in a year”.',
  },
  'customer.assignedRepId': { label: 'Looked after by', group: 'Customer', kind: 'rep' },
  'customer.doNotContact': { label: 'Do not send marketing', group: 'Customer', kind: 'boolean' },
  'customer.b2bAccountId': {
    label: 'Linked wholesale account',
    group: 'Customer',
    kind: 'account',
  },
  'b2bAccount.pricingTier': { label: 'Price tier', group: 'Wholesale account', kind: 'text' },
  'b2bAccount.creditUtilization': {
    label: 'Credit used (share)',
    group: 'Wholesale account',
    kind: 'number',
    hint: 'A share between 0 and 1 — 0.8 means 80% of their limit is used.',
  },
  'b2bAccount.fleetSize': { label: 'Fleet size', group: 'Wholesale account', kind: 'number' },
  'b2bAccount.status': {
    label: 'Account status',
    group: 'Wholesale account',
    kind: 'enum',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'credit_hold', label: 'Credit hold' },
      { value: 'suspended', label: 'Suspended' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  'b2bAccount.paymentTerms': {
    label: 'Payment terms',
    group: 'Wholesale account',
    kind: 'enum',
    options: [
      { value: 'prepay', label: 'Pay before dispatch' },
      { value: 'net15', label: '15 days to pay' },
      { value: 'net30', label: '30 days to pay' },
      { value: 'net60', label: '60 days to pay' },
      { value: 'net90', label: '90 days to pay' },
    ],
  },
  'email.openedLast30d': { label: 'Emails opened (30 days)', group: 'Email', kind: 'number' },
  'email.clickedLast30d': { label: 'Emails clicked (30 days)', group: 'Email', kind: 'number' },
  'email.unsubscribed': { label: 'Has unsubscribed', group: 'Email', kind: 'boolean' },
  'email.subscribed': { label: 'Subscribed to marketing', group: 'Email', kind: 'boolean' },
};

/** Total accessor for {@link FIELD_META}. The map has an entry for every
 *  `SegmentField`, so this always resolves — wrapping the lookup here keeps that
 *  guarantee in one place and hands callers a `FieldMeta`, not the
 *  `FieldMeta | undefined` a bare `FIELD_META[field]` widens to across a module
 *  boundary under `noUncheckedIndexedAccess`. */
export function fieldMeta(field: SegmentField): FieldMeta {
  return FIELD_META[field];
}

/**
 * The fields the builder OFFERS, grouped for the picker. Date fields ("date
 * added", "first / last order date") compare by timestamp now that the server
 * evaluator's `toComparable` handles ISO strings, so a "last order before X"
 * rule matches correctly — recency can be expressed either as a date or as the
 * numeric "days since last order".
 */
export const OFFERED_FIELDS: SegmentField[] = [
  'customer.type',
  'customer.tags',
  'customer.email',
  'customer.company',
  'customer.totalSpent',
  'customer.orderCount',
  'customer.daysSinceLastOrder',
  'customer.lastOrderAt',
  'customer.firstOrderAt',
  'customer.createdAt',
  'customer.assignedRepId',
  'customer.doNotContact',
  'customer.b2bAccountId',
  'b2bAccount.status',
  'b2bAccount.pricingTier',
  'b2bAccount.paymentTerms',
  'b2bAccount.fleetSize',
  'b2bAccount.creditUtilization',
  'email.subscribed',
  'email.unsubscribed',
  'email.openedLast30d',
  'email.clickedLast30d',
];

/** The field picker's items, always including `current` even when it is a field
 *  the builder does not otherwise offer (a stored date rule, say), so loading
 *  never drops a condition. Grouped by area, offered fields first. */
export function fieldOptionsIncluding(current: SegmentField): { value: string; label: string }[] {
  const fields = OFFERED_FIELDS.includes(current) ? OFFERED_FIELDS : [...OFFERED_FIELDS, current];
  return fields.map((f) => ({
    value: f,
    label: `${FIELD_META[f].group} · ${FIELD_META[f].label}`,
  }));
}

/* ── Operators ──────────────────────────────────────────────────────────── */

const OPERATORS_BY_KIND: Record<ValueKind, SegmentOperator[]> = {
  enum: ['eq', 'neq'],
  boolean: ['eq', 'neq'],
  text: ['eq', 'neq', 'contains', 'not_contains', 'is_null', 'is_not_null'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
  date: ['gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
  tags: ['contains', 'not_contains'],
  rep: ['eq', 'neq', 'is_null', 'is_not_null'],
  account: ['eq', 'neq', 'is_null', 'is_not_null'],
};

/** The operators offered for a field, always including `current` so a stored
 *  operator the builder would not offer still renders. */
export function operatorOptionsIncluding(
  field: SegmentField,
  current: SegmentOperator
): { value: SegmentOperator; label: string }[] {
  const kind = FIELD_META[field].kind;
  const base = OPERATORS_BY_KIND[kind];
  const ops = base.includes(current) ? base : [...base, current];
  return ops.map((op) => ({ value: op, label: operatorLabel(op, kind) }));
}

export function defaultOperator(field: SegmentField): SegmentOperator {
  return OPERATORS_BY_KIND[FIELD_META[field].kind][0] ?? 'eq';
}

/** Plain-language operator label, tuned per value kind (a date reads "is after",
 *  a number reads "is more than"). */
export function operatorLabel(op: SegmentOperator, kind: ValueKind): string {
  const dateLabels: Partial<Record<SegmentOperator, string>> = {
    gt: 'is after',
    gte: 'is on or after',
    lt: 'is before',
    lte: 'is on or before',
    between: 'is between',
  };
  const dateLabel = dateLabels[op];
  if (kind === 'date' && dateLabel) return dateLabel;
  switch (op) {
    case 'eq':
      return 'is';
    case 'neq':
      return 'is not';
    case 'gt':
      return 'is more than';
    case 'gte':
      return 'is at least';
    case 'lt':
      return 'is less than';
    case 'lte':
      return 'is at most';
    case 'in':
      return 'is one of';
    case 'not_in':
      return 'is not one of';
    case 'contains':
      return kind === 'tags' ? 'includes' : 'contains';
    case 'not_contains':
      return kind === 'tags' ? 'does not include' : 'does not contain';
    case 'is_null':
      return 'is empty';
    case 'is_not_null':
      return 'is set';
    case 'between':
      return 'is between';
  }
}

/** Whether this operator needs a value control at all. */
export function operatorTakesValue(op: SegmentOperator): boolean {
  return op !== 'is_null' && op !== 'is_not_null';
}

export function operatorIsRange(op: SegmentOperator): boolean {
  return op === 'between';
}

export function operatorIsList(op: SegmentOperator): boolean {
  return op === 'in' || op === 'not_in';
}

/* ── The editor tree ────────────────────────────────────────────────────── */

export type Combinator = 'and' | 'or';

export interface PredNode {
  id: string;
  kind: 'predicate';
  field: SegmentField;
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

export function newPredicate(field: SegmentField = 'customer.type'): PredNode {
  const op = defaultOperator(field);
  const meta = FIELD_META[field];
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

function serializePredicate(node: PredNode): PredicateLeaf | null {
  const kind = FIELD_META[node.field].kind;
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
      return { ok: false, error: `Fill in a value for “${FIELD_META[node.field].label}”.` };
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
