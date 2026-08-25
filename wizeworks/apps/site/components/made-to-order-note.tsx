// What a shopper is told BEFORE they commit to something that has to be made
// (issue 026): how long the wait is, what happens to their money, and whether
// today's batch has any left.
//
// The words are in `lib/made-to-order-copy`, not here — the live product page is
// composed from the silica catalog and binds strings, so a component cannot be
// the only place they exist (issue 184). This draws them; it does not write them.

import type { PublicMadeToOrder } from '@/lib/commerce';
import { madeToOrderCopy, type StorefrontPaymentMode } from '@/lib/made-to-order-copy';

export function MadeToOrderNote({
  madeToOrder,
  priceCents,
  currency,
  locale,
  paymentMode,
}: {
  madeToOrder: PublicMadeToOrder;
  /** The resolved variant's price, or null while a choice is still open. */
  priceCents: number | null;
  currency: string;
  locale: string;
  paymentMode?: StorefrontPaymentMode;
}) {
  const copy = madeToOrderCopy(madeToOrder, {
    priceCents,
    currency,
    locale,
    ...(paymentMode ? { paymentMode } : {}),
  });
  if (!copy) return null;

  return (
    <div className="rounded-box border-base-300 bg-base-200 text-base-content flex flex-col gap-1 border p-3 text-sm">
      {copy.ready ? <span className="font-semibold">{copy.ready}</span> : null}
      {copy.deposit ? <span>{copy.deposit}</span> : null}
      {copy.scarce ? <span className="font-semibold">{copy.scarce}</span> : null}
    </div>
  );
}
