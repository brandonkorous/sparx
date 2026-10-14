// Pointing a repeating list at a different source — "What this list shows".
//
// A design ships its lists bound to what the designer had: a journal design's front
// page lists blog posts. A journal that writes Articles of its own got a front page
// reading "No posts yet" over five published articles, and nothing in the editor could
// change what the list showed.
//
// A list is more than its own node. `repeatOrEmpty` writes a sibling message that shows
// only when the list is empty ("No posts yet"), gated on the SAME source; leave it on the
// old one and it sits under a full list, saying the list is empty. A pager names the list
// it pages. So the change is every node that names the old source, as one edit.

import type { DataBinding, Node } from '@wizeworks/silicaui-html';

import type { TreeOp } from '../ops/types';
import { findPlace, isNodeChild, walkTree } from './walk';

/** The source a repeating list shows, or undefined when the node is not one. */
export function listSourceOf(node: { data?: DataBinding }): string | undefined {
  return node.data?.kind === 'collection' ? node.data.ref : undefined;
}

/**
 * The ops that point the list `listId` at `toRef`, or none when nothing changes.
 *
 * Its empty-state siblings and any pager naming it follow. Nothing inside the list is
 * touched: a card binds its record's own fields, and the storefront gives every kind of
 * writing the words a card was written against (headline, summary, picture).
 */
export function retargetListOps(root: Node, listId: string, toRef: string): TreeOp[] {
  const place = findPlace(root, listId);
  const data = place?.node.data;
  if (!place || data?.kind !== 'collection' || data.ref === toRef) return [];
  const fromRef = data.ref;
  const ops: TreeOp[] = [{ kind: 'node.setData', id: listId, value: { ...data, ref: toRef } }];

  for (const child of place.parent?.children ?? []) {
    if (!isNodeChild(child) || child.kind === 'outlet' || !child.id) continue;
    const sibling = child.data;
    if (sibling?.kind === 'visible' && sibling.ref === fromRef) {
      ops.push({ kind: 'node.setData', id: child.id, value: { ...sibling, ref: toRef } });
    }
  }

  walkTree(root, (node) => {
    if (node.kind === 'host' && node.id && node.props?.list === fromRef) {
      ops.push({ kind: 'node.setProp', id: node.id, key: 'list', value: toRef });
    }
  });
  return ops;
}
