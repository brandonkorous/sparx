// SAYING WHERE A LINE SITS, WHEN THE NUMBERS CANNOT.
//
// WHY THIS WAS MISSING AND WHY THAT MATTERED
//
// "What matters" ranks stock two ways. WORTH is a year of usage multiplied by
// what a unit cost, and DEMAND is whether that usage is steady enough to
// forecast. Both are measured, both are stored with an OVERRIDE column beside
// them, and the pane already prints the override when there is one:
//
//     you set this · measured long tail
//
// Nobody has ever seen that sentence. `PUT /v1/inventory/classifications` has
// always existed, `setClassification` in the service writes `abcOverride`,
// `xyzOverride`, `overrideReason`, `overrideBy` and `overrideAt`, and the
// console's own `useSetClassification` forwards all of it. It had ZERO callers
// in either console. MEASURED 2026-09-29: of 94 classified lines on the
// platform, 0 carry an override and 0 carry a reason (issue 877).
//
// ── Why an owner needs to answer a ranking at all ─────────────────────────
//
// Worth is `units used x what a unit cost`, so a line with no cost recorded
// enters that product as a zero, scores nothing, ties with every other unpriced
// line and lands in the long tail. On Juniper Row that is 69 of 76 lines. The
// pane says so honestly and sends her to record the costs, which is the right
// first answer. It is not the only one: some lines never have a purchase cost,
// because the business MAKES them, and a maker's signature piece is not long
// tail merely because nobody bought it in.
//
// The pane's own code already treats an override as that answer:
//
//     const rankable = (row) => row.costKnown || row.abcOverride !== null;
//
// So the escape hatch was designed, relied on, rendered, and unreachable.
// [[feedback_screen_over_a_function_nobody_calls]]
//
// ── This is not the reorder level ─────────────────────────────────────────
//
// "Why this number" exists to STOP people overriding arithmetic they cannot
// see. Nothing here contradicts that. A reorder level is arithmetic over
// measured inputs, and typing over it throws the measurement away. A worth
// ranking is arithmetic over inputs the platform cannot see at all: what a
// hand-made line cost to make, which line the shop is known for, which one is
// about to be in a window. Supplying a missing fact is not overruling a sum.
//
// Byte-identical in both consoles.

/** The three worth bands, plus the empty string for "leave it to the numbers". */
export type AbcChoice = '' | 'A' | 'B' | 'C';
/** The three demand bands, plus the empty string for "leave it to the numbers". */
export type XyzChoice = '' | 'X' | 'Y' | 'Z';

export interface ClassifyForm {
  readonly abc: AbcChoice;
  readonly xyz: XyzChoice;
  readonly reason: string;
}

export interface ClassifyWrite {
  readonly abcClass: 'A' | 'B' | 'C' | null;
  readonly xyzClass: 'X' | 'Y' | 'Z' | null;
  readonly reason?: string;
}

/**
 * What to send for a filled-in form.
 *
 * Null on an axis means "leave it to the numbers", which is how an override is
 * taken off as well as how it is never put on: the server reads a null pair as
 * no override at all and clears the reason with it.
 *
 * The reason rides along ONLY when at least one axis is being set by hand. A
 * reason attached to nothing is a sentence explaining a decision that was not
 * taken, and it would sit on the record making it look as though one had been.
 */
export function classifyWrite(form: ClassifyForm): ClassifyWrite {
  const abcClass = form.abc === '' ? null : form.abc;
  const xyzClass = form.xyz === '' ? null : form.xyz;
  const reason = form.reason.trim();
  const setting = abcClass !== null || xyzClass !== null;
  return {
    abcClass,
    xyzClass,
    ...(setting && reason ? { reason } : {}),
  };
}

/** Whether pressing Save would actually change anything, given what is stored.
 *  A dialog opened and closed again is not an edit, and saving one would stamp
 *  a fresh `overrideAt` on a record nobody touched. */
export function classifyMoved(form: ClassifyForm, stored: StoredClassification): boolean {
  const next = classifyWrite(form);
  if (next.abcClass !== stored.abcOverride) return true;
  if (next.xyzClass !== stored.xyzOverride) return true;
  return (next.reason ?? '') !== (stored.overrideReason ?? '');
}

export interface StoredClassification {
  readonly abcOverride: 'A' | 'B' | 'C' | null;
  readonly xyzOverride: 'X' | 'Y' | 'Z' | null;
  readonly overrideReason: string | null;
}

/** Whether there is anything to put back. Drives the "Use the numbers again"
 *  button, which is hidden rather than disabled when nothing was ever set: a
 *  disabled control invites somebody to work out what would enable it. */
export function hasAnswer(stored: StoredClassification): boolean {
  return stored.abcOverride !== null || stored.xyzOverride !== null;
}

/** The one option in each picker that means "do not answer this". Written once
 *  so the two pickers cannot come to disagree about what leaving it alone is
 *  called. */
export const LEAVE_IT = 'Work it out from my numbers';

export const REASON_DESCRIPTION =
  'Only your team sees this, and it is kept with the date so anyone looking ' +
  'later can see why this line was answered by hand.';
