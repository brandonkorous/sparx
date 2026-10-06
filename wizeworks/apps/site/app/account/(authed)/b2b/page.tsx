'use client';

// Wholesale account entry point: lists the trade accounts the signed-in
// customer buys for. With exactly one, it goes straight to that account's
// dashboard. With none, it says so.
//
// The buyer never reads "B2B": that is the platform's word for the module, not
// the shop's word for the relationship (sparx persona issue 084).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import { getB2bAccounts, type B2bAccountEntry } from '@/lib/customer-client';
import { Alert, Badge } from '@wizeworks/silicaui-react';

function statusLabel(status: string): string {
  switch (status) {
    case 'credit_hold':
      return 'Credit hold';
    case 'suspended':
      return 'Suspended';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Active';
  }
}

/** Semantic tone for a trade account status. Inactive carries no color: it is
 *  a plain fact, not a warning about anything the buyer can act on. */
function accountStatusTone(status: string): 'warning' | 'danger' | 'success' | undefined {
  switch (status) {
    case 'credit_hold':
      return 'warning';
    case 'suspended':
      return 'danger';
    case 'inactive':
      return undefined;
    default:
      return 'success';
  }
}

export default function B2bPortalPage() {
  const { tenantSlug, status } = useCustomer();
  const router = useRouter();
  const [accounts, setAccounts] = useState<B2bAccountEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let active = true;
    getB2bAccounts(tenantSlug)
      .then((list) => {
        if (!active) return;
        if (list.length === 1 && list[0]) {
          router.replace(`/account/b2b/${list[0].accountId}`);
        } else {
          setAccounts(list);
        }
      })
      .catch(() => active && setError('Your wholesale accounts could not be loaded just now.'));
    return () => {
      active = false;
    };
  }, [tenantSlug, status, router]);

  if (error) {
    return (
      <Alert color="danger" role="alert">
        {error}
      </Alert>
    );
  }

  if (accounts === null) {
    return <div className="skeleton h-30" />;
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">
          Wholesale account
        </h1>
        <p className="text-base-content">
          Your sign-in is not linked to a wholesale account yet. Ask your sales representative to
          add you to your business&apos;s account, and its prices and payment terms appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-base-content text-3xl font-semibold tracking-tight">
        Wholesale accounts
      </h1>
      <div className="flex flex-col gap-3">
        {accounts.map((acct) => (
          <Link
            key={acct.accountId}
            href={`/account/b2b/${acct.accountId}`}
            className="card border-base-300 flex flex-row flex-wrap items-center justify-between gap-4 border px-5 py-4"
          >
            <div className="flex flex-col gap-1">
              <strong>{acct.companyName}</strong>
              <span className="text-base-content text-sm">{acct.role.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center gap-4">
              <Badge color={accountStatusTone(acct.status)} variant="soft">
                {statusLabel(acct.status)}
              </Badge>
              <span className="text-base-content text-sm whitespace-nowrap">
                ${acct.creditAvailable.toLocaleString()} available
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
