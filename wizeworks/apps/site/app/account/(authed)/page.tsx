'use client';

// Account overview: what the person's account holds right now, then the way on.
//
// An approver on a wholesale account is told here, first, when orders are
// waiting for their approval (sparx persona issue 087): this is the page they
// land on, and it used to say nothing about it. The same was true of everything
// else: it said "Manage your orders and details here" over two fixed links, to a
// fleet buyer with eight orders and an account close to its credit limit (sparx
// persona issue 193). So it shows where each wholesale account stands and the
// last few orders. Each draws nothing when there is nothing to show.

import Link from 'next/link';

import { AccountStanding } from '@/components/account/account-standing';
import { ApprovalsSummary } from '@/components/account/approvals-summary';
import { RecentOrders } from '@/components/account/recent-orders';
import { useCustomer } from '@/components/customer-provider';

export default function AccountOverviewPage() {
  const { customer } = useCustomer();
  const name = customer?.firstName ?? null;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="text-base-content m-0 text-3xl font-semibold tracking-tight">
          {name ? `Hi, ${name}` : 'Your account'}
        </h1>
        <p className="text-base-content m-0">Manage your orders and details here.</p>
      </div>

      <ApprovalsSummary />

      <AccountStanding />

      <RecentOrders />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[clamp(1rem,2vw,1.75rem)]">
        <Link href="/products" className="card border-base-300 block border p-5">
          <strong>Continue shopping</strong>
          <p className="text-base-content mt-1.5 mb-0">Browse the full catalog.</p>
        </Link>
        <Link href="/cart" className="card border-base-300 block border p-5">
          <strong>Your cart</strong>
          <p className="text-base-content mt-1.5 mb-0">Review items and check out.</p>
        </Link>
      </div>
    </div>
  );
}
