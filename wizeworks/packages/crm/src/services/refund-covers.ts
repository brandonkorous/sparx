// Does this refund give back everything still left on the order?
//
// Counted in CENTS. It was `amount >= total - refundTotal` in dollars, and
// dollars are not exact in floating point: Marisol's $640.96 order came back as
// $490.96 for the part and $150.00 for its core deposit, and 640.96 - 490.96 is
// 150.00000000000006. The last $150.00 was not "at least" that, so an order
// refunded to the cent kept saying "On its way" on her page (sparx persona
// issue 341). Brynn's $750.00 came back as $600.00 + $150.00, which happens to
// be exact, so the counter return looked right.

type Money = number | string | { toString(): string };

function cents(value: Money): number {
  return Math.round(Number(value.toString()) * 100);
}

/** True when `amount` covers what is left of `total` after `refundedSoFar`. */
export function refundCoversWhatIsLeft(amount: Money, total: Money, refundedSoFar: Money): boolean {
  return cents(amount) >= cents(total) - cents(refundedSoFar);
}
