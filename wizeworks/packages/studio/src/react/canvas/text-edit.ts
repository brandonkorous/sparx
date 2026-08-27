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

/**
 * The words currently in the element — what the author has typed so far.
 *
 * Non-breaking spaces come back as ordinary ones. Browsers put them in by
 * themselves while you type, to stop a space at the end of a line collapsing to
 * nothing, and they are invisible on screen and in the Words box — so without
 * this they ride into the saved copy, the search description and the published
 * HTML as a character nobody typed and nobody can see.
 */
export function textIn(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\u00a0/g, ' ');
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

/**
 * Whether this element's own keyboard behavior eats the space bar.
 *
 * A `<button>` and a `<summary>` both answer the space bar by activating, and
 * they go on doing it while they are contenteditable — so retyping the words on
 * a button, or a question in the Questions people ask block, ran every word
 * together: "How do I swap" arrived as "HowdoIswap" (issue 264).
 *
 * Only these are intercepted. Everywhere else the browser's own space handling
 * is better than anything we would write, because it knows when a space at the
 * end of a line has to hold its width and when it may collapse.
 */
export function swallowsSpace(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === 'button' || tag === 'summary') return true;
  return SPACE_ROLES.has(element.getAttribute('role') ?? '');
}

/** Roles whose contract is "the space bar activates me", per ARIA. */
const SPACE_ROLES = new Set([
  'button',
  'checkbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'switch',
  'tab',
]);

/**
 * Put a space at the caret, for the controls that would have swallowed it.
 *
 * Through `execCommand` rather than our own `insertText`, because that is the
 * pipeline the space bar itself would have used: it knows a space at the END of
 * the words has to be held open, where a bare text node of one space is
 * unrendered whitespace and Chrome discards it the moment the next character
 * arrives — which is how "How do I swap" still came out "HowdoIswap" with the
 * key handler already in place.
 */
export function typeSpace(): void {
  const doc = globalThis.document as Document & {
    execCommand?: (command: string, showUi?: boolean, value?: string) => boolean;
  };
  if (doc.execCommand?.('insertText', false, ' ')) return;
  insertText(' ');
}
