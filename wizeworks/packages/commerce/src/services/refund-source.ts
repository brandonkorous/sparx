// Where a return's refund goes when it goes "back the way they paid".
//
// One answer, read by two callers: `issueRefund`, which sends the money, and the
// return detail, which the screen words its refund from. The screen used to say
// every refund "moves real money", so a counter sale's refund told the owner the
// money had gone back to a card when nothing had moved and they still had to hand
// it over (sparx persona issue 178).

import { takenByGateway } from '@wizeworks/payments';

/** The captured payment on the order, as much of it as this question needs. */
export interface CapturedPayment {
  id: string;
  processor: string;
  processorRef: string | null;
}

/**
 * The gateway charge a refund reverses, or null when there is none.
 *
 * Null means the money was taken by hand (cash, a cheque, the shop's own card
 * machine, an account on terms) or never taken: a refund records the money, and a
 * person hands it over. A reference alone is NOT proof there is a charge to
 * reverse. The reference box is free text, and asking a gateway to reverse a
 * cheque number fails on a shop that never had one (persona issue 223). The
 * PROCESSOR is what decides.
 */
export function gatewayChargeOf(payment: CapturedPayment | null): string | null {
  if (!payment || !takenByGateway(payment.processor)) return null;
  return payment.processorRef ?? null;
}

/** How a settled refund reached the customer, in terms their own page can word.
 *  "Sent back" is true of a gateway refund only: cash or a cheque was handed to
 *  them, and store credit sits on their account (sparx persona issue 178). */
export type ShopperRefundRoute = 'payment' | 'by_hand' | 'store_credit';

export function shopperRefundRoute(
  issuedAs: string | null,
  refundsByHand: boolean
): ShopperRefundRoute | null {
  if (issuedAs === 'account_credit') return 'store_credit';
  if (issuedAs === 'original_payment') return refundsByHand ? 'by_hand' : 'payment';
  return null;
}
