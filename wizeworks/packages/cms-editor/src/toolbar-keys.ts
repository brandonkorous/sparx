// One Tab stop for the formatting toolbar, with the arrow keys inside it.
//
// The toolbar was fourteen Tab stops between a piece's standfirst and its body:
// Bold, Italic, Strikethrough and eleven more, every time a writer tabbed through
// the form (P09, issue 953). The ARIA toolbar pattern is one stop for the whole
// row, the arrows to move along it, Home and End to its ends.

/** Where the arrow keys move focus in a row of `count` tools, or null for any other key. */
export function nextToolIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  const at = current < 0 ? 0 : current;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (at + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (at - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** The tools in a toolbar a keyboard can land on, in order. */
export function toolsIn(toolbar: HTMLElement | null): HTMLButtonElement[] {
  if (!toolbar) return [];
  return [...toolbar.querySelectorAll<HTMLButtonElement>('button[data-tool]')].filter(
    (button) => !button.disabled
  );
}
