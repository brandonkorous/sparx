// WHAT THE "ENTRIES" COLUMN SAYS — AND THE TWO DIFFERENT NOTHINGS IT HAS TO TELL
// APART.
//
// The counts arrive as one map from /v1/content/reports/summary, and reading it
// asks two questions that look identical in TypeScript and mean opposite things:
//
//   the MAP is undefined   → the overlay has not arrived (or it failed). We do
//                            not know the number. Say nothing.
//   a KEY is missing from
//   a loaded map           → the number is ZERO. The server groups over the rows
//                            that exist, so a type nobody has used is simply not
//                            in the response.
//
// The data layer's own note already wrote that rule down — "a missing key means
// zero" — and the cell read `counts?.get(key)` and printed a blank for both
// ([[feedback_a_fix_leaves_its_neighbour_behind]]).
//
// So "No entries yet" could never render for the case it was written for. On the
// account this was found on, nine of eleven rows had an empty Entries cell,
// including the owner's OWN type — the one she defined and has not filled in
// yet, which is exactly the row a person opens this screen to look at. A blank
// under a column headed "Entries" reads as a screen that did not finish loading
// ([[feedback_never_present_absence_as_measurement]], pointing the other way:
// here a measured zero is dressed up as an unknown).
//
// Both readers take the MAP, never a looked-up row, so a caller cannot lose the
// distinction on the way in.

/** How many entries use a type: on this site, and across the whole business. */
export interface EntryCounts {
  /** On the site being worked in — what the "Entries" column means. */
  here: number;
  /** Across every site — what a delete has to reckon with (issue 389). */
  allSites: number;
}

/**
 * The first line of the Entries cell.
 *
 * Empty string ONLY while the number is genuinely unknown. Once the map is in
 * hand, every type has an answer, and zero is an answer.
 */
export function entriesHereLabel(
  counts: ReadonlyMap<string, EntryCounts> | undefined,
  key: string
): string {
  if (counts === undefined) return '';
  const here = counts.get(key)?.here ?? 0;
  if (here === 0) return 'No entries yet';
  return `${String(here)} ${here === 1 ? 'entry' : 'entries'}`;
}

/**
 * The second line: how many of this type live on the business's OTHER websites.
 *
 * Null when there is nothing to add, so a business with one site never reads a
 * sentence about sites it does not have. The gap matters because the column
 * counts this site while the server refuses a delete tenant-wide — an
 * unexplained gap is how "No entries yet" ends up above a Delete that fails
 * (issue 389).
 */
export function entriesElsewhereLabel(
  counts: ReadonlyMap<string, EntryCounts> | undefined,
  key: string
): string | null {
  if (counts === undefined) return null;
  const row = counts.get(key);
  if (row === undefined) return null;
  const elsewhere = row.allSites - row.here;
  if (elsewhere <= 0) return null;
  return `${String(elsewhere)} on your other sites`;
}

/**
 * What the Delete confirmation says before it removes a type.
 *
 * THREE branches, not two. The server refuses a delete tenant-wide, so the
 * number this sentence needs is `allSites` — and when the numbers have not
 * arrived there is no number at all. Reading that as zero prints "this removes
 * the type for good" over a delete the server then refuses, which is issue 389's
 * hazard reached by the loading door instead of the scoping one.
 *
 * So an unknown says it is unknown, and says what will happen either way. It
 * never blocks the button: a counts request that failed must not take Delete
 * with it.
 */
export function deleteTypeWarning(
  counts: ReadonlyMap<string, EntryCounts> | undefined,
  key: string,
  typeName: string
): string {
  if (counts === undefined) {
    return (
      `We could not check how much content uses the “${typeName}” type. If any does, ` +
      'the delete will be refused and nothing will change. If none does, this removes ' +
      'the type and its fields for good, which cannot be undone.'
    );
  }

  const row = counts.get(key) ?? { here: 0, allSites: 0 };
  if (row.allSites === 0) {
    return `This removes the “${typeName}” type and its fields for good. This cannot be undone.`;
  }

  const elsewhere = Math.max(0, row.allSites - row.here);
  // The clause that stops "3 entries use this type" reading as a lie on a screen
  // whose own list shows none of them. Empty when they are all on this site.
  const elsewhereClause =
    elsewhere > 0
      ? ` ${String(elsewhere)} of them ${elsewhere === 1 ? 'is' : 'are'} on your other sites.`
      : '';

  return (
    `${String(row.allSites)} ${row.allSites === 1 ? 'entry uses' : 'entries use'} this type.` +
    `${elsewhereClause} You cannot delete it until those are removed: archiving them is not ` +
    'enough. This cannot be undone.'
  );
}

/**
 * The one line under "Delete this type" on the type's own screen.
 *
 * The short twin of `deleteTypeWarning`, and it has the same three branches for
 * the same reason: this line is what a person reads BEFORE pressing the button,
 * so it is the one that must not promise a delete nobody has checked.
 */
export function deleteTypeRowNote(
  counts: ReadonlyMap<string, EntryCounts> | undefined,
  key: string
): string {
  if (counts === undefined) {
    return 'We could not check how much content uses it. If any does, the delete will be refused.';
  }

  const row = counts.get(key) ?? { here: 0, allSites: 0 };
  if (row.allSites === 0) return 'Removes the type and its fields for good. This cannot be undone.';

  const elsewhere = Math.max(0, row.allSites - row.here);
  const elsewhereClause =
    elsewhere > 0
      ? ` ${String(elsewhere)} of them ${elsewhere === 1 ? 'is' : 'are'} on your other sites.`
      : '';
  return (
    `${String(row.allSites)} ${row.allSites === 1 ? 'entry uses' : 'entries use'} it, so it ` +
    `cannot be deleted yet.${elsewhereClause}`
  );
}
