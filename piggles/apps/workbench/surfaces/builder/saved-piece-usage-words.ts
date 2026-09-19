// WHICH "CONTACT"?
//
// A saved piece belongs to the whole business, not to one site: the components
// endpoint is tenant-scoped on purpose (docs/53), so one library serves every
// site the owner runs. Pages are the opposite — each belongs to exactly one
// site, and a business running seven sites from one starter has seven pages
// called "Contact".
//
// So "Where it's used" listed page NAMES from a tenant-wide scan, and the two
// facts did not meet. Measured 2026-09-17 on one account: six sites, six pages
// named Contact, and a where-used list with nothing on it to say which.
//
// Worse than ambiguous, it was wrong on click. Opening a page id that belongs to
// another site, while standing in this one, resolves to nothing and the editor
// says:
//
//     This page isn't here any more. It may have been deleted.
//
// The page is not deleted. It is one site over, exactly where she left it, and
// the console has just told her otherwise ([[feedback_never_present_absence_as_measurement]]).

/** One placement, as the server hands it over. */
export interface Placement {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
}

/**
 * Whether the list must name the site each placement sits on.
 *
 * Three answers, in this order:
 *
 *   · Rows spanning MORE THAN ONE site are ambiguous on their own terms,
 *     wherever the reader happens to be standing. Say it.
 *   · With the active site unknown (the shell has not resolved it yet), a single
 *     site cannot be called "elsewhere" without guessing. Say nothing rather
 *     than flicker a claim on and off.
 *   · Otherwise, say it exactly when the one site is not the one she is in.
 *
 * And when it is said, it is said on EVERY row, local ones included. A list
 * where only some rows carry a site reads as though the rest have none.
 */
export function namesSites(rows: readonly Placement[], activeSiteId: string | null): boolean {
  if (rows.length === 0) return false;
  const sites = new Set(rows.map((row) => row.siteId));
  if (sites.size > 1) return true;
  if (activeSiteId === null) return false;
  return !sites.has(activeSiteId);
}

/**
 * Whether opening this row means leaving the site the owner is in.
 *
 * `null` active site answers false: not knowing where she is is not evidence
 * that she is somewhere else, and a wrong `true` here would offer to reload her
 * workbench for no reason.
 */
export function isElsewhere(row: Placement, activeSiteId: string | null): boolean {
  return activeSiteId !== null && row.siteId !== activeSiteId;
}

/** The sentence on the dialog that asks before a cross-site open. A site switch
 *  reloads the workbench, so it is the same conversation the site switcher and
 *  the cross-business link both hold — a row must not be a quieter way to lose
 *  somebody's unsaved work than a menu is. */
export function switchAsk(row: Placement): { title: string; description: string } {
  return {
    title: `Open ${row.name} on ${row.siteName}?`,
    description:
      `${row.name} belongs to ${row.siteName}, not the site you are in. ` +
      'Opening it switches over and reloads, and anything here with unsaved edits will be lost.',
  };
}

/**
 * The one sentence saying a saved piece is not per-site.
 *
 * My Site is otherwise a per-site app end to end — pages, header and footer,
 * look and feel, publish all belong to the site in the switcher. Saved pieces is
 * the exception, and nothing said so: standing in Juniper Row Archive the list
 * showed a piece whose note read "Lives at the bottom of Contact; reuse it on
 * Trade" — the owner's own words about a different site.
 *
 * Only for an owner who HAS more than one site. To everybody else it is a
 * distinction without a difference, and a caveat that never applies is noise.
 */
export function sharedLibraryNote(siteCount: number): string | null {
  if (siteCount <= 1) return null;
  return 'These belong to your whole business, not to one site. A piece can go on any of your sites, and changing it here changes it everywhere it is used.';
}
