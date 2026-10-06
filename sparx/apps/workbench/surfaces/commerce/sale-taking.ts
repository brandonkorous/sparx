// What the till OFFERS to take, before anybody types a number.
//
// The box is prefilled because at a counter the whole thing is paid nearly every
// time, and that default is right for the case the screen was built for:
// somebody standing there with a card. "The whole thing" includes any refundable
// core deposit on a rebuilt part, which is paid now and paid back later.
//
// It is wrong for the other case. A shop that phones an order through has handed
// over nothing, and a till that offered to mark it paid in full anyway would file
// an order placed on account as settled: it never reaches what the business is
// owed, and no invoice is raised for it. Piggles found this as its issue 748, on
// the same screen, and this one starts from the fixed version.
// [[feedback_never_present_absence_as_measurement]]
//
// Nothing here overrides a number that has been typed; that is `amountTouched`
// in the pane.

/** Money as the box holds it: two decimals, or empty for nothing offered. */
function asBoxed(amount: number): string {
  return amount > 0 ? amount.toFixed(2) : '';
}

export interface WhatToOffer {
  /** What the sale comes to, core deposits included. */
  total: number;
  /** Whether the person buying is filed under a business they buy for: the
   *  same fact the customer picker marks, and the one that decides whether a
   *  sale is a counter sale or an order going out on account. */
  buysOnAccount: boolean;
}

export function whatToOffer({ total, buysOnAccount }: WhatToOffer): string {
  // Ordering on account outranks everything: nothing was handed over, so there
  // is nothing to write down, whatever the sale is made of.
  if (buysOnAccount) return '';
  return asBoxed(total);
}

/** What the money section says it is for, which is a different sentence when
 *  nothing is expected today. */
export function takingNote(buysOnAccount: boolean): string {
  return buysOnAccount
    ? 'Nothing is expected today: a business ordering on account pays you later, and the whole order shows up under what you are owed. Fill this in only if they paid on the call.'
    : 'How much you were handed, and how. Clear it if they have not paid yet: the sale is still written down, and it shows up under what you are owed.';
}
