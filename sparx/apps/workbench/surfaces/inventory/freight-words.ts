// What a purchase order says about freight, when freight can arrive twice.
//
// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------
//
// PO-000002, Fairfield Trims, 60 brass belt buckles at $3.60:
//
//     Freight     $0.00
//                 Spread across the items as they arrive, so what you hold is
//                 valued at what it really cost.
//
//     Items       $216.00
//     Total       $216.00
//
//     What they have billed
//     FT-INV-2291   $222.72   Entered
//
// The invoice is $6.72 more than the order and the screen offers no reason. The
// reason is $14.00 of freight, booked in when the goods were received. Every
// other figure on the platform has it — the stock is valued at $3.84 a unit
// against a $3.60 goods cost, and 58 × $3.84 is exactly $222.72 — and the one
// screen where she would check an invoice against an order does not.
//
// Freight reaches an order two ways:
//
//   • agreed when the order is raised  → `PurchaseOrder.freightCents`
//   • booked in with a delivery        → `GoodsReceiptCharge` where kind is
//                                        'freight'
//
// The Freight field read the first and nothing read the second, so a shop that
// pays carriage on arrival — which is most of them — saw $0.00 for ever.
//
// ---------------------------------------------------------------------------
// Why they stay two numbers
// ---------------------------------------------------------------------------
//
// They could be added together into one honest total, and that would be worse.
// One is what she AGREED to pay and the other is what TURNED UP, and the gap
// between them is the thing she is checking when an invoice arrives. A single
// figure hides exactly the fact the screen exists to show her.

/** Cents, formatted by the caller — this module owns the words, not the money
 *  format, so it imports nothing. */
export interface FreightNote {
  /** The figure to show beside the label, in cents. */
  cents: number;
  /** The sentence under it. Always says where the number came from. */
  detail: string;
}

/**
 * The Freight field's number and sentence.
 *
 * `agreedCents` is what was set on the order; `arrivedCents` is the total of
 * every `freight` charge booked in against its deliveries. The field leads with
 * whichever exists, and never prints a confident zero over a real charge.
 *
 * `money` formats cents in the order's currency. Passed in rather than imported
 * so this file stays a leaf that can be tested without a component.
 */
export function freightNote(
  agreedCents: number,
  arrivedCents: number,
  money: (cents: number) => string
): FreightNote {
  const spread =
    'Spread across the items as they arrive, so what you hold is valued at what it really cost.';

  if (arrivedCents <= 0) {
    return { cents: agreedCents, detail: spread };
  }
  if (agreedCents <= 0) {
    return {
      cents: arrivedCents,
      detail: `Nothing was agreed for freight when this order was raised. ${money(arrivedCents)} was charged when the goods came in, and it is already in what your stock is worth and in what the supplier billed you.`,
    };
  }
  return {
    cents: agreedCents + arrivedCents,
    detail: `${money(agreedCents)} agreed when this order was raised, and ${money(arrivedCents)} more charged when the goods came in. ${spread}`,
  };
}
