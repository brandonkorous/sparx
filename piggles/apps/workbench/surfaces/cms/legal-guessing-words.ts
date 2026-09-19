// "1 OF THEM" — WHICH THEM?
//
// The legal screen's banner opens with the REQUIRED pages:
//
//     Your required pages are all set
//     Every page you are expected to have is published, up to date, and linked
//     in your footer. 1 of them still says things we guessed about your
//     business. They are marked below.
//
// "them" is those required pages. The count was over EVERY page, required and
// optional together — and the two are filtered apart on the line above, then not
// used ([[feedback_a_fix_leaves_its_neighbour_behind]]).
//
// On the account this was found on, all four required pages were the owner's own
// words and the Refund Policy — which is OPTIONAL — was not. So the banner said
// one of her required pages was marked, and none of them was. She reads four
// rows looking for a mark that is two sections further down the screen.
//
// Every business on this platform has both optional pages (measured 2026-09-17:
// 90 of 90 tenants carry a Shipping Policy and a Refund Policy), and 87 of each
// 90 have never had their words changed.

/** How many published pages still carry a sentence the starter guessed. */
export interface GuessCounts {
  /** Among the pages a business like this one is expected to publish. */
  required: number;
  /** Among the ones it may publish if they fit. */
  optional: number;
}

const say = (n: number) => (n === 1 ? 'still says' : 'still say');

/**
 * The sentence that follows "Every page you are expected to have is published…".
 *
 * Null when there is nothing to say, so the banner stays a clean green rather
 * than carrying an empty clause.
 *
 * REQUIRED AND OPTIONAL ARE NAMED SEPARATELY, never added together. A count that
 * spans both cannot be attached to either noun without being wrong about one of
 * them, and the whole value of this sentence is that it sends her to a row.
 *
 * "It is marked below" for one and "They are marked below" for several: the
 * singular used to read "They are marked below" over a single row, which is a
 * small thing that makes a screen feel like it is not reading itself.
 */
export function guessingLine(counts: GuessCounts): string | null {
  const total = counts.required + counts.optional;
  if (total === 0) return null;

  const marked = total === 1 ? 'It is marked below.' : 'They are marked below.';

  if (counts.required > 0 && counts.optional > 0) {
    return (
      `${String(counts.required)} of them and ${String(counts.optional)} of your optional pages ` +
      `still say things we guessed about your business. ${marked}`
    );
  }
  if (counts.required > 0) {
    return (
      `${String(counts.required)} of them ${say(counts.required)} ` +
      `things we guessed about your business. ${marked}`
    );
  }
  return (
    `${String(counts.optional)} of your optional pages ${say(counts.optional)} ` +
    `things we guessed about your business. ${marked}`
  );
}
