// Whether "every job made money" is a measurement or an artifact.
//
// BY JOB ranks work by margin. On a shop with no costs on its shelves every row
// comes out at 100.0%, the summary card reads "Every job in this period made
// money", and it is the most confident sentence on the screen sitting over the
// least evidence: nothing about what the goods cost has ever been recorded, so
// "made" and "kept" are the same number by construction.
//
// The screen one click away already says this properly, under its own
// cost-of-goods line: "Nothing here has been measured yet: 68 things on your
// shelves, 375 units in all, have never had a cost recorded." Same module, same
// condition, same `useUncostedStock` reader. This one never got it.
//
// A REAL zero exists too. A service business has no cost of goods and its
// margins genuinely are 100%, so the two are told apart by the STOCK and never
// by the sum — the same rule `cogs-note.ts` settled on.

export interface JobCostEvidence {
  /** Jobs in the period. */
  jobs: number;
  /** What the goods sold across all of them cost, in cents. */
  cogsCents: number;
  /** Things on the shelves that have never had a cost recorded. */
  uncostedItems: number;
  uncostedUnits: number;
}

/**
 * Whether the margins on this screen rest on anything.
 *
 * False only when NO cost of goods was recorded for the whole period AND there
 * is stock with no cost on it. Either alone is not enough: a period can honestly
 * cost nothing, and a shop can have one uncosted oddment while everything it
 * actually sold was costed properly.
 */
export function marginsAreMeasured(e: JobCostEvidence): boolean {
  return e.cogsCents > 0 || e.uncostedItems <= 0;
}

/** The summary card's heading. */
export function marginHeadline(e: JobCostEvidence): string {
  return marginsAreMeasured(e)
    ? 'Every job in this period made money'
    : 'What these jobs cost has not been measured';
}

/** The line under the number. */
export function marginSubline(e: JobCostEvidence): string {
  return marginsAreMeasured(e)
    ? 'Sort by Worst first to see which came closest to not.'
    : 'Every one of them shows as pure profit because nothing has been taken off.';
}

/**
 * The warning, or null when the margins are real.
 *
 * Says the same thing the profit screen says, in the words this screen needs:
 * there, an unmeasured zero makes one line wrong; here it makes every row and
 * the ranking wrong, because the whole point of the screen is to sort by a
 * number that is currently the same for everything.
 */
export function uncostedMarginNote(e: JobCostEvidence): string | null {
  if (marginsAreMeasured(e)) return null;
  const things = e.uncostedItems === 1 ? '1 thing' : `${String(e.uncostedItems)} things`;
  const units = e.uncostedUnits === 1 ? '1 unit' : `${String(e.uncostedUnits)} units`;
  return `None of these margins takes off what the goods cost. ${things} on your shelves, ${units} in all, have never had a cost recorded, so every job here comes out at 100% and the ranking cannot mean anything yet.`;
}
