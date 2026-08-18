import { describe, expect, it } from 'vitest';
import { dropPosition, resolveDropTarget, siblingAxis, type Box } from './drop';

const box = (top: number, left: number, width = 100, height = 40): Box => ({
  top,
  left,
  width,
  height,
});

const LEAF = { canHold: false, isEmpty: false };
const CONTAINER = { canHold: true, isEmpty: false };

describe('reading the axis off real neighbours', () => {
  it('calls siblings sharing a horizontal band a row', () => {
    // A flex row, a grid and a float all look like this, and the author aims at
    // the gap they can see — so "before" has to mean left-of.
    const self = box(0, 0);
    expect(siblingAxis(self, [box(0, 110)])).toBe('x');
  });

  it('calls stacked siblings a column', () => {
    expect(siblingAxis(box(0, 0), [box(50, 0)])).toBe('y');
  });

  it('defaults an only child to a column', () => {
    // Guessing `x` would put the drop indicator on an edge nobody is aiming at.
    expect(siblingAxis(box(0, 0), [])).toBe('y');
  });
});

describe('resolving a pointer into a drop', () => {
  it('splits a leaf down the middle of its axis', () => {
    expect(dropPosition({ x: 0, y: 5 }, box(0, 0), 'y', LEAF)).toBe('before');
    expect(dropPosition({ x: 0, y: 35 }, box(0, 0), 'y', LEAF)).toBe('after');
    expect(dropPosition({ x: 10, y: 0 }, box(0, 0), 'x', LEAF)).toBe('before');
    expect(dropPosition({ x: 90, y: 0 }, box(0, 0), 'x', LEAF)).toBe('after');
  });

  it('gives a container a middle band that means "inside"', () => {
    expect(dropPosition({ x: 0, y: 20 }, box(0, 0), 'y', CONTAINER)).toBe('inside');
    expect(dropPosition({ x: 0, y: 2 }, box(0, 0), 'y', CONTAINER)).toBe('before');
    expect(dropPosition({ x: 0, y: 38 }, box(0, 0), 'y', CONTAINER)).toBe('after');
  });

  it('always drops inside an empty container', () => {
    // Its box is the only thing on screen; offering an edge is how a section ends
    // up a sibling of the section the author meant to fill.
    const empty = { canHold: true, isEmpty: true };
    expect(dropPosition({ x: 0, y: 1 }, box(0, 0), 'y', empty)).toBe('inside');
    expect(dropPosition({ x: 0, y: 39 }, box(0, 0), 'y', empty)).toBe('inside');
  });

  it('does not divide by a zero-height box', () => {
    expect(dropPosition({ x: 0, y: 0 }, box(0, 0, 0, 0), 'y', LEAF)).toBe('after');
  });
});

describe('turning a hint into a move', () => {
  const target = { id: 'b', parentId: 'root', indexInParent: 1 };

  it('places before and after around the target', () => {
    expect(resolveDropTarget('before', target)).toEqual({ parentId: 'root', index: 1 });
    expect(resolveDropTarget('after', target)).toEqual({ parentId: 'root', index: 2 });
  });

  it('appends when dropping inside', () => {
    expect(resolveDropTarget('inside', target)?.parentId).toBe('b');
  });

  it('accounts for the dragged node leaving the same parent', () => {
    // Dragging the FIRST child to sit after the second is index 1, not 2 — the
    // list it lands in no longer contains it. Getting this wrong moves a node one
    // slot short of where it was dropped, every time, in one direction only.
    const moving = { parentId: 'root', indexInParent: 0 };
    expect(resolveDropTarget('after', target, moving)).toEqual({ parentId: 'root', index: 1 });
  });

  it('leaves the index alone when the node comes from another parent', () => {
    const moving = { parentId: 'other', indexInParent: 0 };
    expect(resolveDropTarget('after', target, moving)).toEqual({ parentId: 'root', index: 2 });
  });

  it('refuses an edge drop on a root that has no parent', () => {
    expect(resolveDropTarget('before', { id: 'root', indexInParent: -1 })).toBeUndefined();
  });
});
