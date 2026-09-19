// The sentences on "Where this number came from", when the count is one.
//
// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------
//
// Juniper Row, Linen Shirtdress, size L indigo. The pane whose whole job is to
// make a stock figure trustworthy opened with this:
//
//     This number adds up
//     Every one of the 1 recorded change to this item here, added together,
//     comes to exactly 6. Nothing has moved that was not written down.
//
// and four inches below it:
//
//     What changed it
//     The most recent 1 of 1 recorded change, newest first. The running total
//     is what the number was immediately after each one.
//
// "Every one of the 1". "Added together" over one thing. "Each one" over one
// thing. "The most recent 1 of 1."
//
// A `plural()` helper made the NOUN agree and left the rest of the sentence
// plural, which is a shape that reads fine in the source and only breaks on the
// screen. The pane is the trust argument for every stock figure in the product;
// a sentence that reads like a machine wrote it argues the other way.
//
// ---------------------------------------------------------------------------
// Measured
// ---------------------------------------------------------------------------
//
// 54 of Juniper Row's 74 stock rows have exactly one recorded change, so the
// broken sentence is the MAJORITY case on her shop, not an edge.
//
// "The most recent N of M" was worse than awkward: the pane asks for 20
// movements and no stock level on the whole platform has more than 5, so shown
// has always equalled the total. The sentence implied a truncation that has
// never once happened.
//
// Five stock levels platform-wide have NO recorded movement at all. They got
// the green tick and "Every one of the 0 recorded changes ... comes to exactly
// 0. Nothing has moved that was not written down." — a verified-looking claim
// over an empty ledger, which is absence presented as a measurement. That count
// gets its own words and its own tone below, and `RecentChanges` already had
// the right sentence for it, so this file uses the same one.

/** What the banner over the figure says, and how sure it is allowed to look. */
export interface ReconcileWords {
  /** The heading. */
  title: string;
  /** The sentence under it. */
  detail: string;
  /**
   * `true` only when there is a history to have checked. A green tick over an
   * empty ledger says the number was verified when nothing was.
   */
  checked: boolean;
}

/**
 * The banner for a figure that agrees with its own history.
 *
 * `movementCount` is every change ever recorded against this item at this
 * location; `onHand` is the figure, already formatted by the caller so this
 * file stays a leaf with no number-format opinion.
 */
export function reconcileWords(movementCount: number, onHand: string): ReconcileWords {
  if (movementCount <= 0) {
    return {
      title: 'Nothing has moved this item here',
      detail:
        'The number is ' +
        onHand +
        ' because it has never been anything else. There is no history to add up yet.',
      checked: false,
    };
  }
  if (movementCount === 1) {
    return {
      title: 'This number adds up',
      detail:
        'The one change ever recorded against this item here comes to exactly ' +
        onHand +
        '. Nothing has moved that was not written down.',
      checked: true,
    };
  }
  return {
    title: 'This number adds up',
    detail:
      'Every one of the ' +
      String(movementCount) +
      ' recorded changes to this item here, added together, comes to exactly ' +
      onHand +
      '. Nothing has moved that was not written down.',
    checked: true,
  };
}

/**
 * The sentence over the table of changes.
 *
 * `shown` is how many rows the table is about to draw, `total` how many exist.
 * "The most recent N of M" is only honest when some were left out, which on
 * every stock level measured so far has never been true.
 */
export function recentChangesWords(shown: number, total: number): string {
  const after =
    total === 1
      ? 'The running total is what the number was immediately after it.'
      : 'The running total is what the number was immediately after each one.';

  if (total === 1) {
    return 'The one change ever recorded against this item here. ' + after;
  }
  if (shown >= total) {
    return 'All ' + String(total) + ' recorded changes, newest first. ' + after;
  }
  return (
    'The most recent ' +
    String(shown) +
    ' of ' +
    String(total) +
    ' recorded changes, newest first. ' +
    after
  );
}
