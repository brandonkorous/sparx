// Where a drop lands.
//
// Pure geometry, no DOM — the canvas measures, this decides. That split is what
// makes the rule testable: "does dropping left-of-centre in a row insert BEFORE"
// is a question about numbers, and answering it in a browser is how a
// drag-and-drop bug survives for months.
//
// The axis comes from the hovered node's REAL neighbours rather than from its
// classes. A flex row and a grid and a `float` all produce siblings sitting side
// by side, and the author aims at the gap they can see — so "before" has to mean
// left-of in a row and above in a stack, decided by where things actually are.

export type DropPosition = 'before' | 'after' | 'inside';

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** How much of the middle of a container reads as "drop inside it". */
const INSIDE_BAND = 0.3;

/** Do two boxes share enough of a horizontal band to be reading as one row? */
function sharesRow(a: Box, b: Box): boolean {
  const overlap = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  const shorter = Math.min(a.height, b.height);
  return shorter > 0 && overlap > shorter * 0.5;
}

/**
 * Which way this node's siblings run.
 *
 * A single child has no axis to read, and `y` is the honest default: a lone block
 * in a container is nearly always stacked, and guessing `x` would put the drop
 * indicator on an edge nobody is aiming at.
 */
export function siblingAxis(self: Box, siblings: readonly Box[]): 'x' | 'y' {
  return siblings.some((sibling) => sharesRow(self, sibling)) ? 'x' : 'y';
}

/**
 * Resolve a pointer over one node into a drop.
 *
 * An EMPTY container is always `inside`. Its box is the only thing on screen and
 * there is nothing in it to be before or after — offering an edge drop there is
 * how a section ends up as a sibling of the section the author meant to fill.
 */
export function dropPosition(
  pointer: Point,
  box: Box,
  axis: 'x' | 'y',
  container: { canHold: boolean; isEmpty: boolean }
): DropPosition {
  if (container.canHold && container.isEmpty) return 'inside';

  const span = axis === 'x' ? box.width : box.height;
  if (span <= 0) return 'after';
  const along = axis === 'x' ? pointer.x - box.left : pointer.y - box.top;
  const ratio = along / span;

  if (container.canHold && ratio > INSIDE_BAND && ratio < 1 - INSIDE_BAND) return 'inside';
  return ratio < 0.5 ? 'before' : 'after';
}

/** The parent and index a resolved drop turns into. */
export interface DropTarget {
  parentId: string;
  index: number;
}

/**
 * Turn a hint into the move it means.
 *
 * `index` counts against the target parent's children with the dragged node
 * already lifted out — which is what `moveNode` expects, and what a drop into the
 * SAME parent needs: dragging the second child to the end of a three-child row is
 * index 2, not 3, once it is no longer in the list.
 */
export function resolveDropTarget(
  position: DropPosition,
  target: { id: string; parentId?: string; indexInParent: number },
  moving?: { parentId?: string; indexInParent: number }
): DropTarget | undefined {
  if (position === 'inside') return { parentId: target.id, index: Number.MAX_SAFE_INTEGER };
  if (!target.parentId) return undefined;

  let index = position === 'before' ? target.indexInParent : target.indexInParent + 1;
  // Lifting the node out of this same parent shifts everything after it down one.
  if (moving?.parentId === target.parentId && moving.indexInParent < index) index -= 1;
  return { parentId: target.parentId, index };
}
