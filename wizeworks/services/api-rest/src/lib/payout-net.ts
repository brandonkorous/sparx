// What a card payment still sends to the bank, once its refunds come off.
//
// The payouts page added up every captured card payment at its full amount. A
// refund is a row in another table that never touches the payment, so Gillett's
// two card sales of $640.96, both refunded to the cent, showed as a $1,281.92
// deposit "On its way" while the bank was owed nothing (sparx persona issue 343).
//
// The deposit here is an estimate made from the sales, so a refund comes off the
// sale it gives back, whenever it was made. A refund made after the deposit
// landed makes that deposit read smaller than it was; the processor takes it off
// a later one. Counted in cents (see issue 341).

type Money = number | string | { toString(): string };

function cents(value: Money): number {
  return Math.round(Number(value.toString()) * 100);
}

/** The amount still going to the bank, in dollars; 0 when it was all given back. */
export function leftToSettle(amount: Money, refunds: readonly Money[]): number {
  const left = cents(amount) - refunds.reduce<number>((sum, refund) => sum + cents(refund), 0);
  return Math.max(0, left) / 100;
}
