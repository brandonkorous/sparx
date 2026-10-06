'use client';

// Checkout-side order summary. Mirrors the cart summary but read-only.

import Image from 'next/image';
import { cadenceLabel } from '@wizeworks/commerce-schemas';

import { formatMoney } from '@/lib/format';
import type { CartLine, CartMadeToOrder, CartTotals } from '../cart-provider';
import { CoreLine } from '../core-choice';
import { MadeToOrderSummary } from '../made-to-order-summary';
import type { StorefrontPaymentMode } from '@/lib/made-to-order-copy';
import { shippingLine, summaryTotalCents } from './summary-lines';

export function OrderSummary({
  lines,
  totals,
  currency,
  surchargeLabel,
  madeToOrder,
  paymentMode = 'card',
  shippingSettled = true,
  pendingShippingCents = null,
  onCoreFirst,
}: {
  lines: CartLine[];
  totals: CartTotals;
  currency: string;
  /** Label for the disclosed surcharge line (docs/48 §6), e.g. "Card processing fee". */
  surchargeLabel?: string;
  /** Made to order (issue 026). Absent on a checkout that predates it, which
   *  reads as an ordinary basket rather than as one with nothing to pay. */
  madeToOrder?: CartMadeToOrder;
  /** Whether this website takes money at all (issue 185). */
  paymentMode?: StorefrontPaymentMode;
  /**
   * Whether delivery has been WORKED OUT yet (issue 203’s cousin, issue 206).
   *
   * Zero shipping is two different answers: "this delivery is free" and "nobody
   * has chosen a delivery yet". Printing the second as Free told a shopper her
   * $128 order cost $128 on two screens, and $137 on the third.
   */
  shippingSettled?: boolean;
  /**
   * The delivery the shopper has ALREADY PICKED, before the step is submitted.
   *
   * `shippingSettled` protects a real thing — the session's totals go stale
   * until the delivery step posts, so its zero must never print as Free. But it
   * was also answering a question nobody asked once a rate is chosen: the price
   * is on the screen, selected, three inches away. So the summary said "Once we
   * know where" and "Total so far $42.00" beside a ticked "Delivery · 4 days
   * $9.00", and going BACK from payment dropped the total from $51 to $42 with
   * nothing changed. The chosen rate carries its own amount; this is that
   * amount, and null means nothing is chosen yet.
   */
  pendingShippingCents?: number | null;
  /**
   * Switch a rebuilt part between paying the core deposit and sending the old part
   * first (issue 057). Passed only while the summary still follows the basket; once
   * the payment step holds the total, a switch would change what the card is about to
   * be charged, so the line says what it is and offers nothing.
   */
  onCoreFirst?: (lineId: string, coreFirst: boolean) => Promise<void>;
}) {
  const surchargeCents = totals.surchargeTotalCents ?? 0;
  const chosenShippingCents = pendingShippingCents ?? null;
  const shipping = shippingLine({
    settled: shippingSettled,
    settledShippingCents: totals.shippingTotalCents,
    chosenShippingCents,
  });
  const shownTotalCents = summaryTotalCents({
    settled: shippingSettled,
    totalCents: totals.totalCents,
    chosenShippingCents,
  });
  return (
    // Not sticky. The <aside> that holds it on checkout already is, and the
    // confirmation screen renders the same summary in the middle of a page.
    <div className="rounded-box border-base-300 bg-base-100 flex flex-col gap-3 border p-6">
      <h2 className="text-base-content text-2xl font-semibold">Order summary</h2>

      <div className="flex flex-col gap-3">
        {lines.map((line) => (
          <div key={line.id} className="flex items-center gap-3">
            <div className="rounded-field bg-base-200 relative size-14 shrink-0 overflow-hidden">
              {line.imageUrl ? (
                <Image
                  src={line.imageUrl}
                  alt={line.title}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : null}
              <span className="bg-primary text-primary-content absolute -top-2 -right-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] px-1 text-[0.65rem] font-bold">
                {line.quantity}
              </span>
            </div>
            <div className="flex-1 text-[0.9rem]">
              {line.title}
              {line.repeat ? (
                <span className="text-base-content"> · {cadenceLabel(line.repeat)}</span>
              ) : null}
              {line.variantTitle ? (
                <span className="text-base-content"> · {line.variantTitle}</span>
              ) : null}
              {/* The deposit, or "Ready once your old part arrives" (sparx issues
                  051, 057), and the switch while the basket can still change. */}
              <div>
                <CoreLine
                  line={line}
                  currency={currency}
                  {...(onCoreFirst
                    ? { onSwitch: (coreFirst: boolean) => onCoreFirst(line.id, coreFirst) }
                    : {})}
                />
              </div>
            </div>
            <span className="text-[0.9rem] font-semibold">
              {formatMoney(line.lineTotalCents, currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="text-base-content flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatMoney(totals.subtotalCents, currency)}</span>
      </div>
      {totals.discountTotalCents > 0 ? (
        <div className="text-success flex justify-between text-sm">
          <span>Discount</span>
          <span>−{formatMoney(totals.discountTotalCents, currency)}</span>
        </div>
      ) : null}
      {/* Refundable core deposits on rebuilt parts (sparx issue 051). Inside the
          total and outside the subtotal, so it needs its own row for the sum to
          add up, and its own name so nobody reads it as a fee. */}
      {totals.coreChargeTotalCents > 0 ? (
        <div className="text-base-content flex justify-between text-sm">
          <span>Refundable core deposits</span>
          <span>{formatMoney(totals.coreChargeTotalCents, currency)}</span>
        </div>
      ) : null}
      <div className="text-base-content flex justify-between text-sm">
        <span>Shipping</span>
        <span>
          {shipping.kind === 'unknown'
            ? 'Once we know where'
            : shipping.kind === 'free'
              ? 'Free'
              : formatMoney(shipping.cents, currency)}
        </span>
      </div>
      {totals.taxTotalCents > 0 ? (
        <div className="text-base-content flex justify-between text-sm">
          <span>Tax</span>
          <span>{formatMoney(totals.taxTotalCents, currency)}</span>
        </div>
      ) : null}
      {surchargeCents > 0 ? (
        <div className="text-base-content flex justify-between text-sm">
          <span>{surchargeLabel ?? 'Surcharge'}</span>
          <span>{formatMoney(surchargeCents, currency)}</span>
        </div>
      ) : null}
      {/* Money already paid, taken off after tax because that is the order the
          total is built in. Both of these are inside totalCents already; without
          their own rows the summary silently failed to add up, and a shopper
          checking the sum found the page wrong rather than the total explained. */}
      {totals.giftCardAppliedCents > 0 ? (
        <div className="text-success flex justify-between text-sm">
          <span>Gift card</span>
          <span>−{formatMoney(totals.giftCardAppliedCents, currency)}</span>
        </div>
      ) : null}
      {totals.accountCreditAppliedCents > 0 ? (
        <div className="text-success flex justify-between text-sm">
          <span>Credit on your account</span>
          <span>−{formatMoney(totals.accountCreditAppliedCents, currency)}</span>
        </div>
      ) : null}
      <div className="border-base-300 text-base-content flex justify-between border-t pt-3 text-lg font-semibold">
        <span>{shippingSettled ? 'Total' : 'Total so far'}</span>
        <span>{formatMoney(shownTotalCents, currency)}</span>
      </div>

      {/* What the card is ACTUALLY charged, which on a deposit order is less
          than the total above. This is the last screen before paying, so the
          two numbers have to be on it together (issue 026). */}
      {madeToOrder ? (
        <MadeToOrderSummary
          madeToOrder={madeToOrder}
          currency={currency}
          paymentMode={paymentMode}
          settled
        />
      ) : null}
      {surchargeCents > 0 ? (
        <p className="text-base-content mt-2 text-[0.8rem]">
          {surchargeLabel ?? 'A surcharge'} of {formatMoney(surchargeCents, currency)} is added to
          cover payment processing costs and is included in your total.
        </p>
      ) : null}
    </div>
  );
}
