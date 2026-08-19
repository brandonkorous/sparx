// Applying a tree op, and computing the inverse that undoes it.
//
// Both in one pass, on purpose. The inverse of `node.remove` is the node it took
// out and the slot it came from — facts that exist only while the op is being
// applied. Computing them later means holding the whole prior tree, which is the
// snapshot model this design exists to avoid.
//
// A refusal is `undefined`, never a silently unchanged tree. An op whose subject
// has gone is benign under concurrency and a bug under a single author, and the
// caller can only tell the two apart if the failure is visible.

import type { DataBinding, Node } from '@wizeworks/silicaui-html';
import { findPlace, isNodeChild, type AddressableNode } from '../tree/walk';
import { insertChild, moveNode, removeNode, replaceNode } from '../tree/edit';
import type { TreeOp } from './types';

export interface TreeApplied {
  root: Node;
  inverse: TreeOp;
}

/** Copy a node with one optional field set, or removed when the value is undefined.
 *  The single cast is contained here so no op body has to reach for one. */
function setOptional<T extends AddressableNode>(node: T, key: string, value: unknown): T {
  const next = { ...node } as Record<string, unknown>;
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next as unknown as T;
}

/** The node's text, when its content is text. Undefined when it holds elements —
 *  which is what makes `node.setText` refuse rather than delete a subtree. */
function readText(node: AddressableNode): string | undefined {
  const children = node.children ?? [];
  if (children.some(isNodeChild)) return undefined;
  return children.filter((child): child is string => typeof child === 'string').join('');
}

export function applyTreeOp(root: Node, op: TreeOp): TreeApplied | undefined {
  switch (op.kind) {
    case 'node.insert': {
      if (!op.node.id) return undefined;
      const next = insertChild(root, op.parentId, op.node, op.index);
      if (!next) return undefined;
      return { root: next, inverse: { kind: 'node.remove', id: op.node.id } };
    }

    case 'node.remove': {
      const place = findPlace(root, op.id);
      if (!place?.parent) return undefined;
      const next = removeNode(root, op.id);
      if (!next) return undefined;
      return {
        root: next,
        inverse: {
          kind: 'node.insert',
          parentId: place.parent.id ?? '',
          index: place.index,
          node: place.node,
        },
      };
    }

    case 'node.move': {
      const place = findPlace(root, op.id);
      if (!place?.parent?.id) return undefined;
      const from = { parentId: place.parent.id, index: place.index };
      const next = moveNode(root, op.id, op.parentId, op.index);
      if (!next) return undefined;
      return {
        root: next,
        inverse: { kind: 'node.move', id: op.id, parentId: from.parentId, index: from.index },
      };
    }

    case 'node.replace': {
      // The replacement must be addressable, for the same reason an insert must be:
      // an id-free node renders correctly and can never be selected, dropped on, or
      // — the case that bit — undone.
      if (!op.node.id) return undefined;
      const place = findPlace(root, op.id);
      if (!place) return undefined;
      const next = replaceNode(root, op.id, op.node);
      if (!next) return undefined;
      // Invert against the id that is now IN THE TREE, not the one that was.
      // A replacement is allowed to carry its own id — Save as piece swapped a
      // section for a freshly minted instance node — and inverting against the
      // departed id produced a batch whose inverse could never find its subject.
      // `undo()` refuses an inapplicable batch and pushes it back, so the button
      // stayed enabled and did nothing however many times it was pressed: the one
      // action an author cannot recover from is the one they cannot take back.
      return { root: next, inverse: { kind: 'node.replace', id: op.node.id, node: place.node } };
    }

    case 'node.setClass':
      return field(root, op.id, 'class', op.value, (id, value) => ({
        kind: 'node.setClass',
        id,
        value: value as string | undefined,
      }));

    case 'node.setLabel':
      return field(root, op.id, 'label', op.value, (id, value) => ({
        kind: 'node.setLabel',
        id,
        value: value as string | undefined,
      }));

    case 'node.setData':
      return field(root, op.id, 'data', op.value, (id, value) => ({
        kind: 'node.setData',
        id,
        value: value as DataBinding | undefined,
      }));

    case 'node.setLocked':
      return field(root, op.id, 'locked', op.value, (id, value) => ({
        kind: 'node.setLocked',
        id,
        value: value as 'host' | 'author' | undefined,
      }));

    case 'node.setTag': {
      const place = findPlace(root, op.id);
      // Only an element HAS a tag. Setting one on a component or a host node would
      // produce a node that typechecks and renders as neither.
      if (place?.node.kind !== 'element') return undefined;
      const previous = place.node.tag;
      const next = replaceNode(root, op.id, { ...place.node, tag: op.value });
      if (!next) return undefined;
      return { root: next, inverse: { kind: 'node.setTag', id: op.id, value: previous } };
    }

    case 'node.setText': {
      const place = findPlace(root, op.id);
      if (!place) return undefined;
      const previous = readText(place.node);
      if (previous === undefined) return undefined;
      const next = replaceNode(root, op.id, { ...place.node, children: [op.value] });
      if (!next) return undefined;
      return { root: next, inverse: { kind: 'node.setText', id: op.id, value: previous } };
    }

    case 'node.setProp': {
      const place = findPlace(root, op.id);
      if (!place || place.node.kind === 'element') return undefined;
      const previous = place.node.props?.[op.key];
      const props = { ...place.node.props };
      if (op.value === undefined) delete props[op.key];
      else props[op.key] = op.value;
      const next = replaceNode(root, op.id, { ...place.node, props });
      if (!next) return undefined;
      return {
        root: next,
        inverse: { kind: 'node.setProp', id: op.id, key: op.key, value: previous },
      };
    }

    case 'node.setAttr': {
      const place = findPlace(root, op.id);
      if (place?.node.kind !== 'element') return undefined;
      const previous = place.node.attrs?.[op.key];
      const attrs = { ...place.node.attrs };
      if (op.value === undefined) delete attrs[op.key];
      else attrs[op.key] = op.value;
      const next = replaceNode(root, op.id, { ...place.node, attrs });
      if (!next) return undefined;
      return {
        root: next,
        inverse: { kind: 'node.setAttr', id: op.id, key: op.key, value: previous },
      };
    }
  }
}

/** The shared body of every "set one optional field" op. */
function field(
  root: Node,
  id: string,
  key: string,
  value: unknown,
  invert: (id: string, previous: unknown) => TreeOp
): TreeApplied | undefined {
  const place = findPlace(root, id);
  if (!place) return undefined;
  const previous = (place.node as unknown as Record<string, unknown>)[key];
  const next = replaceNode(root, id, setOptional(place.node, key, value));
  if (!next) return undefined;
  return { root: next, inverse: invert(id, previous) };
}
