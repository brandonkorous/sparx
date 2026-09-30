// What a half-finished price-list save is allowed to say.
//
// ── THE SENTENCE THIS EXISTS FOR ────────────────────────────────────────────
//
// Saving a price list is THREE requests, not one, and each commits on its own:
//
//   1. PATCH the list        name, currency, who gets it, dates, which sites
//   2. DELETE each removed price
//   3. POST the prices       the whole remaining set, in one call
//
// The catch around all three said:
//
//     Could not save this price list. Nothing was changed.
//
// which is true of exactly one of the three. If step 3 fails, the settings are
// already written and the prices she deleted are already gone — the one case
// where "nothing was changed" is the most damaging thing to say, because it
// tells her the deletions did not happen either.
//
// There is no transaction to reach for: they are three HTTP calls to a server
// that commits each one. So the sentence has to know how far it got, which is
// what `stage` is.
//
// ── THE OTHER HALF ──────────────────────────────────────────────────────────
//
// Creating a list has the same shape and used to say nothing at all. The entries
// write was `.catch(() => undefined)` with a comment calling the failure "soft",
// and the pane then landed on the new list and announced "<name> created". A
// price list created with no prices, reported as a success, with the typed
// prices gone and no message anywhere. `createdWithoutPrices` is what it says
// instead.

/** How far a save got before it failed. */
export type SavePoint =
  /** The PATCH itself. Nothing has been written. */
  | 'settings'
  /** Removing a price the editor dropped. The settings are already saved. */
  | 'removals'
  /** Writing the prices. The settings are saved and the removals are done. */
  | 'prices';

/**
 * The banner above a failed save.
 *
 * `detail` is the server's own sentence where it had one; this is the sentence
 * about WHAT IS NOW TRUE OF THE LIST, which the server cannot know.
 */
export function saveFailureLine(point: SavePoint, removedCount: number): string {
  if (point === 'settings') {
    return 'Could not save this special price. Nothing was changed.';
  }

  const gone =
    removedCount === 0
      ? ''
      : removedCount === 1
        ? ' The price you took off the list has already gone.'
        : ` The ${String(removedCount)} prices you took off the list have already gone.`;

  if (point === 'removals') {
    return (
      'The list itself was saved, but its prices were not.' +
      gone +
      ' Check the prices below, then save again.'
    );
  }

  return (
    'The list itself was saved, but its prices were not.' +
    gone +
    ' Nothing you typed has been lost: save again.'
  );
}

/** The toast when a list is created but its prices do not land. */
export function createdWithoutPrices(name: string, count: number): string {
  const priced = count === 1 ? 'its price' : `its ${String(count)} prices`;
  return `${name} was created, but ${priced} could not be saved. Add ${count === 1 ? 'it' : 'them'} again on the list.`;
}
