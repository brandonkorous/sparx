'use client';

// Order history. Lists the signed-in customer's orders (most recent first)
// with status + total, linking to per-order detail.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { orderStatusTone } from '@/components/order-timeline';
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
      <h1
        className="text-base-content text-3xl font-semibold tracking-tight"
        style={{ marginBottom: '1.25rem' }}
      >
        Orders
      </h1>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : orders === null ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : orders.length === 0 ? (
        <div
          className="card border-base-300 border"
          style={{ padding: '2rem', textAlign: 'center' }}
        >
          <p className="text-base-content" style={{ marginBottom: '1rem' }}>
            You haven’t placed any orders yet.
          </p>
          <Button render={<Link href="/products" />} color="primary">
            Start shopping
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/account/orders/${o.id}`}
              className="card border-base-300 border"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div>
                <strong>#{o.orderNumber}</strong>
                <div className="text-base-content" style={{ fontSize: '0.85rem' }}>
                  {formatDate(o.placedAt)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Badge color={orderStatusTone(o.status)} variant="soft">
                  {o.status}
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
