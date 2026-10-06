'use client';

// Account overview — greeting + quick links. Order history, addresses, and
// profile editing are their own pages; this is the hub.
//
// An approver on a wholesale account is told here, first, when orders are
// waiting for their approval (sparx persona issue 087): this is the page they
// land on, and it used to say nothing about it.

import Link from 'next/link';

import { ApprovalsSummary } from '@/components/account/approvals-summary';
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
