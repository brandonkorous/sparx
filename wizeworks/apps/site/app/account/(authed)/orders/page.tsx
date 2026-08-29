'use client';

// Order history. Lists the signed-in customer's orders (most recent first)
// with status + total, linking to per-order detail.
//
// Layout is utilities, not inline `style`. `.card` is itself a flex COLUMN, and
// an inline `display:flex` that never names a direction cannot undo that — the
// row rendered as a centred stack for exactly that reason (issue 294). A
// `flex-row` utility says the axis out loud.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { orderStatusLabel, orderStatusTone } from '@/components/order-timeline';
import { getOrders, type OrderSummary } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function OrdersPage() {
  const { tenantSlug } = useCustomer();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOrders(tenantSlug)
      .then((res) => active && setOrders(res.orders))
      .catch(() => active && setError('Could not load your orders.'));
    return () => {
      active = false;
    };
  }, [tenantSlug]);

  return (
    <div>
      <h1 className="text-base-content mb-5 text-3xl font-semibold tracking-tight">Orders</h1>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : orders === null ? (
        <div className="skeleton h-40" />
      ) : orders.length === 0 ? (
        <div className="card border-base-300 items-center border p-8 text-center">
          <p className="text-base-content mb-4">You haven’t placed any orders yet.</p>
          <Button render={<Link href="/products" />} color="primary">
            Start shopping
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/account/orders/${o.id}`}
              // Wraps rather than overflows: at 360px the number, the status and the
              // total do not fit on one line, and the total was sitting on the border.
              className="card border-base-300 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 border px-5 py-4 sm:gap-x-4"
            >
              <div className="min-w-0">
                {/* An order number is one token — it must not break across lines at 360px. */}
                <strong className="whitespace-nowrap">#{o.orderNumber}</strong>
                <div className="text-base-content text-sm">{formatDate(o.placedAt)}</div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <Badge color={orderStatusTone(o.status)} variant="soft">
                  {orderStatusLabel(o.status)}
                </Badge>
                <strong>{formatMoney(o.totalCents, o.currency)}</strong>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
