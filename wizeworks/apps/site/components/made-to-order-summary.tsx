// The made-to-order lines in a basket summary (issue 026): the day it can be
// collected, what the card is about to be charged, and what is left owing.
//
// One component for the cart and for checkout, because they are the same
// promise at two moments and a shopper who reads one number in the basket and
// a different one on the card form has been misled by the second.

import { formatMoney } from '@/lib/format';
import type { CartMadeToOrder } from './cart-provider';

function dayLabel(day: string): string | null {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return null;
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function MadeToOrderSummary({
  madeToOrder,
  currency,
  /** Checkout knows the final total including delivery and any surcharge; the
   *  basket does not, and says so rather than implying it is settled. */
  settled = false,
}: {
  madeToOrder: CartMadeToOrder;
  currency: string;
  settled?: boolean;
}) {
  const owing = madeToOrder.balanceCents > 0;
  const ready = madeToOrder.readyOn ? dayLabel(madeToOrder.readyOn) : null;
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
          Part of this order is a deposit. Delivery and tax are paid now; the rest of the
          made-to-order items is paid when you collect them.
        </p>
      ) : null}
    </div>
  );
}
