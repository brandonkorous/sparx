// "Not charged to any job" — saying which part of it should have been.
//
// The pane already tells her how much spend is not pinned to a job, and then
// warns her, in the conditional, that "if a job's parts are sitting in here,
// that job will look more profitable than it was."
//
// On a real shop they were. $2,158.70 was uncharged, $308.70 of it parts and
// materials, and the screen had both numbers in its hand while telling her to
// go and check. A conditional the screen can settle is a job it handed back to
// the reader.
//
// Rent and insurance genuinely do belong to the business rather than to one
// repair, so the general paragraph stays. This adds the part that is specific.

/** The three cost lines and the uncharged total, all in cents. */
export interface SpendShape {
  /** Parts, materials, subcontractors: costs that happened because of the work. */
  costOfSaleCents: number;
  laborCents: number;
  /** Rent, insurance, software: the cost of being open. */
  operatingCents: number;
  /** Spend not pinned to any job. */
  unallocatedCents: number;
}

/**
 * How much of the uncharged pile is job cost rather than overhead.
 *
 * A FLOOR, not a guess. The rollup records how much spend was pinned to jobs
 * but not which lines it came from, so when some has been pinned the most that
 * can be proved is `direct − pinned`: even if every pinned cent came out of the
 * direct pile, that much is still loose. Where nothing has been pinned at all,
 * the floor and the true figure are the same number.
 */
export function looseJobCostCents(f: SpendShape): number {
  const spend = f.costOfSaleCents + f.laborCents + f.operatingCents;
  const charged = Math.max(0, spend - f.unallocatedCents);
  return Math.max(0, f.costOfSaleCents - charged);
}

/** Whether the figure above is exact rather than a floor. */
export function looseJobCostIsExact(f: SpendShape): boolean {
  const spend = f.costOfSaleCents + f.laborCents + f.operatingCents;
  return f.unallocatedCents >= spend;
}

/**
 * The sentence, or null when there is nothing specific to add.
 *
 * Null when no job cost can be shown to be loose: a shop whose uncharged pile is
 * all rent would otherwise be told "$0.00 of that is parts", which is a line she
 * has to read to learn nothing.
 */
export function unchargedJobCostLine(
  f: SpendShape,
  money: (cents: number) => string
): string | null {
  const loose = looseJobCostCents(f);
  if (loose <= 0) return null;
  const amount = money(loose);
  return looseJobCostIsExact(f)
    ? `${amount} of that is parts, materials or subcontractors, which usually does belong to a job.`
    : `At least ${amount} of that is parts, materials or subcontractors, which usually does belong to a job.`;
}
