// What a refund actually does, said once.
//
// Three places on the order pane describe the same act: the line under "Refund
// this order", the confirm before it happens, and the toast after. Only the
// first one branched on whether the money has a card to go back to. The other
// two told a baker who had just taken eight dollars in cash that the money was
// on its way back to a card, in the dialog she reads immediately before an
// irreversible action and in the receipt she reads immediately after.
//
// So the branch lives here now, and all three read from it.

export interface RefundWords {
  /** The line under the heading, before she has committed to anything. */
  readonly panel: string;
  /** The last thing she reads before an irreversible act. */
  readonly confirm: string;
  /** The receipt, once it is done. */
  readonly done: string;
}

export interface RefundFacts {
  /** Already formatted for her currency. */
  readonly amount: string;
  readonly orderNumber: string;
  /** False when any part of it was taken by hand, so there is no card to credit. */
  readonly toACard: boolean;
}

/** Stock is a separate decision from money, and it is the one people get wrong. */
const STOCK =
  'Stock is NOT taken back in. If you expect the items returned, process a return instead so the goods come back on the shelf.';

export function refundWords({ amount, orderNumber, toACard }: RefundFacts): RefundWords {
  if (toACard) {
    return {
      panel: `Sends ${amount} back to the card it was paid with. The money leaves your account straight away and this cannot be undone.`,
      confirm: `This sends ${amount} back to the card used for order ${orderNumber}. The money leaves your account straight away and this cannot be undone. ${STOCK}`,
      done: `Order ${orderNumber}. The card has been credited.`,
    };
  }
  return {
    panel: `Marks ${amount} as given back. You hand the money over yourself, so nothing is sent anywhere, and this cannot be undone.`,
    confirm: `This marks ${amount} on order ${orderNumber} as given back. You hand the money over yourself, so nothing is sent anywhere, and this cannot be undone. ${STOCK}`,
    done: `Order ${orderNumber}. Nothing was sent anywhere, so give them the money yourself.`,
  };
}
