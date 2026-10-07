// Whose browser storage this is.
//
// The workbench keeps some things in the browser: which panes are open and how
// they are arranged, named arrangements, the list-or-board choice, notices
// already read. Those belong to a PERSON. Other things belong to the computer:
// zoom, window mode, theme, the phone to call from, the scanner's queue. Those
// stay as they are.
//
// MEASURED 2026-10-06 on Gillett Diesel: Mike Van Der Berg signed in on the
// computer Doty Brown uses and opened onto Doty's 155 tabs, her invoice previews
// and settings panes among them. Every person's change then rearranged the
// other's work. The keys named the site and never the person (sparx persona
// issue 123).
//
// The owner is set by the shell, from the server's session, before anything
// below it reads storage. A key read before that lands in a bucket no signed-in
// person uses, never in someone else's.

// On `globalThis`, not in a module variable: a dev reload re-runs this module
// with the variable empty while the panes keep saving, and those saves landed in
// the "nobody" bucket. One window is one signed-in person, so one slot is right.
const slot = globalThis as { __workbenchStorageOwner?: string };

/** Called by the shell on every render, before its children read storage. */
export function setStorageOwner(userId: string): void {
  slot.__workbenchStorageOwner = userId;
}

/**
 * The key for something that belongs to the signed-in person.
 *
 * A value saved before keys carried a person has no owner. The first person to
 * read it adopts it, and it is removed in the same step, so it goes to exactly
 * one person. On a computer with one user, that is them.
 */
export function personalKey(key: string): string {
  const owner = slot.__workbenchStorageOwner;
  if (owner === undefined) return `${key}@nobody`;
  const scoped = `${key}@${owner}`;
  if (typeof localStorage === 'undefined') return scoped;
  try {
    if (localStorage.getItem(scoped) === null) {
      const unowned = localStorage.getItem(key);
      if (unowned !== null) {
        localStorage.setItem(scoped, unowned);
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage blocked or full. The scoped key still keeps people apart.
  }
  return scoped;
}
