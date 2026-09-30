// What the order summary's Shipping row says, and what its total comes to.
//
// Pulled out of the component because it is the one piece of arithmetic on
// checkout that a shopper reads on four screens in a row, and it was wrong on
// one of them: with a delivery CHOSEN and priced on the screen beside it, the
// summary went on saying "Once we know where" and printing a total $9 short,
// then jumped to the real number on the payment step. Pressing Back dropped it
// again. The rules live here so they can be proved.

/** Three different sentences, and only one of them is a price. */
export type ShippingLine =
  { kind: 'unknown' } | { kind: 'free' } | { kind: 'amount'; cents: number };

export interface ShippingInput {
  /**
   * Whether the delivery step has been SUBMITTED, which is the moment the
   * checkout session's own totals become the authority. Before it, the
   * session's zero shipping means "not worked out", never "free" (issue 206).
   */
  settled: boolean;
  /** The session's shipping total. Only meaningful once settled. */
  settledShippingCents: number;
  /** The rate the shopper has picked but not yet submitted. Null = none yet. */
  chosenShippingCents: number | null;
}

export function shippingLine(input: ShippingInput): ShippingLine {
  const cents = input.settled ? input.settledShippingCents : input.chosenShippingCents;
  if (cents === null) return { kind: 'unknown' };
  return cents > 0 ? { kind: 'amount', cents } : { kind: 'free' };
}

/**
 * The number under "Total". A delivery that has been chosen but not submitted
 * is not in the session's total yet, so it is added here — the shopper is
 * looking at its price three inches away.
 */
export function summaryTotalCents(input: {
  settled: boolean;
  totalCents: number;
  chosenShippingCents: number | null;
}): number {
  if (input.settled) return input.totalCents;
  return input.totalCents + (input.chosenShippingCents ?? 0);
}
