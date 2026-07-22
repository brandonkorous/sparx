'use client';

// Checkout-side order summary. Mirrors the cart summary but read-only.

import Image from 'next/image';

import { formatMoney } from '@/lib/format';
import type { CartLine, CartTotals } from '../cart-provider';

export function OrderSummary({
  lines,
  totals,
  currency,
  surchargeLabel,
}: {
  lines: CartLine[];
  totals: CartTotals;
  currency: string;
  /** Label for the disclosed surcharge line (docs/48 §6), e.g. "Card processing fee". */
  surchargeLabel?: string;
}) {
  const surchargeCents = totals.surchargeTotalCents ?? 0;
  return (
    <div className="st-summary" style={{ position: 'sticky', top: '92px' }}>
      <h2 className="st-h3">Order summary</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {lines.map((line) => (
          <div key={line.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div className="st-line__media" style={{ width: 56, height: 56, position: 'relative' }}>
              {line.imageUrl ? (
                <Image
                  src={line.imageUrl}
                  alt={line.title}
                  fill
                  sizes="56px"
                  style={{ objectFit: 'cover' }}
                />
              ) : null}
              <span className="st-iconbtn__count" style={{ top: -8, right: -8 }}>
                {line.quantity}
              </span>
            </div>
            <span style={{ flex: 1, fontSize: '0.9rem' }}>
              {line.title}
              {line.variantTitle ? <span className="st-muted"> · {line.variantTitle}</span> : null}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {formatMoney(line.lineTotalCents, currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="st-summary__row">
        <span>Subtotal</span>
        <span>{formatMoney(totals.subtotalCents, currency)}</span>
      </div>
      {totals.discountTotalCents > 0 ? (
        <div className="st-summary__row text-success">
          <span>Discount</span>
          <span>−{formatMoney(totals.discountTotalCents, currency)}</span>
        </div>
      ) : null}
      <div className="st-summary__row">
        <span>Shipping</span>
        <span>
          {totals.shippingTotalCents > 0
            ? formatMoney(totals.shippingTotalCents, currency)
            : 'Free'}
        </span>
      </div>
      {totals.taxTotalCents > 0 ? (
        <div className="st-summary__row">
          <span>Tax</span>
          <span>{formatMoney(totals.taxTotalCents, currency)}</span>
        </div>
      ) : null}
      {surchargeCents > 0 ? (
        <div className="st-summary__row">
          <span>{surchargeLabel ?? 'Surcharge'}</span>
          <span>{formatMoney(surchargeCents, currency)}</span>
        </div>
      ) : null}
      <div className="st-summary__total">
        <span>Total</span>
        <span>{formatMoney(totals.totalCents, currency)}</span>
      </div>
      {surchargeCents > 0 ? (
        <p className="st-muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
          {surchargeLabel ?? 'A surcharge'} of {formatMoney(surchargeCents, currency)} is added to
          cover payment processing costs and is included in your total.
        </p>
      ) : null}
    </div>
  );
}
