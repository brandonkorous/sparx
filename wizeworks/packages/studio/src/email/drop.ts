// Turning a drop on an email canvas into the slot it means.
//
// Email's vocabulary is closed, so half the drops an author aims at are illegal:
// a section cannot go inside a column, a link group cannot hold another one. The
// site canvas can refuse those, because there almost every container holds almost
// anything. Here a refusal would be the COMMON case, and a drag that ends with
// nothing happening reads as a broken editor rather than as a rule.
//
// So a drop CLIMBS. The pointer names the deepest place the author might have
// meant; this walks outward from there and takes the first slot that can legally
// hold the block. Dropping a band onto a line of copy lands the band above that
// line's section — which is what the author was pointing at anyway.

import { canHold, type EmailNode } from '@wizeworks/silicaui-builder/email';
import type { DropPosition } from '../react/canvas/drop';
import {
  emailChildren,
  findEmailNode,
  findEmailPlace,
  isEmailContainer,
  isWithinEmail,
} from './walk';

export interface EmailDropTarget {
  parentId: string;
  index: number;
}

/** One candidate slot, innermost first. */
interface Candidate {
  parentId: string;
  index: number;
}

/** Every slot the pointer could mean, deepest first. */
function candidates(root: EmailNode, targetId: string, position: DropPosition): Candidate[] {
  const target = findEmailPlace(root, targetId);
  if (!target) return [];

  const out: Candidate[] = [];
  if (position === 'inside' && isEmailContainer(target.node)) {
    out.push({ parentId: target.node.id, index: emailChildren(target.node).length });
  }

  // Beside the target, then beside the target's parent, and so on outward.
  let current = target;
  let before = position === 'before';
  while (current.parent) {
    out.push({
      parentId: current.parent.id,
      index: before ? current.index : current.index + 1,
    });
    const next = findEmailPlace(root, current.parent.id);
    if (!next) break;
    current = next;
    // Above the first step the author's before/after aim no longer applies to
    // this node — landing after the ancestor is the one that reads as "out here".
    before = false;
  }
  return out;
}

/**
 * The slot a drop lands in, or undefined when nothing at or above the pointer
 * can hold this block.
 *
 * `moving` is the node being dragged, when this is a move rather than an insert:
 * lifting it out of a parent shifts everything after it down one, and an index
 * computed before the lift would put it one place too far along.
 */
export function resolveEmailDrop(
  root: EmailNode,
  hint: { targetId: string; position: DropPosition },
  node: EmailNode,
  moving?: { id: string }
): EmailDropTarget | undefined {
  for (const candidate of candidates(root, hint.targetId, hint.position)) {
    const parent = findEmailNode(root, candidate.parentId);
    if (!parent || !canHold(parent, node)) continue;

    let { index } = candidate;
    if (moving) {
      // Into itself or its own descendant is a tree that no longer contains its
      // root. Refused HERE as well as in `moveEmailNode`, so the drop indicator
      // never promises a landing the op will turn down.
      if (isWithinEmail(root, candidate.parentId, moving.id)) continue;
      const from = findEmailPlace(root, moving.id);
      if (from?.parent?.id === candidate.parentId && from.index < index) index -= 1;
    }
    return { parentId: candidate.parentId, index };
  }
  return undefined;
}

/**
 * Where a block lands when NOTHING is selected — the end of the email.
 *
 * "The end" is not the body, for most blocks. A body holds sections; a text block, a
 * button and an image live inside one. Appending them to the body is illegal, so the
 * obvious act — open Insert, click Text — was simply refused, and the author was left
 * clicking a row that did nothing.
 *
 * So: the LAST place at the end of the email that can actually hold this block. For a
 * section that is the body; for a text block it is the last section already there.
 * Undefined only when the email holds nowhere it could go at all, which is a real
 * answer worth saying out loud rather than a silent no-op.
 */
export function appendEmailSlot(root: EmailNode, node: EmailNode): EmailDropTarget | undefined {
  if (canHold(root, node)) return { parentId: root.id, index: emailChildren(root).length };

  const children = emailChildren(root);
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const child = children[i];
    if (!child) continue;
    const nested = appendEmailSlot(child, node);
    if (nested) return nested;
  }
  return undefined;
}
