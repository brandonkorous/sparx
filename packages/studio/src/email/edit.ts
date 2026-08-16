// Changing an email tree — always by returning a new one.
//
// Every insert and every move is adjudicated by silica's own `canHold` before
// anything is written, which is what lets the single `withChildren` cast below be
// safe: by the time it runs, the child has been checked against the parent by the
// same table the projector and the type system are built on. A second, local
// answer to "may this go here" would be a second, differently-wrong answer.

import { generateKeyBetween } from '@wizeworks/silicaui-html';
import { canHold, type EmailNode } from '@wizeworks/silicaui-builder/email';
import { emailChildren, findEmailPlace, isWithinEmail } from './walk';

/** The one place a typed children array is rebuilt. Callers must have checked
 *  `canHold` for every child first — see this file's header. */
function withChildren<T extends EmailNode>(node: T, children: readonly EmailNode[]): T {
  return { ...node, children } as unknown as T;
}

/**
 * Rebuild the tree with one node remade, or undefined when the id is not in it.
 *
 * Undefined means ABSENT, never "unchanged" — so a caller can tell a refused op
 * from a no-op, which is the distinction the whole ops layer is built on.
 */
function rewrite(
  root: EmailNode,
  id: string,
  make: (node: EmailNode) => EmailNode
): EmailNode | undefined {
  if (root.id === id) return make(root);

  const children = emailChildren(root);
  for (const [index, child] of children.entries()) {
    const next = rewrite(child, id, make);
    if (!next) continue;
    const out = [...children];
    out[index] = next;
    return withChildren(root, out);
  }
  return undefined;
}

/** Drop a node out of its parent. Refused for the body, and for a locked node. */
export function removeEmailNode(root: EmailNode, id: string): EmailNode | undefined {
  const place = findEmailPlace(root, id);
  if (!place?.parent || place.node.locked) return undefined;
  return rewrite(root, place.parent.id, (parent) =>
    withChildren(
      parent,
      emailChildren(parent).filter((child) => child.id !== id)
    )
  );
}

/** The ordering key for a node landing at `index`, from the neighbours bracketing
 *  it. Siblings without one yet (a document authored before `ord`) are skipped. */
function ordAt(children: readonly EmailNode[], index: number): string {
  const before = children.slice(0, index).findLast((child) => child.ord)?.ord ?? null;
  const after = children.slice(index).find((child) => child.ord)?.ord ?? null;
  return generateKeyBetween(before, after);
}

/**
 * Put `node` into `parentId` at `index`, minting its ordering key from the
 * neighbours it lands between. Refused when the parent cannot hold it.
 *
 * `ord` is minted HERE rather than by callers for the reason the site tree gives:
 * a node without one sorts correctly today and arbitrarily the moment anyone else
 * inserts beside it.
 */
export function insertEmailChild(
  root: EmailNode,
  parentId: string,
  node: EmailNode,
  index: number
): EmailNode | undefined {
  const parent = findEmailPlace(root, parentId)?.node;
  if (!parent || !canHold(parent, node)) return undefined;

  return rewrite(root, parentId, (target) => {
    const children = [...emailChildren(target)];
    const at = Math.max(0, Math.min(index, children.length));
    children.splice(at, 0, { ...node, ord: ordAt(children, at) });
    return withChildren(target, children);
  });
}

/**
 * Move a node to a new slot.
 *
 * Removed first, inserted second — so `index` means the position in the parent
 * AFTER the node has left it. That is the convention a drag layer computes
 * against, and the one the site tree already uses.
 */
export function moveEmailNode(
  root: EmailNode,
  id: string,
  parentId: string,
  index: number
): EmailNode | undefined {
  const place = findEmailPlace(root, id);
  if (!place?.parent) return undefined;
  // Into itself or its own descendant is a tree that no longer contains its root.
  if (isWithinEmail(root, parentId, id)) return undefined;

  const without = removeEmailNode(root, id);
  if (!without) return undefined;
  return insertEmailChild(without, parentId, place.node, index);
}

/** Swap one node for another. Structure is checked against the SLOT it lands in. */
export function replaceEmailNode(
  root: EmailNode,
  id: string,
  node: EmailNode
): EmailNode | undefined {
  const place = findEmailPlace(root, id);
  if (!place) return undefined;
  if (place.parent && !canHold(place.parent, node)) return undefined;
  return rewrite(root, id, () => node);
}

/** Fields a patch may never touch — see `patchEmailNode`. */
const UNPATCHABLE = new Set(['kind', 'id', 'children']);

/**
 * Merge a patch of scalar fields into one node.
 *
 * `kind`, `id` and `children` are refused: the first two would make the node
 * answer to an identity it does not have, and the third is what the structural
 * ops exist for — a patch that could re-parent a subtree would slip past
 * `canHold` entirely.
 */
export function patchEmailNode(
  root: EmailNode,
  id: string,
  patch: Readonly<Record<string, unknown>>
): EmailNode | undefined {
  return rewrite(root, id, (node) => {
    const next: Record<string, unknown> = { ...node };
    for (const [key, value] of Object.entries(patch)) {
      if (UNPATCHABLE.has(key)) continue;
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    return next as unknown as EmailNode;
  });
}

/**
 * Re-mint every id in a subtree.
 *
 * The palette's `make()` returns placeholder ids, and a copied node carries the
 * original's. Either one inserted as-is gives two nodes one identity, and from
 * then on every op addressed to it reaches whichever the walk finds first.
 */
export function stampEmailTree(node: EmailNode, makeId: () => string): EmailNode {
  const children = emailChildren(node);
  const stamped: Record<string, unknown> = { ...node, id: makeId() };
  if ('children' in node) {
    stamped.children = children.map((child) => stampEmailTree(child, makeId));
  }
  return stamped as unknown as EmailNode;
}
