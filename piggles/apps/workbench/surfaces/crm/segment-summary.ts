'use client';

// One line saying what a group selects, for the list.
//
// The column here used to read a rule count that looked for `conditions`/`rules`/
// `all`/`any` — none of which the stored tree has; its key is `children`. So it
// counted 0 for every segment ever written and every row fell through to the same
// three words, "From activity", on every tenant. Nothing looked broken, which is
// why it stood: that phrase reads like a statement about the group rather than
// like a value that could not be computed.
//
// Reading the tree properly is barely more work than counting it, so this says
// what the rule is, in the same words the builder uses to author it.

import { fieldMeta, type CustomFieldIndex, type SegmentFieldPath } from './segment-fields';
import { operatorLabel } from './segment-operators';

/** What a group with nothing readable in it says. A saved segment never shows
 *  this — the builder refuses to save one — so it means an unrecognised shape. */
export const NO_CONDITIONS = 'No conditions';

interface Leaf {
  kind: 'predicate';
  field: SegmentFieldPath;
  op: string;
  value?: unknown;
}

interface Branch {
  kind: 'and' | 'or' | 'not';
  children?: unknown[];
  child?: unknown;
}

function isLeaf(node: unknown): node is Leaf {
  return typeof node === 'object' && node !== null && (node as Leaf).kind === 'predicate';
}

function isBranch(node: unknown): node is Branch {
  const kind = typeof node === 'object' && node !== null ? (node as Branch).kind : '';
  return kind === 'and' || kind === 'or' || kind === 'not';
}

/** Every condition in the tree, in the order they were written. Flattening is
 *  what lets one line stay readable however deeply the groups nest. */
function leaves(node: unknown): Leaf[] {
  if (isLeaf(node)) return [node];
  if (!isBranch(node)) return [];
  if (node.kind === 'not') return leaves(node.child);
  return (node.children ?? []).flatMap(leaves);
}

/** A stored value in the words the builder shows for it: an enum reads as its
 *  label, a range as "5 and 10", a boolean as yes or no. */
function readValue(leaf: Leaf, custom: CustomFieldIndex): string {
  const { value } = leaf;
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) {
    const parts = value.map((v) => labelFor(leaf, v, custom));
    return leaf.op === 'between' && parts.length === 2
      ? `${parts[0] ?? ''} and ${parts[1] ?? ''}`
      : parts.join(', ');
  }
  return labelFor(leaf, value, custom);
}

function labelFor(leaf: Leaf, value: unknown, custom: CustomFieldIndex): string {
  const options = fieldMeta(leaf.field, custom).options;
  const match = options?.find((o) => o.value === value);
  return match ? match.label : String(value);
}

function describeLeaf(leaf: Leaf, custom: CustomFieldIndex): string {
  const meta = fieldMeta(leaf.field, custom);
  const op = operatorLabel(leaf.op as Parameters<typeof operatorLabel>[0], meta.kind);
  const value = readValue(leaf, custom);
  return value === '' ? `${meta.label} ${op}` : `${meta.label} ${op} ${value}`;
}

/**
 * One line for the whole tree: the first condition in full, then how many others
 * ride with it. The first is the useful half — it is usually what the group was
 * named after — and the count says whether there is more to open.
 */
export function describeRule(rules: unknown, custom: CustomFieldIndex = {}): string {
  const all = leaves(rules);
  const [first, ...rest] = all;
  if (first === undefined) return NO_CONDITIONS;
  const head = describeLeaf(first, custom);
  return rest.length === 0 ? head : `${head}, and ${String(rest.length)} more`;
}
