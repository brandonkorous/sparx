// The DOM half of hit-testing — measuring, and finding the node under a pointer.
//
// Kept apart from `drop.ts` so the RULE (where a drop lands) stays pure and
// testable and only the measuring needs a browser.

import type { Box } from './drop';

/** The nearest node element at or above `target`, within `root`. */
export function nodeElementAt(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  if (!(target instanceof globalThis.Node)) return null;
  const start = target instanceof HTMLElement ? target : target.parentElement;
  const found = start?.closest<HTMLElement>('[data-sui-id]') ?? null;
  return found && root.contains(found) ? found : null;
}

export function idOfElement(element: HTMLElement | null): string | undefined {
  return element?.dataset.suiId;
}

export function boxOf(element: Element): Box {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** The boxes of this element's element siblings — the evidence the drop axis is
 *  read from. Text nodes are skipped; they have no box to compare. */
export function siblingBoxes(element: HTMLElement): Box[] {
  const parent = element.parentElement;
  if (!parent) return [];
  const boxes: Box[] = [];
  for (const sibling of parent.children) {
    if (sibling !== element) boxes.push(boxOf(sibling));
  }
  return boxes;
}
