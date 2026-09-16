'use client';

// Mounts the clipped-text rule (clipped-text.ts) on the document, once per app.
//
// Delegated rather than per-element: 991 clipping spans would be 991 observers,
// and the answer is only ever wanted for the one under the pointer. A pointer
// that never stops over a clipped name costs nothing at all.
//
// Keyboard too. `focusin` fires for a link or a button reached by Tab, so a name
// clipped inside a focusable row is reachable without a mouse.

import { useEffect } from 'react';

import { clippedTitleFor } from './clipped-text';

/** Marks a `title` this put there, so it can be taken back off and an author's
 *  own is never mistaken for ours. */
const OURS = 'data-clipped-title';

/** How far up from the event target to look for the element that is clipping.
 *  The text usually sits in a span inside the cell that does the clipping, and
 *  a hover lands on whichever is on top; three levels covers both without
 *  walking the whole ancestor chain on every pointer move. */
const LOOKUP_DEPTH = 3;

function reveal(element: Element): void {
  if (!(element instanceof HTMLElement)) return;

  const marked = element.hasAttribute(OURS);
  const title = clippedTitleFor({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    text: element.textContent ?? '',
    // A title WE wrote does not count as the author's, or the text could never
    // be refreshed and a stale one could never be removed.
    existingTitle: marked ? null : element.getAttribute('title'),
  });

  if (title === null) {
    // No longer clipped — the pane was widened, or the text changed. Take back
    // only what we put there.
    if (marked) {
      element.removeAttribute('title');
      element.removeAttribute(OURS);
    }
    return;
  }

  if (element.getAttribute('title') === title) return;
  element.setAttribute('title', title);
  element.setAttribute(OURS, '');
}

function onPointer(event: Event): void {
  let node = event.target;
  for (let depth = 0; depth < LOOKUP_DEPTH && node instanceof Element; depth++) {
    reveal(node);
    node = node.parentElement;
  }
}

/**
 * Makes clipped text readable everywhere in the app.
 *
 * Renders nothing. Mount it once, beside the other window-level listeners.
 */
export function ClippedTextReveal(): null {
  useEffect(() => {
    // `pointerover` rather than `mouseover` so a pen or a touch that hovers is
    // treated the same as a mouse. Passive: this never calls preventDefault.
    const options = { capture: true, passive: true } as const;
    document.addEventListener('pointerover', onPointer, options);
    document.addEventListener('focusin', onPointer, options);
    return () => {
      document.removeEventListener('pointerover', onPointer, options);
      document.removeEventListener('focusin', onPointer, options);
    };
  }, []);

  return null;
}
