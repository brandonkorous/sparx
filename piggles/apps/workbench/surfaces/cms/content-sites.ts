// Saying which of her sites a page is on, in a table cell (issue 870).
//
// A page is either PINNED to some of the business's websites or on ALL of them,
// and "all" is spelled as the EMPTY list. That makes the two cases easy to
// confuse and important not to: a page on every site is one that all of her
// businesses publish, so editing it edits all of them at once. On her Journal
// she saw nine rows, six of which were those shared pages, and nothing on screen
// told them apart.
//
// A missing list is a THIRD case and must not collapse into either. The server
// now sends the scope on every list row, so `undefined` only happens on a
// response cached from before that shipped; drawing "All sites" over it would
// state something nobody measured.
//
// Logic lives here rather than in the table because a `.tsx` cannot be imported
// by vitest in this app (`jsx: preserve`).

export interface SiteScopeCell {
  /** What the cell says. */
  text: string;
  /**
   * The case worth a color: this page is on every one of her sites. It is not a
   * warning (nothing is wrong) and not a default (most pages are pinned) — it is
   * the fact that changes what an edit means.
   */
  everySite: boolean;
}

/**
 * What a list row should say about its sites, or null when it should say nothing.
 *
 * `nameOf` looks a site id up. An id it does not know is NOT dropped: a page
 * pinned to a site that has since been removed is still pinned to something, and
 * counting it is honest where naming it would be invention.
 */
export function siteScopeCell(
  propertyIds: readonly string[] | undefined,
  nameOf: (id: string) => string | undefined
): SiteScopeCell | null {
  if (propertyIds === undefined) return null;
  if (propertyIds.length === 0) return { text: 'All sites', everySite: true };

  const names = propertyIds
    .map((id) => nameOf(id))
    .filter((name): name is string => name !== '' && name !== undefined);

  // Every id named, and few enough to read: say them. Two is the most any entry
  // on the platform carries today, and a name beats a count wherever it fits.
  if (names.length === propertyIds.length && propertyIds.length <= 2) {
    return { text: names.join(' and '), everySite: false };
  }

  const n = propertyIds.length;
  return { text: `${String(n)} ${n === 1 ? 'site' : 'sites'}`, everySite: false };
}

/**
 * Whether the column belongs on screen at all. One website is not a choice, so
 * a column headed "Sites" would invent one — the same rule the shared site-scope
 * field follows on every editor that has it.
 */
export function showSiteColumn(siteCount: number): boolean {
  return siteCount > 1;
}
