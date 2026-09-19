// THE ONE SENTENCE UNDER THE FOUR MEASURES.
//
// Ashcombe Mills' card said all of this at once:
//
//     A · 99
//     Based on all four measures, across 2 deliveries and 1 order worth $720.00.
//     On time  100%   0 of 2 late
//     In full  100%   0 short of 1 line
//     …
//     No delivery from them has been measured yet, so planning still uses
//     whatever delivery time was typed in on their record.
//
// Two deliveries, none of them late, and then no delivery has been measured.
// A reader cannot tell from that whether the A is real.
//
// Both halves are true about DIFFERENT THINGS, and the sentence used one word
// for both. The four measures come from the scorecard's own pass over receipts.
// The delivery TIME comes from `inventory_supplier_lead_times`, a separate
// table filled by a separate job, which `supplier-scorecard.ts` only copies and
// says so:
//
//     It does not measure lead time. `inventory_supplier_lead_times` (Phase
//     7.3) owns that, and the sweep COPIES it.
//
// Measured: Juniper Row has 2 deliveries, 0 rows in that table, and both of her
// purchase orders carry an `ordered_at` AND a receipt. So the number is sitting
// there computable and nobody has run the pass.
//
// ── One outcome, two causes ─────────────────────────────────────────────────
//
// The old sentence covered both and offered a way out of neither:
//
//   * deliveries have arrived and nobody ran the pass — a button fixes it
//   * nothing has arrived from them — no button can
//
// They are told apart here, and only the first offers the button
// ([[feedback_one_outcome_two_causes]]).
//
// The button is NOT the card's own "Measure now": that recomputes scorecards,
// which copy the lead time rather than work it out. The pass that fills it is
// the planning sweep, `POST /v1/inventory/planning/recompute`.
//
// ── And what planning actually falls back to ────────────────────────────────
//
// "planning still uses whatever delivery time was typed in on their record" is
// only true when something WAS typed in. `resolveLeadTimeOnTx` goes: a measured
// figure with enough samples, else the supplier's stated days, else the stock
// level's own, else a flat default. With nothing on the record the sentence
// promised something that does not happen ([[feedback_a_promise_in_copy_is_a_contract]]),
// so the no-stated-time case says a general figure instead of naming one, which
// stays true whichever of the last two steps wins.

/**
 * Below this many deliveries the measured figure is reported but NEVER used:
 * `resolveLeadTimeOnTx` joins `inventory_supplier_lead_times` with
 * `sample_count >= MIN_RELIABLE_SAMPLES` and falls through to the stated days
 * when that misses.
 *
 * Duplicated from `wizeworks/packages/inventory/src/services/lead-times.ts`
 * because the API exposes no reliability flag. If that number moves, this one
 * has to move with it, and the test below is where it is written down.
 */
export const MIN_RELIABLE_SAMPLES = 3;

export interface LeadTimeFacts {
  /** Measured average, or null when no pass has ever produced one. */
  meanDays: number | null;
  /** How many deliveries that average stands on. */
  sample: number;
  /** What they stated, as the measuring pass recorded it. */
  promisedDays: number | null;
  /** Measured minus promised. Positive means slower than they said. */
  varianceDays: number | null;
  /** Deliveries the scorecard counted in the same window. */
  deliveries: number;
  /** The delivery time typed on their record, which planning falls back to. */
  statedDays: number | null;
}

export interface LeadTimeLine {
  /** The sentence that goes under the four measures. */
  text: string;
  /** Words on the button that would fill the gap, or null when none would. */
  measure: string | null;
}

const count = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/**
 * What planning uses when the measured figure is missing or too thin.
 *
 * Never names a number it cannot stand behind: with nothing on the record,
 * which of the two remaining steps wins is not knowable from this card.
 */
function fallback(statedDays: number | null): string {
  return statedDays !== null && statedDays > 0
    ? `the ${count(statedDays, 'day', 'days')} typed in on their record`
    : 'a general figure, because no delivery time is typed in on their record either';
}

export function leadTimeLine(facts: LeadTimeFacts): LeadTimeLine {
  if (facts.meanDays === null) {
    // Nothing has ever arrived, so there is nothing to time. No button helps.
    if (facts.deliveries <= 0) {
      return {
        text:
          'Nothing has arrived from them yet, so how long they take cannot be worked out. ' +
          `Until something does, planning uses ${fallback(facts.statedDays)}.`,
        measure: null,
      };
    }

    // Deliveries HAVE arrived. This is the case that read as a contradiction,
    // so it names the deliveries out loud rather than denying them.
    return {
      text:
        'How long they actually take has never been worked out, though ' +
        `${count(facts.deliveries, 'delivery', 'deliveries')} from them ` +
        `${facts.deliveries === 1 ? 'has' : 'have'} arrived. Until it is, planning uses ` +
        `${fallback(facts.statedDays)}.`,
      measure: 'Work out delivery times',
    };
  }

  const measured =
    `Deliveries take ${String(facts.meanDays)} days on average, measured across ` +
    `${count(facts.sample, 'delivery', 'deliveries')}`;

  const against =
    facts.promisedDays !== null
      ? `, they say ${String(facts.promisedDays)}, so they run ${
          (facts.varianceDays ?? 0) >= 0 ? 'slower' : 'faster'
        } than stated by ${String(Math.abs(facts.varianceDays ?? 0))} days.`
      : ', and they have never stated a delivery time to compare it against.';

  // The module next door states the rule this branch was missing: "A forecast
  // built on nine days of sales and one delivery is arithmetically the same
  // shape as one built on three years and forty deliveries." The figure read
  // the same at one sample as at forty, and below the threshold planning is not
  // using it at all.
  const trust =
    facts.sample < MIN_RELIABLE_SAMPLES
      ? ` That is too few deliveries to plan on, so planning still uses ${fallback(
          facts.statedDays
        )}.`
      : '';

  return { text: `${measured}${against}${trust}`, measure: null };
}
