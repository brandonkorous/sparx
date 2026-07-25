'use client';

// B2B portal — order list for one account.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import { orderStatusTone } from '@/components/order-timeline';
import { getB2bOrders, type B2bOrderEntry } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function B2bOrdersPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const [orders, setOrders] = useState<B2bOrderEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setOrders(null);
    setError(null);
    getB2bOrders(tenantSlug, accountId, skip, PAGE_SIZE)
      .then((res) => {
        if (!active) return;
        setOrders(res.items);
        setTotal(res.total);
      })
      .catch(() => active && setError('Could not load orders.'));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId, skip]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <Link href={`/account/b2b/${accountId}`} className="link link-primary text-sm">
          ← Back
        </Link>
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">Orders</h1>
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : orders === null ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : orders.length === 0 ? (
        <div
          className="card border-base-300 border"
          style={{ padding: '2rem', textAlign: 'center' }}
        >
          <p className="text-base-content">No orders found on this account.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {orders.map((o) => (
              <div
                key={o.id}
                className="card border-base-300 border"
                style={{
                  padding: '0.875rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div>
                  <strong>#{o.orderNumber}</strong>
                  <div
                    className="text-base-content"
                    style={{ fontSize: '0.82rem', marginTop: '0.15rem' }}
                  >
                    {formatDate(o.createdAt)}
                    {o.customerName && (
                      <span style={{ marginLeft: '0.4rem' }}>· {o.customerName}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Badge color={orderStatusTone(o.status)} variant="soft">
                    {o.status}
                  </Badge>
                  <strong style={{ whiteSpace: 'nowrap' }}>
                    {formatMoney(o.totalCents, o.currency)}
                  </strong>
                </div>
              </div>
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span
                className="text-base-content"
                style={{ fontSize: '0.85rem', lineHeight: '2.25rem' }}
              >
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
              </span>
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={skip + PAGE_SIZE >= total}
                onClick={() => setSkip(skip + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
