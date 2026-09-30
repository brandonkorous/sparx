// "YOU HAVE NONE OF THOSE" IS A CLAIM ABOUT HER BUSINESS. IT NEEDS EVIDENCE.
//
// A dropdown whose options come from a fetch has three states, and three panes
// wrote two of them:
//
//     const options = query.data?.items ?? [];
//     …
//     : options.length === 0 && !query.isPending ? (
//         <FieldDescription>You have no customer groups yet.</FieldDescription>
//
// `?? []` turns a FAILED fetch into an empty list, and the sentence under it
// then tells the owner a fact about her own business. Juniper Row has NINE
// customer groups. On a bad response the Special prices pane would have told her
// she has none and sent her to Customers to make a tenth
// ([[feedback_never_present_absence_as_measurement]]).
//
// The same two sentences sit over wholesale customers on the wholesale invoice pane,
// where the advice is "Add one under Accounts first".
//
// This is the words half. The other half is structural: a pane that WAITS for a
// query must also handle that query failing, which `scripts/check-pane-load.mjs`
// now enforces.

/** A fetched list of choices, as the pane holds it. */
export interface ChoiceListState {
  isPending: boolean;
  isError: boolean;
  /** How many options came back. Meaningless unless the fetch succeeded. */
  count: number;
}

export interface ChoiceListWords {
  /** What to say when there genuinely are none — the caller's own sentence,
   *  because only the caller knows where the owner would go to make one. */
  none: string;
  /** What the list holds, said as she would say it: "customer groups". */
  noun: string;
}

/**
 * The note under a chooser, or null when the chooser speaks for itself.
 *
 * Null while loading on purpose: the control already shows its own placeholder,
 * and a note that appears and vanishes on every open is noise.
 */
export function choiceListNote(state: ChoiceListState, words: ChoiceListWords): string | null {
  if (state.isPending) return null;

  // Said before the count, because an unread list has no count.
  if (state.isError) {
    return (
      `Your ${words.noun} could not be loaded just now. That is a problem reaching ` +
      'the server, not something missing from your business. Close this and open it again.'
    );
  }

  return state.count === 0 ? words.none : null;
}
