'use client';

// B2B portal entry point — lists the B2B accounts the signed-in customer has
// access to. If the customer has exactly one account, auto-redirects to that
// account's dashboard. If none, shows an informational message.

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

/** Semantic tone for a B2B account status. */
function accountStatusTone(status: string) {
  switch (status) {
    case 'credit_hold':
      return 'warning';
    case 'suspended':
      return 'danger';
    case 'inactive':
      return 'neutral';
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
      .catch(() => active && setError('Could not load your B2B accounts.'));
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
    return <div className="skeleton" style={{ height: 120 }} />;
  }

  if (accounts.length === 0) {
    return (
      <div>
        <h1
          className="text-base-content text-3xl font-semibold tracking-tight"
          style={{ marginBottom: '0.5rem' }}
        >
          B2B Account
        </h1>
        <p className="text-base-content" style={{ marginBottom: '1.5rem' }}>
          Your account doesn&apos;t have B2B access yet. Contact your sales representative to set up
          wholesale purchasing on your account.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1
        className="text-base-content text-3xl font-semibold tracking-tight"
        style={{ marginBottom: '1.25rem' }}
      >
        B2B Accounts
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {accounts.map((acct) => (
          <Link
            key={acct.accountId}
            href={`/account/b2b/${acct.accountId}`}
            className="card border-base-300 border"
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div>
              <strong>{acct.companyName}</strong>
              <div
                className="text-base-content"
                style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}
              >
                {acct.role.replace('_', ' ')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Badge color={accountStatusTone(acct.status)} variant="soft">
                {statusLabel(acct.status)}
              </Badge>
              <span
                className="text-base-content"
                style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                ${acct.creditAvailable.toLocaleString()} available
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
