// Reading a silica node tree — the lookups every op and every rail needs.
//
// `OutletNode` is the reason these helpers exist rather than property access:
// it is the one member of the `Node` union that does NOT extend `NodeBase`, so
// it carries no `id`, no `class` and no `children`. Written as `node.id` that is
// a type error, and written as `(node as ElementNode).id` it is a lie that
// compiles — an outlet would answer to an id it cannot have and become
// addressable by ops that must never reach it.

import type { ComponentNode, ElementNode, HostNode, Child, Node } from '@wizeworks/silicaui-html';

/** Every node kind that carries `NodeBase` — i.e. everything but the Outlet. */
export type AddressableNode = ElementNode | ComponentNode | HostNode;

/** Where a node sits: itself, its parent, and its index among the parent's children. */
export interface NodePlace {
  node: AddressableNode;
  /** Undefined for the root, which has no parent. */
  parent?: AddressableNode;
  /** Index into `parent.children` (which counts text children too), or -1 for the root. */
  index: number;
}

export function isNodeChild(child: Child): child is Node {
  return typeof child !== 'string';
}

/** An outlet is a leaf marker, never an editable node. */
export function isAddressable(node: Node): node is AddressableNode {
  return node.kind !== 'outlet';
}

/** The node's id, or undefined for a template node that was never stamped. */
export function idOf(node: Node): string | undefined {
  return isAddressable(node) ? node.id : undefined;
}

/** The element children of a node, text children dropped. */
export function childNodes(node: Node): Node[] {
  if (!isAddressable(node)) return [];
  return (node.children ?? []).filter(isNodeChild);
}

/** Does this subtree contain an Outlet? The layout builder's delete/move guard. */
export function containsOutlet(node: Node): boolean {
  if (node.kind === 'outlet') return true;
  return childNodes(node).some(containsOutlet);
}

/**
 * Depth-first walk over every addressable node, parents before children.
 * Returning `false` from `visit` prunes that subtree.
 */
export function walkTree(
  root: Node,
  visit: (node: AddressableNode, parent?: AddressableNode) => boolean | void
): void {
  const step = (node: Node, parent?: AddressableNode): void => {
    if (!isAddressable(node)) return;
    if (visit(node, parent) === false) return;
    for (const child of childNodes(node)) step(child, node);
  };
  step(root);
}

/** Locate a node by id. Undefined when the id is not in this tree. */
export function findPlace(root: Node, id: string): NodePlace | undefined {
  if (!isAddressable(root)) return undefined;
  if (root.id === id) return { node: root, index: -1 };

  let found: NodePlace | undefined;
  walkTree(root, (node, parent) => {
    if (found || node.id !== id || !parent) return;
    const index = (parent.children ?? []).findIndex(
      (child) => isNodeChild(child) && child === node
    );
    found = { node, parent, index };
    return false;
  });
  return found;
}

/** The node with this id, or undefined. */
export function findNode(root: Node, id: string): AddressableNode | undefined {
  return findPlace(root, id)?.node;
}

/** Ancestors of `id`, outermost first, excluding the node itself. */
export function ancestorsOf(root: Node, id: string): AddressableNode[] {
  const trail: AddressableNode[] = [];
  const seek = (node: Node, path: AddressableNode[]): boolean => {
    if (!isAddressable(node)) return false;
    if (node.id === id) {
      trail.push(...path);
      return true;
    }
    return childNodes(node).some((child) => seek(child, [...path, node]));
  };
  seek(root, []);
  return trail;
}

/** Is `ancestorId` at or above `id`? The cycle guard every move needs. */
export function isWithin(root: Node, id: string, ancestorId: string): boolean {
  if (id === ancestorId) return true;
  const ancestor = findNode(root, ancestorId);
  return ancestor ? Boolean(findPlace(ancestor, id)) : false;
}

/** Every id in the tree — the uniqueness check on paste, stamp and adoption. */
export function collectIds(root: Node): Set<string> {
  const ids = new Set<string>();
  walkTree(root, (node) => {
    if (node.id) ids.add(node.id);
  });
  return ids;
}
