'use client';

// On the account overview: the buyer's last few orders, with the way to the rest.
//
// The overview said "Manage your orders and details here" and then showed
// Continue shopping and Your cart, to a fleet buyer with eight orders and one of
// them waiting for approval (sparx persona issue 193). It draws nothing for
// someone who has not ordered yet: the links below it are the next step then.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert } from '@wizeworks/silicaui-react';

import { OrderRow } from '@/components/account/order-row';
import { useCustomer } from '@/components/customer-provider';
import { getOrders, type OrderSummary } from '@/lib/customer-client';

const SHOWN = 3;

export function RecentOrders() {
  const { tenantSlug, customer } = useCustomer();
  const customerId = customer?.id ?? null;
  const [found, setFound] = useState<{ orders: OrderSummary[]; total: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getOrders(tenantSlug, 1, SHOWN)
      .then((res) => {
        if (!active) return;
        setFound({ orders: res.orders, total: res.total });
        setFailed(false);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [tenantSlug, customerId]);

  if (failed) {
    return (
      <Alert color="danger" role="alert">
        Your recent orders could not be loaded just now.{' '}
        <Link href="/account/orders" className="link">
          See them on the Orders page
        </Link>
        .
      </Alert>
    );
  }
  if (found === null) return <div className="skeleton h-40" />;
  if (found.orders.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base-content m-0 text-xl font-semibold">Your recent orders</h2>
      <div className="flex flex-col gap-2">
        {found.orders.map((o) => (
          <OrderRow
            key={o.id}
            href={`/account/orders/${o.id}`}
            orderNumber={o.orderNumber}
            placedAt={o.placedAt}
            status={o.status}
            collecting={o.collecting}
            totalCents={o.totalCents}
            currency={o.currency}
          />
        ))}
      </div>
      <Link href="/account/orders" className="link link-primary">
        {found.total > found.orders.length ? `See all ${found.total} orders` : 'See your orders'}
      </Link>
    </section>
  );
}
