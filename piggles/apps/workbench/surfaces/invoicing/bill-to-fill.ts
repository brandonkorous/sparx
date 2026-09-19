// What the printed name and email become when the customer changes.
//
// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------
//
// Picking a customer used to seed the printed fields like this:
//
//     name:  value.name  || customerLabel(customer),
//     email: value.email || (customer.email ?? ''),
//
// commented "fill what's empty, keep what was typed". It cannot tell what was
// TYPED from what it AUTOFILLED a moment ago, because it only asks whether the
// box is empty. So changing the customer on a document left the previous
// person's name and email sitting on it, in silence.
//
// A real invoice on this platform ended up there: $276, printed name "Wren
// Ashcombe", attached customer Marguerite Adeyemi, and emailed to Marguerite.
// The list column shows the printed name, so it reads as Wren Ashcombe's bill.
// Wren does not know she has been billed, Marguerite has a bill with somebody
// else's name on it, and the shop chases the wrong person for the money.
//
// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------
//
// A printed field FOLLOWS the customer while it still agrees with the customer
// it belongs to, and STAYS once it has been deliberately made different.
//
// That is the question the old code was trying to ask. Emptiness was a bad
// proxy for it; "does this still say what the attached customer says" is the
// real one, and it survives the document being closed and reopened — which the
// remembered-autofill version would not, because nothing remembers across a
// reload.
//
// An invoice addressed to an accounts-payable department, or to a person's
// business rather than the person, is exactly the case that must keep its text.
// It does: that text does not match the attached customer, so it is left alone.

export interface BilledParty {
  name: string;
  email: string;
}

/**
 * The printed fields after picking `picked` on a document currently attached to
 * `attachedTo`.
 *
 * `attachedTo` is who the document is on RIGHT NOW, before this pick — null on
 * a document with no customer yet. Each field is replaced when it is empty, or
 * when it still matches what that customer would have put there; otherwise it
 * is kept.
 *
 * Total on purpose: every argument is a plain value and there is no branch that
 * throws, so it can be called straight from an event handler.
 */
export function fillFromCustomer(
  current: BilledParty,
  attachedTo: BilledParty | null,
  picked: BilledParty
): BilledParty {
  return {
    name: follows(current.name, attachedTo?.name) ? picked.name : current.name,
    email: follows(current.email, attachedTo?.email) ? picked.email : current.email,
  };
}

/**
 * The printed fields after REMOVING the customer a document was on.
 *
 * The other half of the same rule, and the half a `fillFromCustomer` alone
 * leaves open: the picker has no "swap" — changing who a document is for means
 * clearing and then choosing. If clearing keeps the old person's details, the
 * next pick sees full boxes with nothing attached to compare them against, and
 * they survive exactly as they did before any of this.
 *
 * So whatever still says what the departing customer said goes with them, and
 * anything deliberately made different stays. It is the same question with
 * nothing to fill in.
 */
export function clearedFromCustomer(
  current: BilledParty,
  attachedTo: BilledParty | null
): BilledParty {
  return fillFromCustomer(current, attachedTo, { name: '', email: '' });
}

/** Whether this box is still the previous customer's, rather than hers. */
function follows(current: string, attached: string | undefined): boolean {
  if (current.trim() === '') return true;
  if (attached === undefined) return false;
  return current.trim().toLowerCase() === attached.trim().toLowerCase();
}

/**
 * Why the email on a document does not belong to the customer named on it.
 *
 * Every document that reached the broken state above still has it, and no fix
 * to the picker repairs one — so the screen has to be able to say so. `null`
 * when there is nothing to say, which is the ordinary case.
 *
 * Only the email, and only when a customer is attached. The printed NAME is
 * allowed to differ (that is the accounts-payable case), but the address is
 * where the bill physically goes, and a bill going somewhere other than to the
 * customer it is filed under is always worth a sentence.
 */
export function misdirectedEmail(
  currentEmail: string,
  attachedTo: BilledParty | null
): string | null {
  if (attachedTo === null) return null;
  const typed = currentEmail.trim().toLowerCase();
  const theirs = attachedTo.email.trim().toLowerCase();
  if (typed === '' || theirs === '' || typed === theirs) return null;
  return `This is not ${attachedTo.name}'s address. Sending goes here, and their own address is ${attachedTo.email}.`;
}
