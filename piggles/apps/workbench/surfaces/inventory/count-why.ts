// When a counted line gets asked WHY, and the words used to ask.
//
// WHY THIS WAS MISSING AND WHY THAT MATTERED
//
// A stock count is the one screen whose whole job is to disagree with the
// system. `inventory_count_lines` has carried a `note` column from the start;
// the service writes it, `getInventoryCount` reads it back on every line, and
// the console's own `useEnterCounts` forwards it. Nothing ever passed one. On
// the platform's 63 counted lines, 63 came out different from what was expected
// and 0 carried a word about it (issue 876).
//
// What that costs is not the count, it is the month after it. Applying a count
// rewrites the stock numbers and writes a movement for each correction, so the
// NUMBERS survive perfectly and the REASON is gone. "We think 0, counted 6,
// +6" on sixty-two lines is a record of what happened with the cause removed,
// and the cause is the only part a person can act on: four went to the Saturday
// market is a missing sale, two were damaged is a supplier problem, and a whole
// box found at the back is a receiving problem. Same number, three different
// jobs.
//
// ── Who gets asked ────────────────────────────────────────────────────────
//
// Not every line. A box under all 124 lines of a full count is a wall nobody
// reads, and it asks for an explanation from lines that have nothing to
// explain. The box appears where the question actually arises.

export interface WhyFacts {
  /** What the counter has put in for this line, or null if they have not yet. */
  readonly counted: number | null;
  /**
   * `counted − expected`, or null when there is nothing to compare against.
   *
   * Null covers two cases and both want the box. An item found on the shelf
   * that was not on the list has no expected number at all; and while a BLIND
   * count is open the server withholds the expected number from the counter, so
   * every line reads null until the count is submitted.
   */
  readonly difference: number | null;
  /** True when words are already recorded on this line, or are being typed. */
  readonly hasWords: boolean;
}

/**
 * Whether to put the box on this line.
 *
 * `hasWords` comes FIRST and on purpose: a box that is holding a sentence must
 * never be taken away by a later keystroke somewhere else. Correcting a count
 * from 8 back to 12 would otherwise delete the reason it was 8, silently, with
 * the reason already typed.
 */
export function askWhy(facts: WhyFacts): boolean {
  if (facts.hasWords) return true;
  // Nothing counted yet, so there is nothing to explain.
  if (facts.counted === null) return false;
  // A line that matched has nothing to explain. Everything else does, including
  // the two kinds of null above.
  //
  // There is deliberately NO separate branch for a blind count here. One was
  // written and then removed, because a blind count's difference is null on
  // every line by construction, so the branch could not be made to change an
  // answer: with it deleted, all ten tests stayed green. A rule that cannot go
  // red is not a rule, it is a comment that runs.
  // [[feedback_a_test_that_cannot_go_red]]
  //
  // `blind` still decides the WORDS below, which is a real difference: the
  // counter is not allowed to see the number, so they cannot be asked about it.
  return facts.difference !== 0;
}

/**
 * Said ONCE under the table heading, rather than as a label over every box.
 *
 * A full count is a hundred lines. A label per box is a hundred repetitions of
 * the same four words down the screen, so the box carries only its example and
 * the sentence explaining it is said here, once.
 *
 * Both promises in the second half are checked. `note` on a count line is read
 * by the two consoles and nothing else: no email, no invoice, no customer page.
 * And the lines are kept when a count is applied, so the words outlast the
 * correction, which is the entire point of collecting them.
 * [[feedback_a_promise_in_copy_is_a_contract]]
 */
export function whyIntro(blind: boolean): string {
  const kept =
    ' Only your team sees these, and they stay on the count after your stock is corrected.';
  return blind
    ? 'Note anything worth knowing as you go.' + kept
    : 'Where a number does not match, say why.' + kept;
}

/**
 * The box's own label, for a screen reader and nothing else.
 *
 * It names the ITEM, because "Why it is different" read out a hundred times in
 * a row identifies nothing. A blind count gets different words: the counter is
 * not allowed to see the expected number, so they cannot be asked about a
 * difference.
 */
export function whyFieldLabel(blind: boolean, what: string): string {
  return blind ? `A note about ${what}` : `Why ${what} is different`;
}

/** The grey example inside the empty box. Real sentences, because the useful
 *  note is the specific one and an abstract prompt gets an abstract answer. */
export function whyPlaceholder(blind: boolean): string {
  return blind
    ? 'Anything you noticed while counting this one.'
    : 'Four went to the Saturday market. Two were damaged.';
}
