'use client';

// On the account overview, the first page an approver lands on: how many
// orders are waiting for their approval, on each wholesale account they
// approve for, with the way to them (sparx persona issue 087).
//
// Teodora signed in and read "Hi, Teodora", Continue shopping and Your cart.
// Nothing said an order was waiting for her; the list was two pages away, on
// her wholesale account. This reads the same list that page shows, once per
// account she approves for, and draws nothing for anyone who approves for none,
// or when nothing is waiting.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert, Button } from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { getAccountApprovals, getB2bAccounts } from '@/lib/customer-client';
import { waitingForYouSentence } from '@/lib/sign-off-words';

interface Waiting {
  accountId: string;
  companyName: string;
  count: number;
}

export function ApprovalsSummary() {
  const { tenantSlug, status, offers, customer } = useCustomer();
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const customerId = customer?.id ?? null;

  useEffect(() => {
    if (status !== 'authenticated' || !offers.b2b) {
      setWaiting([]);
      return;
    }
    let active = true;
    getB2bAccounts(tenantSlug)
      .then((accounts) =>
        Promise.all(
          accounts
            .filter((a) => a.role === 'approver')
            .map((a) =>
              getAccountApprovals(tenantSlug, a.accountId)
                .then((items) => ({
                  accountId: a.accountId,
                  companyName: a.companyName,
                  count: items.length,
                }))
                // One account that cannot be read must not hide the others.
                .catch(() => null)
            )
        )
      )
      .then((found) => {
        if (!active) return;
        setWaiting(found.filter((w): w is Waiting => w !== null && w.count > 0));
      })
      // Nothing is claimed when the accounts cannot be read: the wholesale
      // pages still list what is waiting.
      .catch(() => active && setWaiting([]));
    return () => {
      active = false;
    };
  }, [tenantSlug, status, offers.b2b, customerId]);

  if (waiting.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {waiting.map((w) => (
        <Alert key={w.accountId} color="warning">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span>{waitingForYouSentence(w.count, w.companyName)}</span>
            <Button render={<Link href={`/account/b2b/${w.accountId}`} />} color="primary">
              Review {w.count === 1 ? 'it' : 'them'}
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
}
