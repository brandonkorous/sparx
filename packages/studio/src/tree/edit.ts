// Immutable structural edits on a silica node tree.
//
// Every function rebuilds only the path from the root to the touched node and
// shares the rest, so a canvas can compare subtrees by identity and re-render
// the branch that actually changed. `undefined` means the target was not in this
// tree — never a silent no-op that returns the original and looks like success.
//
// Ordering keys are minted here, not by callers. `ord` is what makes a position
// transportable between two clients (see `NodeBase.ord`), and a caller that
// forgets one produces a node that sorts correctly today and arbitrarily the
// moment anyone else inserts beside it.

import { ordAt, type Child, type Node } from '@wizeworks/silicaui-html';
import { isAddressable, isNodeChild, isWithin, type AddressableNode } from './walk';

/** Rebuild `root`, replacing the node with `id` by whatever `swap` returns.
 *  Returning `null` from `swap` removes the node. */
function rebuild(
  root: Node,
  id: string,
  swap: (node: AddressableNode) => AddressableNode | null
): Node | null | undefined {
  if (!isAddressable(root)) return undefined;
  if (root.id === id) return swap(root);

  const children = root.children;
  if (!children?.length) return undefined;

  let changed = false;
  const next: Child[] = [];
  for (const child of children) {
    if (!changed && isNodeChild(child)) {
      const result = rebuild(child, id, swap);
      if (result !== undefined) {
        changed = true;
        if (result !== null) next.push(result);
        continue;
      }
    }
    next.push(child);
  }
  return changed ? { ...root, children: next } : undefined;
}

/** Swap one node for another. The replacement keeps whatever id it carries — so
 *  callers changing a field must spread the original rather than build fresh. */
export function replaceNode(root: Node, id: string, next: AddressableNode): Node | undefined {
  const result = rebuild(root, id, () => next);
  return result ?? undefined;
}

/** Remove a node. Undefined when it is absent OR when it is the root, which
 *  cannot be removed — a document with no root is not a document. */
export function removeNode(root: Node, id: string): Node | undefined {
  if (isAddressable(root) && root.id === id) return undefined;
  const result = rebuild(root, id, () => null);
  return result ?? undefined;
}

/**
 * Insert `node` as a child of `parentId` at `index`, minting its ordering key
 * from the neighbours it lands between. `index` is clamped into range, so a
 * drop past the end appends rather than failing.
 */
export function insertChild(
  root: Node,
  parentId: string,
  node: AddressableNode,
  index?: number
): Node | undefined {
  const result = rebuild(root, parentId, (parent) => {
    const children = parent.children ?? [];
    const at = clamp(index ?? children.length, 0, children.length);
    const placed: AddressableNode = { ...node, ord: ordAt(children, at) };
    const next = [...children];
    next.splice(at, 0, placed);
    return { ...parent, children: next };
  });
  return result ?? undefined;
}

/**
 * Move an existing node under `parentId` at `index`.
 *
 * `index` counts against the parent's children AFTER the node has been lifted
 * out — which is what a drop computes once the dragged node is excluded from the
 * list it is being dropped into.
 *
 * Refuses a move INTO the node's own subtree. Without that guard the tree stops
 * being a tree: the node and its new parent reference each other, every walk
 * recurses forever, and the failure surfaces as a hung tab rather than an error.
 */
export function moveNode(
  root: Node,
  id: string,
  parentId: string,
  index?: number
): Node | undefined {
  if (isWithin(root, parentId, id)) return undefined;

  const moving = findAddressable(root, id);
  if (!moving) return undefined;

  const lifted = removeNode(root, id);
  if (!lifted) return undefined;

  return insertChild(lifted, parentId, moving, index);
}

/** The node with this id, typed as addressable. Local to keep `edit` free of a
 *  cycle back through `walk`'s place lookup. */
function findAddressable(root: Node, id: string): AddressableNode | undefined {
  if (!isAddressable(root)) return undefined;
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    if (!isNodeChild(child)) continue;
    const hit = findAddressable(child, id);
    if (hit) return hit;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
