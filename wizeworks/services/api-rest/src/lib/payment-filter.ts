// WHICH PAYMENTS THE MONEY SCREEN ASKS FOR, as one pure decision.
//
// Split out of the route so it can be TESTED. Everything here is a string going
// into a where clause: it all compiles, and any of it can be wrong. One piece
// was.
//
// `refunded` is NOT a status word this platform writes. `recordRefund` inserts
// an OrderRefund row, flips the ORDER, and recomputes the order's rollup; the
// payment row goes on saying `captured` for ever. So picking "Refunded" on the
// Money → Payments filter asked for a word only a seed had ever written — one
// row platform-wide — while the three real refunded payments sat under "Paid".
// A shop owner looking for the $170 she gave back got an empty list.
//
// The order's `refundTotal` is the question that can be answered. It is
// maintained by `recomputeOrderPaymentRollup` at a documented chokepoint and
// agrees with the refund rows on all 11 refunded orders on this platform.

export interface PaymentListFilter {
  /** Payment statuses to accept, or `null` for any. */
  statuses: string[] | null;
  /** Also require that the payment's ORDER has money back against it. */
  requireOrderRefund: boolean;
}

/**
 * Turn the picked filter into what to ask the database.
 *
 * The `refunded` case widens the status to BOTH words rather than dropping it:
 * a refund only ever comes off money that was actually taken, and leaving the
 * status open would let a `pending` or `failed` row on a refunded order onto a
 * screen about money that moved.
 */
export function paymentListFilter(status: string | undefined): PaymentListFilter {
  if (status === 'refunded') {
    return { statuses: ['captured', 'refunded'], requireOrderRefund: true };
  }
  if (!status || status === 'all') {
    return { statuses: null, requireOrderRefund: false };
  }
  return { statuses: [status], requireOrderRefund: false };
}
