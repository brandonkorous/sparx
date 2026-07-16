// Checkout order summary (server-safe presentational). Renders the cart lines +
// totals. Totals come from the live checkout session once one exists (it carries
// shipping/tax/surcharge); before that, the cart's own totals are shown.

import Image from 'next/image';
import { ImageOff } from 'lucide-react';

import { formatCents } from '@/lib/format';
import { TotalsRow } from '@/components/checkout/ui';
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
    <aside className="border-base-300 bg-base-100 rounded-xl border p-5 lg:sticky lg:top-32">
      <h2 className="text-base-content mb-4 text-base font-semibold">Order summary</h2>

      <div className="divide-base-300 mb-4 flex flex-col divide-y">
        {items.map((line) => (
          <div key={line.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="border-base-300 bg-base-200 relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border">
              {line.imageUrl ? (
                <Image
                  src={line.imageUrl}
                  alt={line.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <span
                  className="text-base-content flex h-full items-center justify-center"
                  aria-hidden
                >
                  <ImageOff size={18} />
                </span>
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base-content text-sm font-semibold">{line.title}</span>
              {line.variantTitle ? (
                <span className="text-base-content text-[0.8125rem]">{line.variantTitle}</span>
              ) : null}
              <span className="text-base-content text-[0.8125rem]">Qty {line.quantity}</span>
            </div>
            <span className="text-base-content text-sm font-semibold tabular-nums">
              {formatCents(line.lineTotalCents, currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <TotalsRow label="Subtotal" value={formatCents(totals.subtotalCents, currency)} />
        {totals.discountTotalCents > 0 ? (
          <TotalsRow
            label="Discount"
            value={`−${formatCents(totals.discountTotalCents, currency)}`}
            tone="success"
          />
        ) : null}
        <TotalsRow
          label="Shipping"
          value={
            totals.shippingTotalCents > 0
              ? formatCents(totals.shippingTotalCents, currency)
              : 'Free'
          }
        />
        {totals.taxTotalCents > 0 ? (
          <TotalsRow label="Tax" value={formatCents(totals.taxTotalCents, currency)} />
        ) : null}
        {totals.surchargeTotalCents && totals.surchargeTotalCents > 0 ? (
          <TotalsRow
            label={surchargeLabel ?? 'Processing fee'}
            value={formatCents(totals.surchargeTotalCents, currency)}
          />
        ) : null}
        <TotalsRow label="Total" value={formatCents(totals.totalCents, currency)} grand />
      </div>
    </aside>
  );
}
