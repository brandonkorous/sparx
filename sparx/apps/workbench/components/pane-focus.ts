// Where the keyboard goes in the workspace, as plain functions with no component
// in them, so the dock controller and a test can both reach them.
//
// The pane in front is dockview's to say (`.dv-active-group`), the same marker the
// piggles console's skip link reads.

/** Whether nothing holds focus: the page itself, or nothing at all. */
export function focusWasLost(active: Element | null, body: Element | null): boolean {
  return active === null || active === body;
}

/** The dock that holds every open pane — what the control focuses, and what
 *  `WorkbenchShell` puts on its `<main>`. */
export const WORKSPACE_ID = 'workspace';

/** Dockview's own marker for the focused group, and the body inside it. */
const ACTIVE_PANE_BODY = '.dv-active-group .dv-content-container';

/** Move focus to the pane in front, else to the workspace itself. The pane body is a
 *  plain container, so it takes focus only if told it may; -1 keeps it out of the Tab
 *  order, where it would be one more stop. */
export function focusActivePane(): void {
  const body = document.querySelector<HTMLElement>(ACTIVE_PANE_BODY);
  const target = body ?? document.getElementById(WORKSPACE_ID);
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus();
}

/**
 * After something opens in a pane, put the keyboard there.
 *
 * Called when the "What do you want to do?" box opens a row, and when a pane is
 * retargeted in place (a new piece becoming the piece once it is created).
 *
 * The box closed and handed focus back to whatever had it before, which for a
 * keyboard user who pressed Ctrl K was the page itself. Rosalind opened "Write
 * something new" and her next Tab went to the rail, thirty stops from the form she
 * had just asked for (P09). Only when focus was lost: a row that opens its own
 * dialog has already put the keyboard where it belongs.
 */
export function focusOpenedPane(): void {
  if (focusWasLost(document.activeElement, document.body)) focusActivePane();
}
