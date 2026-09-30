// What the till OFFERS to take, before anybody types a number.
//
// The box is prefilled because at a counter the whole thing is paid nearly
// every time, and that default is right for the case the screen was built for:
// somebody standing there with a card.
//
// It is wrong for the other case. A shop that phones an order through has
// handed over nothing, and the till offered to mark it paid in full anyway —
// so an order placed on account came out settled, never reached what she is
// owed, and no invoice was ever raised for it. The same shape as issue 737: a
// number pre-filled for the counter, on the screen a wholesale order also has
// to go through. [[feedback_never_present_absence_as_measurement]]
//
// A DEPOSIT IS WHAT IS DUE, NOT WHAT WAS TAKEN. That distinction is invisible
// at a counter, where the two are the same moment, and it is the whole story on
// the phone. The first version of this file let a deposit outrank buying on
// account, reasoning that the deposit is a rule on the PRODUCT and therefore
// holds whoever is buying — true, and beside the point. Driving it proved it:
//
//     O-000018   Tamsin Vale, Loom and Larder
//                total $52.00, payment_status partially_paid
//                order_payments: one captured row, $30.00, manual
//
// A $30 payment nobody made, against a shop that had not been asked for
// anything. The deposit is still real and still owed — it is the first thing on
// the invoice — but the till records what was HANDED OVER.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// Nothing here overrides a number she has typed; that is `amountTouched` in the
// pane, which is the older half of the same idea.

/** Money as the box holds it: two decimals, or empty for nothing offered. */
function asBoxed(amount: number): string {
  return amount > 0 ? amount.toFixed(2) : '';
}

export interface WhatToOffer {
  /** The deposit this basket demands, or null when nothing on it needs making. */
  depositAsked: number | null;
  /** What the sale comes to. */
  total: number;
  /** Whether the person buying is filed under a business they buy for — the
   *  same fact the customer picker marks, and the one that decides whether a
   *  sale is a counter sale or an order going out on account. */
  buysOnAccount: boolean;
}

export function whatToOffer({ depositAsked, total, buysOnAccount }: WhatToOffer): string {
  // Ordering on account outranks everything: nothing was handed over, so there
  // is nothing to write down, whatever the sale is made of.
  if (buysOnAccount) return '';
  if (depositAsked !== null) return asBoxed(depositAsked);
  return asBoxed(total);
}

/** What the money section says it is for, which is a different sentence when
 *  nothing is expected today. */
export function takingNote(buysOnAccount: boolean): string {
  return buysOnAccount
    ? 'Nothing is expected today: a shop ordering on account pays you later, and the whole order shows up under what you are owed. Fill this in only if they paid on the call.'
    : 'How much you were handed, and how. Clear it if they have not paid yet: the sale is still written down, and it shows up under what you are owed.';
}
