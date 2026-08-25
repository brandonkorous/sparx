// The made-to-order lines in a basket summary (issue 026): the day it can be
// collected, what the card is about to be charged, and what is left owing.
//
// One component for the cart and for checkout, because they are the same
// promise at two moments and a shopper who reads one number in the basket and
// a different one on the card form has been misled by the second.

import { formatMoney } from '@/lib/format';
import { readyDayLabel, type StorefrontPaymentMode } from '@/lib/made-to-order-copy';
import type { CartMadeToOrder } from './cart-provider';

export function MadeToOrderSummary({
  madeToOrder,
  currency,
  /** Checkout knows the final total including delivery and any surcharge; the
   *  basket does not, and says so rather than implying it is settled. */
  settled = false,
  /** Whether this website takes money at all. Defaults to `card`, which is what
   *  every storefront assumed before the mode was carried (issue 185). */
  paymentMode = 'card',
}: {
  madeToOrder: CartMadeToOrder;
  currency: string;
  settled?: boolean;
  paymentMode?: StorefrontPaymentMode;
}) {
  // A shop that settles in the room charges nothing here, so there is no "now"
  // for a deposit to be paid at. Splitting the total into "to pay now" and "to
  // pay on collection" describes a card transaction, and at a manual shop the
  // whole amount is arranged with the shop — including the deposit, whenever
  // they choose to ask for it. The ready DAY is still true and still matters, so
  // it stays; only the money comes out.
  const takesMoneyHere = paymentMode === 'card';
  const owing = takesMoneyHere && madeToOrder.balanceCents > 0;
  const ready = madeToOrder.readyOn ? readyDayLabel(madeToOrder.readyOn) : null;
  if (!owing && !ready) return null;

  return (
    <div className="border-base-300 flex flex-col gap-2 border-t pt-3">
      {owing ? (
        <>
          <div className="text-base-content flex justify-between text-lg font-semibold">
            <span>{settled ? 'To pay now' : 'To pay at checkout'}</span>
            <span>{formatMoney(madeToOrder.dueNowCents, currency)}</span>
          </div>
          <div className="text-base-content flex justify-between text-sm">
            <span>{ready ? `To pay when you collect` : 'To pay on collection'}</span>
            <span>{formatMoney(madeToOrder.balanceCents, currency)}</span>
          </div>
        </>
      ) : null}
      {ready ? (
        <p className="text-base-content m-0 text-sm font-semibold">
          Ready from {ready}
          {madeToOrder.noticeDays !== null
            ? ` — one item needs ${String(madeToOrder.noticeDays)} day${madeToOrder.noticeDays === 1 ? '' : 's'} to make.`
            : '.'}
        </p>
      ) : null}
      {owing ? (
        <p className="text-base-content m-0 text-sm">
          Part of this order is a deposit. Delivery and tax are paid now; the rest is paid when you
          collect.
        </p>
      ) : null}
      {!takesMoneyHere && paymentMode === 'in_person' && madeToOrder.balanceCents > 0 ? (
        <p className="text-base-content m-0 text-sm">
          This shop takes payment in person, so nothing is charged on this website.
        </p>
      ) : null}
    </div>
  );
}
