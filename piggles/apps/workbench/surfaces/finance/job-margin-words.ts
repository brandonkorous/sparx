// Whether "every job made money" is a measurement or an artifact.
//
// BY JOB ranks work by margin. On a shop with no costs on its shelves every row
// comes out at 100.0%, the summary card reads "Every job in this period made
// money", and it is the most confident sentence on the screen sitting over the
// least evidence: nothing about what the goods cost has ever been recorded, so
// "made" and "kept" are the same number by construction.
//
// This used to GUESS from totals: "no cost of goods in the period, and stock
// with no cost on the shelves". That held while finance read no goods cost at
// all (persona issue 924: it looked for stock movements under a name nothing
// writes). Once one belt was sold with its cost recorded, the period's total was
// above zero, the guess said "measured", and the two dresses beside it went back
// to 100% with no warning. Each row now says for itself: `uncostedLines` counts
// the things it sold whose cost was never recorded, worked out on the server
// from the sale's own stock movements.
//
// A REAL zero exists too. A service business has no cost of goods and its
// margins genuinely are 100%: a line with no goods on it is never "uncosted".

export interface JobCostEvidence {
  /** Jobs in the period. */
  jobs: number;
  /** Jobs that sold something whose cost was never recorded. */
  unmeasuredJobs: number;
  /** Things on the shelves that have never had a cost recorded: the remedy. */
  uncostedItems: number;
  uncostedUnits: number;
}

/** Whether every margin on this screen rests on a recorded cost. */
export function marginsAreMeasured(e: JobCostEvidence): boolean {
  return e.unmeasuredJobs <= 0;
}

function noneMeasured(e: JobCostEvidence): boolean {
  return e.jobs > 0 && e.unmeasuredJobs >= e.jobs;
}

function jobsWord(n: number): string {
  return n === 1 ? '1 job' : `${String(n)} jobs`;
}

/** The summary card's heading. */
export function marginHeadline(e: JobCostEvidence): string {
  if (marginsAreMeasured(e)) return 'Every job in this period made money';
  if (noneMeasured(e)) return 'What these jobs cost has not been measured';
  return 'Every job with its costs recorded made money';
}

/** The line under the number. */
export function marginSubline(e: JobCostEvidence): string {
  if (marginsAreMeasured(e)) return 'Sort by Worst first to see which came closest to not.';
  if (noneMeasured(e)) {
    return 'Every one of them shows as pure profit because nothing has been taken off.';
  }
  const more = e.unmeasuredJobs === 1 ? '1 more job' : `${String(e.unmeasuredJobs)} more jobs`;
  return `${more} sold things with no cost recorded, so what they kept is not known. They are at the bottom of the list.`;
}

function shelves(e: JobCostEvidence): string {
  if (e.uncostedItems <= 0) return '';
  const things = e.uncostedItems === 1 ? '1 thing' : `${String(e.uncostedItems)} things`;
  const units = e.uncostedUnits === 1 ? '1 unit' : `${String(e.uncostedUnits)} units`;
  return ` ${things} on your shelves, ${units} in all, have never had a cost recorded.`;
}

/**
 * The warning, or null when every margin is real.
 *
 * Says the same thing the profit screen says, in the words this screen needs:
 * there, an unmeasured zero makes one line wrong; here it makes rows and the
 * ranking wrong, because the whole point of the screen is to sort by a number.
 */
export function uncostedMarginNote(e: JobCostEvidence): string | null {
  if (marginsAreMeasured(e)) return null;
  if (noneMeasured(e)) {
    return `None of these margins takes off what the goods cost.${shelves(e)} So every job here comes out at 100% and the ranking cannot mean anything yet.`;
  }
  return `${jobsWord(e.unmeasuredJobs)} sold things whose cost was never recorded, so their margins are left blank and they sit at the bottom of the list.${shelves(e)} Put in what each one cost and the next sale of it is measured.`;
}

/**
 * Appointments that happened and were never closed (persona issue 926).
 *
 * By job counts an appointment once it is marked Completed. Nothing closes a
 * past one by itself, so a salon that never presses Complete read "No completed
 * work in this period" over a month of appointments, with nothing saying why.
 */
export function openBookingsTitle(n: number): string {
  return n === 1
    ? '1 appointment has happened and is still open'
    : `${String(n)} appointments have happened and are still open`;
}

export function openBookingsBody(n: number): string {
  const them = n === 1 ? 'It is' : 'They are';
  return `By job counts an appointment once it is marked Completed. ${them} still Confirmed or In progress, so what ${n === 1 ? 'it' : 'they'} made is not here. Open each one and mark it Completed, or Did not turn up.`;
}
