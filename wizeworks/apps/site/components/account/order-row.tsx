// One order in a list on the account pages: its number, when it was placed (and
// by whom, on a shared wholesale account), its state and its total. The whole
// card is the link to the order.
//
// The account overview, the Orders page and the wholesale account's pages each
// drew their own row, and they had drifted: one card was a link and the next had
// only its number as one, and the same order read "#O-000022" on one page and
// "O-000022" on the next (sparx persona issues 193 and 195). One row now.
//
// Layout is utilities, not inline `style`. `.card` is itself a flex COLUMN, and
// an inline `display:flex` that never names a direction cannot undo that — the
// row rendered as a centred stack for exactly that reason (issue 294). A
// `flex-row` utility says the axis out loud. It wraps rather than overflows: at
// 360px the number, the state and the total do not fit on one line.

import Link from 'next/link';

import { Badge } from '@wizeworks/silicaui-react';

import { orderStatusLabel, orderStatusTone } from '@/components/order-timeline';
import { formatMoney } from '@/lib/format';

function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function OrderRow({
  href,
  orderNumber,
  placedAt,
  placedBy,
  status,
  collecting,
  totalCents,
  currency,
}: {
  href: string;
  orderNumber: string;
  placedAt: string;
  /** Who placed it, on a wholesale account several people buy for. */
  placedBy?: string | null;
  status: string;
  /** Taken at the counter or fetched, never sent (sparx persona issue 177). */
  collecting?: boolean;
  totalCents: number;
  currency: string;
}) {
  return (
    <Link
      href={href}
      className="card border-base-300 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 border px-5 py-4 sm:gap-x-4"
    >
      <div className="min-w-0">
        {/* An order number is one token: it must not break across lines at 360px. */}
        <strong className="whitespace-nowrap">{orderNumber}</strong>
        <div className="text-base-content text-sm">
          {formatOrderDate(placedAt)}
          {placedBy ? ` · Placed by ${placedBy}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <Badge color={orderStatusTone(status)} variant="soft">
          {orderStatusLabel(status, collecting)}
        </Badge>
        <strong className="whitespace-nowrap">{formatMoney(totalCents, currency)}</strong>
      </div>
    </Link>
  );
}
