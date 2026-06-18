'use client';

// Single order detail — line items, totals, shipping address, status.

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SparxAlert, SparxBadge, SparxButton } from '@sparx/site-ui';

import { useCustomer } from '@/components/customer-provider';
import { getOrder, AccountError, type OrderDetail } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { statusColor } from '@/lib/status-badge';

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
        <p className="st-muted" style={{ marginBottom: '1rem' }}>
          We couldn’t find that order.
        </p>
        <SparxButton asChild color="neutral" variant="outline">
          <Link href="/account/orders">← Back to orders</Link>
        </SparxButton>
      </div>
    );
  }
  if (error) {
    return (
      <SparxAlert color="danger" role="alert">
        Could not load this order.
      </SparxAlert>
    );
  }
  if (!order) return <div className="st-skeleton" style={{ height: 320 }} />;

  const ship = addressLine(order.shippingAddress);

  return (
    <div>
      <Link href="/account/orders" className="st-muted" style={{ fontSize: '0.85rem' }}>
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
        <h1 className="st-h2">Order #{order.orderNumber}</h1>
        <SparxBadge color={statusColor(order.status)}>{order.status}</SparxBadge>
      </div>
      <p className="st-muted" style={{ marginBottom: '1.5rem' }}>
        Placed {formatDate(order.placedAt)} · {order.paymentStatus}
      </p>

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
              <span className="st-muted"> × {it.quantity}</span>
            </span>
            <strong>{formatMoney(it.lineTotalCents, order.currency)}</strong>
          </div>
        ))}
      </div>

      <div className="st-summary" style={{ maxWidth: 360, marginLeft: 'auto' }}>
        <div className="st-summary__row">
          <span>Subtotal</span>
          <span>{formatMoney(order.subtotalCents, order.currency)}</span>
        </div>
        {order.discountTotalCents > 0 ? (
          <div className="st-summary__row">
            <span>Discount</span>
            <span>−{formatMoney(order.discountTotalCents, order.currency)}</span>
          </div>
        ) : null}
        <div className="st-summary__row">
          <span>Shipping</span>
          <span>{formatMoney(order.shippingTotalCents, order.currency)}</span>
        </div>
        {order.taxTotalCents > 0 ? (
          <div className="st-summary__row">
            <span>Tax</span>
            <span>{formatMoney(order.taxTotalCents, order.currency)}</span>
          </div>
        ) : null}
        <div className="st-summary__total">
          <span>Total</span>
          <span>{formatMoney(order.totalCents, order.currency)}</span>
        </div>
      </div>

      {ship ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 className="st-h3" style={{ marginBottom: '0.5rem' }}>
            Shipping to
          </h2>
          <p className="st-muted">{ship}</p>
        </div>
      ) : null}
    </div>
  );
}
