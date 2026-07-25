'use client';

// Account overview — greeting + quick links. Order history, addresses, and
// profile editing land as their own pages in the next slice; this is the hub.

import Link from 'next/link';

import { useCustomer } from '@/components/customer-provider';

export default function AccountOverviewPage() {
  const { customer } = useCustomer();
  const name = customer?.firstName ?? null;

  return (
    <div>
      <h1
        className="text-base-content text-3xl font-semibold tracking-tight"
        style={{ marginBottom: '0.5rem' }}
      >
        {name ? `Hi, ${name}` : 'Your account'}
      </h1>
      <p className="text-base-content" style={{ marginBottom: '1.75rem' }}>
        Manage your orders and details here.
      </p>

      <div
        className="grid gap-[clamp(1rem,2vw,1.75rem)]"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      >
        <Link
          href="/products"
          className="card border-base-300 border"
          style={{ padding: '1.25rem', display: 'block' }}
        >
          <strong>Continue shopping</strong>
          <p className="text-base-content" style={{ marginTop: '0.35rem' }}>
            Browse the full catalog.
          </p>
        </Link>
        <Link
          href="/cart"
          className="card border-base-300 border"
          style={{ padding: '1.25rem', display: 'block' }}
        >
          <strong>Your cart</strong>
          <p className="text-base-content" style={{ marginTop: '0.35rem' }}>
            Review items and check out.
          </p>
        </Link>
      </div>
    </div>
  );
}
