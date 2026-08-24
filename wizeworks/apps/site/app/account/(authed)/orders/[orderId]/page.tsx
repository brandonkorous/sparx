'use client';

// Single order detail — line items, totals, shipping address, status.

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { OrderTimeline, orderStatusTone } from '@/components/order-timeline';
import { getOrder, AccountError, type OrderDetail } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

function titleCase(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function addressLine(addr: Record<string, unknown> | null): string | null {
  if (!addr) return null;
  const parts = [
    addr.recipientName,
    addr.line1,
    addr.line2,
    [addr.city, addr.region, addr.postalCode].filter(Boolean).join(', '),
    addr.country,
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  return parts.length ? parts.join(' · ') : null;
}

/** The money breakdown — subtotal, optional discount/tax, shipping, total. */
function OrderTotals({ order }: { order: OrderDetail }) {
  return (
    <div
      className="rounded-box border-base-300 bg-base-100 flex flex-col gap-3 border p-6"
      style={{ maxWidth: 360, marginLeft: 'auto' }}
    >
      <div className="text-base-content flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatMoney(order.subtotalCents, order.currency)}</span>
      </div>
      {order.discountTotalCents > 0 ? (
        <div className="text-base-content flex justify-between text-sm">
          <span>Discount</span>
          <span>−{formatMoney(order.discountTotalCents, order.currency)}</span>
        </div>
      ) : null}
      <div className="text-base-content flex justify-between text-sm">
        <span>Shipping</span>
        <span>{formatMoney(order.shippingTotalCents, order.currency)}</span>
      </div>
      {order.taxTotalCents > 0 ? (
        <div className="text-base-content flex justify-between text-sm">
          <span>Tax</span>
          <span>{formatMoney(order.taxTotalCents, order.currency)}</span>
        </div>
      ) : null}
      <div className="border-base-300 text-base-content flex justify-between border-t pt-3 text-lg font-semibold">
        <span>Total</span>
        <span>{formatMoney(order.totalCents, order.currency)}</span>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOrder(tenantSlug, params.orderId)
      .then((o) => active && setOrder(o))
      .catch((err) =>
        active
          ? setError(err instanceof AccountError && err.status === 404 ? 'notfound' : 'error')
          : null
      );
    return () => {
      active = false;
    };
  }, [tenantSlug, params.orderId]);

  if (error === 'notfound') {
    return (
      <div>
        <p className="text-base-content" style={{ marginBottom: '1rem' }}>
          We couldn’t find that order.
        </p>
        <Button render={<Link href="/account/orders" />} color="neutral" variant="outline">
          ← Back to orders
        </Button>
      </div>
    );
  }
  if (error) {
    return (
      <Alert color="danger" role="alert">
        Could not load this order.
      </Alert>
    );
  }
  if (!order) return <div className="skeleton" style={{ height: 320 }} />;

  const ship = addressLine(order.shippingAddress);

  return (
    <div>
      <Link href="/account/orders" className="link link-hover text-sm">
        ← Orders
      </Link>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '1rem',
          margin: '0.5rem 0 1.5rem',
        }}
      >
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">
          Order #{order.orderNumber}
        </h1>
        <Badge color={orderStatusTone(order.status)} variant="soft">
          {titleCase(order.status)}
        </Badge>
      </div>
      <p className="text-base-content" style={{ marginBottom: '1.5rem' }}>
        Placed {formatDate(order.placedAt)} · Payment {titleCase(order.paymentStatus)}
      </p>

      {/* Order status timeline — the lifecycle at a glance. */}
      <div
        className="card border-base-300 border"
        style={{ padding: '1.5rem', marginBottom: '1.5rem' }}
      >
        <h2
          className="text-base-content text-2xl font-semibold"
          style={{ marginBottom: '1.25rem' }}
        >
          Order status
        </h2>
        <OrderTimeline order={order} />
      </div>

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}
      >
        {order.items.map((it) => (
          <div
            key={it.id}
            style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}
          >
            <span>
              {it.name}
              <span className="text-base-content"> × {it.quantity}</span>
            </span>
            <strong>{formatMoney(it.lineTotalCents, order.currency)}</strong>
          </div>
        ))}
      </div>

      <OrderTotals order={order} />

      {/* How it reaches them. An order with no address is not an order with a
          missing address: since issue 064 a collected order records none,
          because nobody was ever asked for one. */}
      {ship || order.shippingDescription ? (
        <div className="mt-6">
          <h2 className="text-base-content mb-2 text-2xl font-semibold">
            {order.collecting ? 'How you’ll get it' : 'Shipping to'}
          </h2>
          {order.shippingDescription ? (
            <p className="text-base-content">{order.shippingDescription}</p>
          ) : null}
          {ship ? <p className="text-base-content">{ship}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
