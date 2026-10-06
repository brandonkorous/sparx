// WHY THE ITEMS AND THE MONEY DISAGREE ABOUT WHAT CAME BACK.
//
// O-000004, Anneliese Vogt, on the order pane:
//
//     The Ash Overshirt    1 × $128.00                          $128.00
//     The Everyday Tee     1 × $42.00                            $42.00
//                          1 refunded
//     …
//     Order total                                               $170.00
//     Given back                                                $170.00
//
// One item marked returned, and the whole $170 back. A reader takes the obvious
// inference — the Overshirt was kept — and it is wrong. Both came back:
//
//     order_refunds for O-000004
//       $42.00   completed   "Return c2533620-…"   2026-08-26
//       $128.00  completed   (no reason)           2026-08-28
//
// ── Why the line is blank, and why that is honest ───────────────────────────
//
// A refund raised through a RETURN knows which items it covers and writes them
// to `order_refund_items`. A refund raised against the order is an AMOUNT, and
// nobody is asked which items it stands for. Measured 2026-09-17, platform-wide:
//
//     12 refunds, 1 with any line detail at all
//     11 orders with refunds, 11 whose lines understate the money,
//     10 with no line marked at all
//
// So `quantityRefunded` is not stale or unread — for eleven refunds out of
// twelve the fact was never captured. The console cannot fill it in and must not
// invent it ([[feedback_never_present_absence_as_measurement]]).
//
// What it CAN stop doing is letting the blank read as an answer. An unmarked
// line beside a full refund is absence behaving exactly like "this one was
// kept" ([[feedback_absent_behaves_like_fine]]).
//
// ── It claims only what it can prove ────────────────────────────────────────
//
// It states no figure. `refundTotal` is a sum of amounts and the lines carry
// quantities, a unit price, a per-line discount and tax folded in differently,
// so any money split this file computed would be a guess wearing a dollar sign.
// The two cases below are the ones the data settles outright; a part refund with
// some lines marked is genuinely ambiguous and gets no sentence.

/** The shape this reads. Deliberately minimal so the note can be tested. */
export interface RefundedOrder {
  total: number;
  refundTotal: number;
  /** Of `refundTotal`, how much went back as returned core deposits (from the
   *  refunds' own record of what they were for). */
  depositsReturned?: number;
  items?: { quantity: number; quantityRefunded: number; coresReturned?: number }[] | null;
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * The sentence that goes under "Given back", or null when the items and the
 * money already agree and there is nothing to explain.
 */
export function refundNote(order: RefundedOrder): string | null {
  if (order.refundTotal <= 0) return null;

  const items = order.items ?? [];
  if (items.length === 0) return null;

  const marked = items.reduce((n, i) => n + i.quantityRefunded, 0);
  const bought = items.reduce((n, i) => n + i.quantity, 0);

  // A returned core deposit is money back for a known line, recorded as such, and
  // the line above already says "1 core back". Read as an unexplained whole-order
  // refund it told Gillett Diesel the opposite of what happened (sparx persona
  // issue 057).
  const deposits = order.depositsReturned ?? 0;
  if (deposits > 0) {
    const cores = items.reduce((n, i) => n + (i.coresReturned ?? 0), 0);
    const which =
      cores === 1
        ? 'the core deposit, given back when the old part came in'
        : 'core deposits, given back as the old parts came in';
    if (order.refundTotal <= deposits + 0.005) {
      return cores === 1 ? `That was ${which}.` : `That was all ${which}.`;
    }
    if (marked === 0) {
      return (
        `${money(deposits)} of it was ${which}. The rest was given back against the ` +
        'order as a whole rather than item by item.'
      );
    }
    return null;
  }

  // Ten of the eleven. Nothing above it says anything, so the money is the only
  // record of what happened.
  if (marked === 0) {
    return (
      'None of the items above is marked as returned, because this was given back ' +
      'against the order as a whole rather than item by item.'
    );
  }

  // Hers. Everything came back, and only part of it is marked.
  if (order.refundTotal >= order.total && marked < bought) {
    return (
      'The whole order was given back, though only some of the items above are marked ' +
      'as returned. The rest was given back against the order as a whole.'
    );
  }

  return null;
}
