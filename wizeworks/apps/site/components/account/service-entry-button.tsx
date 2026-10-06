'use client';

// The way into a wholesale account's Service page (sparx persona issue 086), beside
// Invoices, Orders and Quotes. Shown only when the business takes bookings: a shop
// without scheduling has no service to offer, so the account page shows no
// booking entry at all rather than a page that says so.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { loadAccountService } from '@/lib/fleet-service-client';

export function ServiceEntryButton({ accountId }: { accountId: string }) {
  const { tenantSlug, propertySlug } = useCustomer();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    loadAccountService(tenantSlug, accountId, propertySlug)
      .then((s) => active && setEnabled(s.enabled))
      // Not knowing is not offering: a failed read shows no entry.
      .catch(() => active && setEnabled(false));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId, propertySlug]);

  if (!enabled) return null;
  return (
    <Button
      render={<Link href={`/account/b2b/${encodeURIComponent(accountId)}/service`} />}
      color="primary"
      variant="outline"
    >
      Service
    </Button>
  );
}
