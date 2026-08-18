// Applying an email tree op, and computing the inverse that undoes it.
//
// The twin of `apply-tree.ts`, over a different vocabulary. One difference is
// worth stating: email has no `setClass`/`setTag`/`setAttr` because an email node
// has no classes, no tag and no attributes — every visual decision is a NAMED
// FIELD on a typed node, so one `email.patch` op covers the lot. Its inverse is
// the previous value of exactly the keys it wrote, which is why a patch that
// changed two fields undoes both and touches nothing else.

import type { EmailBody, EmailNode } from '@wizeworks/silicaui-builder/email';
import {
  insertEmailChild,
  moveEmailNode,
  patchEmailNode,
  removeEmailNode,
  replaceEmailNode,
} from '../email/edit';
import { findEmailPlace } from '../email/walk';
import type { EmailTreeOp } from './types';

export interface EmailApplied {
  root: EmailBody;
  inverse: EmailTreeOp;
}

/** The body is the only root an email document has; every op returns one. */
function asBody(root: EmailNode | undefined): EmailBody | undefined {
  return root?.kind === 'body' ? root : undefined;
}

/** The previous value of exactly the keys a patch wrote — its inverse, and
 *  nothing wider. A key the node did not carry inverts to `undefined`, which
 *  `patchEmailNode` reads as "delete it again". */
function previousOf(node: EmailNode, patch: Readonly<Record<string, unknown>>) {
  const source = node as unknown as Record<string, unknown>;
  const previous: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) previous[key] = source[key];
  return previous;
}

export function applyEmailOp(root: EmailBody, op: EmailTreeOp): EmailApplied | undefined {
  switch (op.kind) {
    case 'email.insert': {
      const next = asBody(insertEmailChild(root, op.parentId, op.node, op.index));
      if (!next) return undefined;
      return { root: next, inverse: { kind: 'email.remove', id: op.node.id } };
    }

    case 'email.remove': {
      const place = findEmailPlace(root, op.id);
      if (!place?.parent) return undefined;
      const next = asBody(removeEmailNode(root, op.id));
      if (!next) return undefined;
      return {
        root: next,
        inverse: {
          kind: 'email.insert',
          parentId: place.parent.id,
          index: place.index,
          node: place.node,
        },
      };
    }

    case 'email.move': {
      const place = findEmailPlace(root, op.id);
      if (!place?.parent) return undefined;
      const from = { parentId: place.parent.id, index: place.index };
      const next = asBody(moveEmailNode(root, op.id, op.parentId, op.index));
      if (!next) return undefined;
      return {
        root: next,
        inverse: { kind: 'email.move', id: op.id, parentId: from.parentId, index: from.index },
      };
    }

    case 'email.replace': {
      const place = findEmailPlace(root, op.id);
      if (!place) return undefined;
      const next = asBody(replaceEmailNode(root, op.id, op.node));
      if (!next) return undefined;
      return { root: next, inverse: { kind: 'email.replace', id: op.id, node: place.node } };
    }

    case 'email.patch': {
      const place = findEmailPlace(root, op.id);
      if (!place) return undefined;
      const previous = previousOf(place.node, op.patch);
      const next = asBody(patchEmailNode(root, op.id, op.patch));
      if (!next) return undefined;
      return { root: next, inverse: { kind: 'email.patch', id: op.id, patch: previous } };
    }

    case 'email.setData': {
      const place = findEmailPlace(root, op.id);
      if (!place) return undefined;
      const previous = place.node.data;
      const next = asBody(patchEmailNode(root, op.id, { data: op.value }));
      if (!next) return undefined;
      return {
        root: next,
        inverse: { kind: 'email.setData', id: op.id, value: previous },
      };
    }
  }
}
