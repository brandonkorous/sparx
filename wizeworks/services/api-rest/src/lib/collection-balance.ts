// What a customer still owes when they collect an order (sparx persona issue 220).
//
// The order emails print it as "Due on collection". It was total minus paid for
// every order, so a fleet buyer's shipped order on 30-day terms read "Due on
// collection $43.27" beside an invoice due next month. It is owed at a handover
// only when the customer collects the order and nobody bills it to an account
// (a made-to-order piece paid by deposit and balance, issue 026).

export function dueOnCollectionCents(order: {
  /** The customer collects it rather than having it sent. */
  pickup: boolean;
  /** The account terms it is billed on ("net30"), or null when paid by the buyer. */
  terms: string | null;
  totalCents: number;
  paidCents: number;
}): number {
  if (!order.pickup || (order.terms ?? '') !== '') return 0;
  return Math.max(0, order.totalCents - order.paidCents);
}
