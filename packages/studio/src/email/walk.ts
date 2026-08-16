// Reading an email tree.
//
// The site's `walk.ts` gets away with one `children` array because a silica node
// is one shape. Email's vocabulary is CLOSED and typed per kind — a body holds
// sections, a columns row holds columns, a leaf holds nothing — so every read
// goes through `emailChildren` rather than property access, and the one cast that
// puts children back lives in `edit.ts` and nowhere else.

import type { EmailNode } from '@wizeworks/silicaui-builder/email';

/** Where a node sits: itself, its parent, and its index among the parent's children. */
export interface EmailPlace {
  node: EmailNode;
  /** Undefined for the body, which has no parent. */
  parent?: EmailNode;
  /** Index into the parent's `children`, or -1 for the body. */
  index: number;
}

/** The children of a node — empty for every leaf content kind. */
export function emailChildren(node: EmailNode): readonly EmailNode[] {
  return 'children' in node ? node.children : [];
}

/** Can this kind hold children at all? What a drop target and a layer twisty ask. */
export function isEmailContainer(node: EmailNode): boolean {
  return 'children' in node;
}

/**
 * Depth-first walk, parents before children. Returning `false` prunes that subtree.
 */
export function walkEmail(
  root: EmailNode,
  visit: (node: EmailNode, parent?: EmailNode) => boolean | void
): void {
  const step = (node: EmailNode, parent?: EmailNode): void => {
    if (visit(node, parent) === false) return;
    for (const child of emailChildren(node)) step(child, node);
  };
  step(root);
}

export function findEmailPlace(root: EmailNode, id: string): EmailPlace | undefined {
  if (root.id === id) return { node: root, index: -1 };

  let found: EmailPlace | undefined;
  walkEmail(root, (node, parent) => {
    if (found || node.id !== id || !parent) return;
    found = { node, parent, index: emailChildren(parent).indexOf(node) };
    return false;
  });
  return found;
}

export function findEmailNode(root: EmailNode, id: string): EmailNode | undefined {
  return findEmailPlace(root, id)?.node;
}

/** Ancestors of `id`, outermost first, excluding the node itself — the shape
 *  `emailScopeAt` wants when narrowing a binding picker inside a repeat. */
export function emailAncestors(root: EmailNode, id: string): EmailNode[] {
  const trail: EmailNode[] = [];
  const seek = (node: EmailNode, path: EmailNode[]): boolean => {
    if (node.id === id) {
      trail.push(...path);
      return true;
    }
    return emailChildren(node).some((child) => seek(child, [...path, node]));
  };
  seek(root, []);
  return trail;
}

/** Is `ancestorId` at or above `id`? The cycle guard every move needs. */
export function isWithinEmail(root: EmailNode, id: string, ancestorId: string): boolean {
  if (id === ancestorId) return true;
  const ancestor = findEmailNode(root, ancestorId);
  return ancestor ? Boolean(findEmailPlace(ancestor, id)) : false;
}

export function collectEmailIds(root: EmailNode): Set<string> {
  const ids = new Set<string>();
  walkEmail(root, (node) => {
    ids.add(node.id);
  });
  return ids;
}
