// Typing into the page itself.
//
// The DOM half of inline editing: where the caret goes, what a paste is allowed
// to carry, and what a node's element currently reads. The RULE half — which
// nodes can be typed into at all — is `ownText` in `tree/walk.ts`, shared with
// the Inspector's Words box so the two routes to the same edit agree.
//
// Nothing here writes to the tree. Committing is an op like every other edit
// (`node.setText`), so undo, the dirty flag and a second pane on the same
// document all keep working without knowing this exists.

/** The words currently in the element — what the author has typed so far. */
export function textIn(element: HTMLElement): string {
  return element.textContent ?? '';
}

/**
 * Put the caret where the author double-clicked, rather than at one end.
 *
 * They aimed at a word. Dropping the caret at the start of a heading and making
 * them arrow across to it is the sort of small tax that adds up over the forty
 * edits a page rewrite really takes.
 */
export function caretAt(element: HTMLElement, x: number, y: number): void {
  element.focus();
  const selection = globalThis.getSelection?.();
  if (!selection) return;
  const range = rangeAtPoint(x, y);
  if (range) {
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }
  selection.selectAllChildren(element);
  selection.collapseToEnd();
}

/** The browser's caret-from-a-point, whichever spelling this engine has. */
function rangeAtPoint(x: number, y: number): Range | null {
  const doc = globalThis.document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) {
    const range = doc.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return doc.caretRangeFromPoint?.(x, y) ?? null;
}

/**
 * Paste, as words only.
 *
 * Whatever is on the clipboard — a styled paragraph out of a document, a table
 * cell, half a web page — arrives here as its plain text and nothing else. The
 * alternative is a tree that holds markup the builder cannot see, edit or
 * publish, from a gesture nobody thinks of as importing HTML.
 */
export function pasteAsText(event: ClipboardEvent | React.ClipboardEvent): void {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (!text) return;
  insertText(text.replace(/\s*\n\s*/g, ' '));
}

/** Drop text at the caret, replacing any selection. */
function insertText(text: string): void {
  const selection = globalThis.getSelection?.();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!selection || !range) return;
  range.deleteContents();
  const node = globalThis.document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
