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

import {
  fieldMeta,
  operatorLabel,
  type CustomFieldIndex,
  type SegmentFieldPath,
} from './segment-rules';

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

/** Every condition in the tree, used only to decide whether a rule is too long
 *  to write out in full. The SENTENCE is built by walking the tree, not this. */
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
 * Above this many conditions a rule stops being a sentence and starts being a
 * paragraph, so the tail is counted instead. Every group the platform seeds has
 * three or fewer, so in practice this only catches something hand-built.
 */
const MAX_SPELLED_OUT = 4;

/**
 * ONE LINE FOR THE WHOLE TREE, WITH ITS CONNECTORS.
 *
 * This used to print the FIRST condition and count the rest: "Number of orders
 * is at least 1, and 2 more". The reasoning was that the first condition is
 * usually what the group was named after. Measured against the groups the
 * platform actually seeds, it is not:
 *
 *     At Risk     shown: "Number of orders is at least 1, and 2 more"
 *                 means: has ordered AND has not ordered for 90 days
 *
 * So the one line said "everyone who has ever bought from you", the count beside
 * it said 0, and those two facts together read as a broken platform rather than
 * as an empty group. The condition that explains the 0 was one of the two it
 * hid. Naming a group after its first rule is a guess; printing its rules is not
 * (persona issue 539).
 *
 * `not` is spelled out too. It used to be dropped silently, so a group built on
 * "not subscribed" read as "Subscribed to marketing is yes" — the exact opposite
 * of the group, in a sentence with no hint anything was missing.
 */
export function describeRule(rules: unknown, custom: CustomFieldIndex = {}): string {
  if (leaves(rules).length === 0) return NO_CONDITIONS;
  if (leaves(rules).length > MAX_SPELLED_OUT) {
    const [first, ...rest] = leaves(rules);
    const head = first === undefined ? NO_CONDITIONS : describeLeaf(first, custom);
    return `${head}, and ${String(rest.length)} more`;
  }
  return describeNode(rules, custom, null);
}

/**
 * The tree as a sentence. `parent` is the connector this node sits under, so a
 * group of a DIFFERENT kind gets brackets: without them
 * "(opened or clicked) and subscribed" flattens into "opened or clicked and
 * subscribed", which an English reader groups the other way round.
 */
function describeNode(
  node: unknown,
  custom: CustomFieldIndex,
  parent: 'and' | 'or' | null
): string {
  if (isLeaf(node)) return describeLeaf(node, custom);
  if (!isBranch(node)) return '';
  if (node.kind === 'not') {
    const inner = describeNode(node.child, custom, null);
    return inner === '' ? '' : `not (${inner})`;
  }
  // Hoisted: inside the callback TypeScript no longer remembers that the `not`
  // case returned above, so the parameter widens back to all three kinds.
  const kind: 'and' | 'or' = node.kind;
  const parts = (node.children ?? [])
    .map((child) => describeNode(child, custom, kind))
    .filter((part) => part !== '');
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0] ?? '';
  const joined = joinWith(parts, kind);
  return parent !== null && parent !== kind ? `(${joined})` : joined;
}

/** "A and B" for two, "A, B, and C" for more — the way it would be said out
 *  loud, rather than "A and B and C". */
function joinWith(parts: string[], kind: 'and' | 'or'): string {
  if (parts.length === 2) return `${parts[0] ?? ''} ${kind} ${parts[1] ?? ''}`;
  const last = parts[parts.length - 1] ?? '';
  return `${parts.slice(0, -1).join(', ')}, ${kind} ${last}`;
}
