// Opening an overlay from inside a menu item's click.
//
// Base UI closes a menu by measuring and committing synchronously (flushSync).
// Opening a dialog in the SAME click handler lands a second render inside that
// commit, and React rejects it: "flushSync was called from inside a lifecycle
// method." The dialog still appears — but the error is real, and the pattern is
// the kind that eventually produces a dropped update rather than a warning.
//
// Yielding one macrotask lets the menu finish closing first, which costs a
// frame nobody perceives and makes the interaction legal. Anything a menu item
// opens (confirm, dialog, popover) goes through here.

export function afterMenuClose(run: () => void): void {
  setTimeout(run, 0);
}

/**
 * Announce AFTER changing the panes.
 *
 * `ctx.open` / `ctx.close` commit the dock synchronously, and Base UI's
 * `toast.add` measures via flushSync — so raising a toast in the same callback
 * that replaced or closed a pane lands a flushSync inside a commit, which React
 * rejects ("flushSync was called from inside a lifecycle method"). Same root
 * cause as `afterMenuClose`, different trigger, so it gets its own name rather
 * than a menu-shaped one used for something that is not a menu.
 *
 * Mutate the panes first, then hand the toast to this.
 */
export function afterPaneChange(run: () => void): void {
  setTimeout(run, 0);
}

/**
 * Announce AFTER a mutation's own commit.
 *
 * The third trigger for the same root cause, and the easiest to walk into: a
 * React Query `onSuccess` runs while React is already rendering the commit that
 * the cache update provoked. Calling `setState` and then `toast.add` in that
 * callback puts Base UI's measuring flushSync inside that commit, and React
 * rejects it — reordering the two does not help, because the whole callback is
 * inside the commit.
 *
 * Seed your form state first, then hand the toast to this.
 */
export function afterCommit(run: () => void): void {
  setTimeout(run, 0);
}

/** Promise flavour, for `await deferTick()` before an async confirm. */
export function deferTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
