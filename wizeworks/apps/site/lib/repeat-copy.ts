// What a repeat delivery means, said once (issue 739). The builder buy box, the
// React buy box and the basket all show it, and three copies of one promise is
// how they come to promise three things.
//
// Every clause is something the platform does: the first delivery is paid at
// checkout; each later one is charged the item price locked in that day, plus
// postage and tax worked out when it goes out (issue 916: they used to be
// left off), the same way the shopper paid; it needs a signed-in account; and
// the account is where it is paused, skipped or canceled.

export const REPEAT_NOTE =
  'On repeat, you pay for the first delivery at checkout. Each one after that is charged the same price for the item, plus postage and tax when it goes out, the same way you paid. You sign in to set it up, and you can pause, skip or cancel it from your account.';

/** Said beside the per-delivery amount a shopper sees in their account, which
 *  is the items alone: postage and tax are worked out on each delivery. */
export const REPEAT_AMOUNT_EXTRA = 'plus postage and tax';
