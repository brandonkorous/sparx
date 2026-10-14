'use client';

// Order history. Lists the signed-in customer's orders (most recent first)
// with status + total, linking to per-order detail. The row is the shared
// `OrderRow`.
//
// It pages. It asked for the first 10 and had no way on, so a buyer's 11th order
// could not be reached from here (sparx persona issue 194).
//
// A wholesale buyer can Order again from here (sparx persona issue 086): the
// order's items into the cart at today's prices for their account.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { ListPager } from '@/components/account/list-pager';
import { OrderRow } from '@/components/account/order-row';
import { getOrders, reorderOwnOrder, type OrderSummary } from '@/lib/customer-client';
import { FillCartButton } from '@/components/account/order-again-button';
import { useOrderingAccounts } from '@/components/account/ordering-accounts';
import { Alert, Button } from '@wizeworks/silicaui-react';

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const { tenantSlug } = useCustomer();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Order again is for a contact who can order on a wholesale account.
  const { accounts } = useOrderingAccounts();
  const canOrderAgain = accounts.length > 0;

  useEffect(() => {
    let active = true;
    setOrders(null);
    setError(null);
    getOrders(tenantSlug, offset / PAGE_SIZE + 1, PAGE_SIZE)
      .then((res) => {
        if (!active) return;
        setOrders(res.orders);
        setTotal(res.total);
      })
      .catch(() => active && setError('Could not load your orders.'));
    return () => {
      active = false;
    };
  }, [tenantSlug, offset]);

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
        <>
          <div className="flex flex-col gap-3">
            {orders.map((o) => (
              <div key={o.id} className="flex flex-col gap-2">
                <OrderRow
                  href={`/account/orders/${o.id}`}
                  orderNumber={o.orderNumber}
                  placedAt={o.placedAt}
                  status={o.status}
                  collecting={o.collecting}
                  totalCents={o.totalCents}
                  currency={o.currency}
                />
                {canOrderAgain && (
                  <FillCartButton
                    label="Order again"
                    busyLabel="Adding to your cart…"
                    size="sm"
                    variant="outline"
                    run={(cartId) => reorderOwnOrder(tenantSlug, o.id, cartId)}
                  />
                )}
              </div>
            ))}
          </div>
          <ListPager offset={offset} pageSize={PAGE_SIZE} total={total} onMove={setOffset} />
        </>
      )}
    </div>
  );
}
