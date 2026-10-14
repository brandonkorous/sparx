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
import { OrderRow } from '@/components/account/order-row';
import {
  getB2bOrders,
  getB2bSummary,
  ORDERING_ROLES,
  reorderB2bOrder,
  type B2bOrderEntry,
} from '@/lib/customer-client';
import { FillCartButton } from '@/components/account/order-again-button';
import { Alert } from '@wizeworks/silicaui-react';
import { ListPager } from '@/components/account/list-pager';

const PAGE_SIZE = 20;

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
              <div key={o.id} className="flex flex-col gap-2">
                <OrderRow
                  href={`/account/b2b/${accountId}/orders/${o.id}`}
                  orderNumber={o.orderNumber}
                  placedAt={o.createdAt}
                  placedBy={o.customerName}
                  status={o.status}
                  collecting={o.collecting}
                  totalCents={o.totalCents}
                  currency={o.currency}
                />
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

          <ListPager offset={skip} pageSize={PAGE_SIZE} total={total} onMove={setSkip} />
        </>
      )}
    </div>
  );
}
