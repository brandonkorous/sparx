// What a commission recalculation means, in the owner's words (issue 871).
//
// Every outcome here is an ordinary state rather than an error, and they are
// fixed in different places, so a single "no commission" would leave somebody
// guessing which. `not-payable` is the one people ask about most: an order earns
// nothing until it is PAID, because a commission on an unpaid order is a promise.
//
// The pair to be careful with is `no-rate` and `rate-not-in-force`. The
// calculation keeps them apart on purpose, and its own comment says why:
//
//   > They look identical from inside the calculation — no rate came back — and
//   > they are fixed in opposite ways, so collapsing them produces advice that is
//   > worse than silence. Found by clicking it: a salesperson was put on 7.5%
//   > commission today, an order paid a fortnight ago was credited to her, and the
//   > screen said "they are not on commission — set a commission rate on their pay
//   > record." She was on commission. The rate simply started after the sale, and
//   > the owner was being sent to do the exact thing they had just done.
//
// This console did not know the sixth outcome existed, so it fell through the
// switch to the default and said **"That sale could not be found"** about a sale
// sitting on the screen with a named person credited to it.
//
// Lifted out of `sold-by-section.tsx` so the sentences can be tested: a `.tsx`
// cannot be imported by vitest in this app (`jsx: preserve`). The formatters
// arrive as arguments rather than as imports, which keeps this module free of
// the money and date helpers and lets a test read the shape of a sentence
// without asserting anybody's locale.

import type { CommissionOutcome } from '../staff/data';

export interface OutcomeWords {
  cents: (cents: number) => string;
  day: (iso: string | null | undefined) => string;
}

export function outcomeMessage(
  result: CommissionOutcome,
  who: string,
  words: OutcomeWords
): string {
  switch (result.outcome) {
    case 'recorded':
      return result.amountCents
        ? `${who} earned ${words.cents(result.amountCents)} on this order.`
        : `Credited to ${who}. This order earned nothing: the amount it was based on came to zero.`;
    case 'no-rate':
      return `Credited to ${who}, but they are not on commission, so nothing was earned. Set a commission rate on their pay record to change that.`;
    case 'rate-not-in-force':
      // NOT "they are not on commission" — they are, and saying otherwise sends
      // the owner to set a rate they have already set. The dates are the whole
      // message: a rate only pays sales made after it starts.
      //
      // The remedy is spelled out because the obvious one does not work: pay
      // rates may not overlap, so adding an EARLIER rate is refused outright.
      // Removing the rate and adding it again from an earlier date is the actual
      // path, and an owner told merely to "backdate it" hits that wall instead.
      return `Credited to ${who}. Their commission starts ${words.day(result.rateStartsOn)} and this order was paid ${words.day(result.earnedOn)}, so it earned nothing. To count it, remove that rate on their pay record and add it again from an earlier date.`;
    case 'not-payable':
      return `Credited to ${who}. Commission is worked out once the order is paid.`;
    case 'no-attribution':
      return 'Nobody is credited with this sale yet.';
    default:
      return 'That sale could not be found.';
  }
}
