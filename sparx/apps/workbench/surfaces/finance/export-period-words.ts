// What the accounting export says about the period it is about to send.
//
// The period picker defaults to LAST month, because a finished month is the one
// an accountant wants. That is a good default and it has one bad consequence:
// on the 16th of September, a shop that recorded five costs this month opens the
// screen, reads "no costs recorded", and has every reason to think its costs
// have gone missing or that the export is broken.
//
// "No costs recorded" is one sentence covering two different situations that
// need different reactions:
//
//   • nothing has ever been recorded  → there is nothing to send, record some
//   • nothing in THIS period          → the file is empty because of the picker
//
// The second is the common one and the alarming one, and the screen already
// knows which it is looking at. So it says which.

/** What the two cheap count queries came back with. */
export interface PeriodCounts {
  /** Costs inside the chosen period. */
  inPeriod: number;
  /** Costs this business has recorded at all, any period. */
  everRecorded: number;
}

/** The count, in words: "3 costs", "1 cost". */
function costs(n: number): string {
  return n === 1 ? '1 cost' : `${String(n)} costs`;
}

/**
 * The clause that follows the dates, or null while the counts are still loading.
 *
 * Null rather than a guess: a count is the whole point of the sentence, and
 * "no costs recorded" printed before the answer arrives is the alarming reading
 * shown for free on every load.
 */
export function periodCountLine(counts: PeriodCounts | null | undefined): string | null {
  if (!counts) return null;
  if (counts.inPeriod > 0) return costs(counts.inPeriod);
  if (counts.everRecorded > 0) {
    return `nothing in this period, though you have ${costs(counts.everRecorded)} recorded`;
  }
  return 'no costs recorded yet';
}

/**
 * Whether to explain the default, and how.
 *
 * Only worth saying when the period is empty AND there is spending elsewhere:
 * that is the moment the reader is deciding whether the screen is broken. A shop
 * with costs in the period does not need telling how the picker works, and a
 * shop with no costs at all needs to record one, not to change the period.
 */
export function explainEmptyPeriod(
  counts: PeriodCounts | null | undefined,
  isDefaultPeriod: boolean
): string | null {
  if (!counts || counts.inPeriod > 0 || counts.everRecorded === 0) return null;
  return isDefaultPeriod
    ? 'Last month is what an accountant usually wants, because it is finished. Change the period above to send a different one.'
    : 'Change the period above to send a different one.';
}
