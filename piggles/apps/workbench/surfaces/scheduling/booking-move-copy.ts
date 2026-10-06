// WHAT MOVING A BOOKING DOES, said once.
//
// The pane and the diary's quick look each carried their own sentence, and they
// disagreed: one promised only a clash check, the other promised that a time
// outside opening hours would be refused too. The second was the true statement
// of intent and the false statement of fact — the engine checked neither the
// hours nor the closures until issues 149 and 150 — so the pane under-promised
// and the modal lied. One author for the sentence, and it now describes what the
// engine actually does.

//
// It also used to say "shown in your own time zone", which was true of the box
// and was the defect (sparx persona issue 086): the box was on this computer's
// clock while the booking, its header and the customer's emails were on the
// business's. The box now reads the booking's own clock, and the sentence names
// it, so it takes the clock line from the caller rather than guessing.

/** The "Move it" explainer, with the line that says whose clock the box is on. */
export function moveExplainer(clockHint: string): string {
  return (
    `Change when this happens. ${clockHint} A time that clashes, falls outside working ` +
    'hours, or lands in a closure is refused and nothing changes. The customer is told ' +
    'about a move that takes.'
  );
}
