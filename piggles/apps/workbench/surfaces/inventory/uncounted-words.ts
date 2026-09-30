// THE BAND'S SENTENCES, ALL OF THEM, IN ONE PLACE.
//
// The band over the stock list says four things, and every one of them changes
// with how many versions it is about: what has happened, where they are, what it
// costs, and what the button does.
//
// Two of the four had a singular and a plural form and two did not, so a shop
// with exactly ONE uncounted version read this:
//
//     1 version you sell has never been counted
//     This list only holds what you have counted, so THEY are not below.
//     Until somebody counts IT, your website sells it without limit.
//     [ Count THEM ]
//
// Three different numbers in one paragraph, about one shirt (issue 856). The two
// that were wrong were the two nobody had thought of as sentences: a clause in
// the middle of another sentence, and a button label.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// So they live here together rather than as four ternaries spread through the
// markup. Adding a fifth sentence to the band means adding it to this shape,
// where the test below counts them.
//
// In a `.ts` beside the component rather than inside it because this app's
// tsconfig leaves JSX unparsed, so a test cannot import the `.tsx` — the same
// arrangement `publish-words.ts` and `signed-in-line.ts` already use.

export interface UncountedWords {
  /** What has happened, as the band's heading. */
  title: string;
  /** Why they are not in the list under it. */
  whereTheyAre: string;
  /** What it costs her while it stays that way. */
  consequence: string;
  /** The button, when there is one product to send her to. */
  action: string;
}

/**
 * Every sentence in the band, for this many uncounted versions.
 *
 * `searching` changes only the second one: with a search box in use, "they are
 * not below" is confusing on its own, because she has just typed something that
 * plainly matches them.
 */
export function uncountedWords(total: number, searching: boolean): UncountedWords {
  const one = total === 1;

  return {
    title: one
      ? '1 version you sell has never been counted'
      : `${String(total)} versions you sell have never been counted`,

    whereTheyAre: searching
      ? one
        ? 'Your search matched it, but this list only holds what you have counted, so it is not below.'
        : 'Your search matched them, but this list only holds what you have counted, so they are not below.'
      : one
        ? 'This list only holds what you have counted, so it is not below.'
        : 'This list only holds what you have counted, so they are not below.',

    consequence: one
      ? 'Until somebody counts it, your website sells it without limit.'
      : 'Until somebody counts them, your website sells them without limit.',

    action: one ? 'Count it' : 'Count them',
  };
}
