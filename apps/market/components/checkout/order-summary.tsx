// Checkout order summary (server-safe presentational). Renders the cart lines +
// totals. Totals come from the live checkout session once one exists (it carries
// shipping/tax/surcharge); before that, the cart's own totals are shown.

import Image from 'next/image';
import { ImageOff } from 'lucide-react';

import { formatCents } from '@/lib/format';
import type { CartItem, CartTotals } from '@/lib/cart-client';

export function OrderSummary({
  items,
  totals,
  currency,
  surchargeLabel,
}: {
  items: CartItem[];
  totals: CartTotals;
  currency: string;
  surchargeLabel?: string;
}) {
  return (
    <aside className="mx-summary">
      <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Order summary
      </h2>

      <div className="mb-4">
        {items.map((line) => (
          <div key={line.id} className="mx-line">
            <span className="mx-line__media">
              {line.imageUrl ? (
                <Image src={line.imageUrl} alt={line.title} fill sizes="64px" />
              ) : (
                <span className="flex h-full items-center justify-center" aria-hidden>
                  <ImageOff size={18} style={{ color: 'var(--color-text-secondary)' }} />
                </span>
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="mx-line__title">{line.title}</span>
              {line.variantTitle ? (
                <span className="mx-line__meta">{line.variantTitle}</span>
              ) : null}
              <span className="mx-line__meta">Qty {line.quantity}</span>
            </div>
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {formatCents(line.lineTotalCents, currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-totals">
        <div className="mx-totals__row">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCents(totals.subtotalCents, currency)}</span>
        </div>
        {totals.discountTotalCents > 0 ? (
          <div className="mx-totals__row">
            <span>Discount</span>
            <span className="tabular-nums">
              −{formatCents(totals.discountTotalCents, currency)}
            </span>
          </div>
        ) : null}
        <div className="mx-totals__row">
          <span>Shipping</span>
          <span className="tabular-nums">
            {totals.shippingTotalCents > 0
              ? formatCents(totals.shippingTotalCents, currency)
              : 'Free'}
          </span>
        </div>
        {totals.taxTotalCents > 0 ? (
          <div className="mx-totals__row">
            <span>Tax</span>
            <span className="tabular-nums">{formatCents(totals.taxTotalCents, currency)}</span>
          </div>
        ) : null}
        {totals.surchargeTotalCents && totals.surchargeTotalCents > 0 ? (
          <div className="mx-totals__row">
            <span>{surchargeLabel ?? 'Processing fee'}</span>
            <span className="tabular-nums">
              {formatCents(totals.surchargeTotalCents, currency)}
            </span>
          </div>
        ) : null}
        <div className="mx-totals__row mx-totals__row--grand">
          <span>Total</span>
          <span className="tabular-nums">{formatCents(totals.totalCents, currency)}</span>
        </div>
      </div>
    </aside>
  );
}
