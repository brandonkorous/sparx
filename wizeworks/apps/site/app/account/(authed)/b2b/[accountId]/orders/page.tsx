'use client';

// Wholesale account: the orders placed on one trade account. A viewer sees
// only her own; every other role sees the whole account's (the portal API
// decides which).
//
// Statuses read in the shopper's words through the same `orderStatusLabel` the
// personal order list uses, so one order is never called two things (sparx
// persona issue 084).
//
// Each order opens to its own page, and a contact who can order can Order
// again from here: the order's items go into the cart at today's prices for
// the account (sparx persona issue 086).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import { orderStatusLabel, orderStatusTone } from '@/components/order-timeline';
import {
  getB2bOrders,
  getB2bSummary,
  ORDERING_ROLES,
  reorderB2bOrder,
  type B2bOrderEntry,
} from '@/lib/customer-client';
import { FillCartButton } from '@/components/account/order-again-button';
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
  const [canOrder, setCanOrder] = useState(false);

  useEffect(() => {
    let active = true;
    getB2bSummary(tenantSlug, accountId)
      .then((s) => active && setCanOrder(ORDERING_ROLES.has(s.account.role)))
      .catch(() => active && setCanOrder(false));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId]);

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
      .catch(() => active && setError('The orders on this account could not be loaded just now.'));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId, skip]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Link href={`/account/b2b/${accountId}`} className="link link-primary">
          ← Back to account
        </Link>
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">Orders</h1>
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : orders === null ? (
        <div className="skeleton h-50" />
      ) : orders.length === 0 ? (
        <div className="card border-base-300 items-center border p-8 text-center">
          <p className="text-base-content">No orders have been placed on this account yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <div key={o.id} className="card border-base-300 gap-3 border px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    {/* An order number is one token: it must not break across lines. */}
                    <Link
                      href={`/account/b2b/${accountId}/orders/${o.id}`}
                      className="link link-primary font-semibold whitespace-nowrap"
                    >
                      {o.orderNumber}
                    </Link>
                    <div className="text-base-content text-sm">
                      {formatDate(o.createdAt)}
                      {o.customerName && <span> · Placed by {o.customerName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge color={orderStatusTone(o.status)} variant="soft">
                      {orderStatusLabel(o.status)}
                    </Badge>
                    <strong className="whitespace-nowrap">
                      {formatMoney(o.totalCents, o.currency)}
                    </strong>
                  </div>
                </div>
                {canOrder && (
                  <FillCartButton
                    label="Order again"
                    busyLabel="Adding to your cart…"
                    size="sm"
                    variant="outline"
                    run={(cartId) => reorderB2bOrder(tenantSlug, accountId, o.id, cartId)}
                  />
                )}
              </div>
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="text-base-content text-sm">
                {skip + 1} to {Math.min(skip + PAGE_SIZE, total)} of {total}
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
