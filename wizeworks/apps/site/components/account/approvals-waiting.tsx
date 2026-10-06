'use client';

// The orders on a trade account waiting for the signed-in approver's yes (sparx
// persona issue 087).
//
// Teodora's role on Wasatch's account read "Can approve orders", and nothing
// ever asked her to approve one: Renée's $1,208.00 order went to the business's
// team, and her account page had no word of it. When a spending limit is set to
// be signed off by the account's own approvers, the orders it holds are listed
// here, each with who placed it, when, what it comes to, the limit it went over
// and its PO number, and each opens to the order page where she approves it or
// turns it down.
//
// Only an approver is shown this, and only an approver's page asks for it: the
// server refuses every other role.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert, Button } from '@wizeworks/silicaui-react';

import { getAccountApprovals, type AccountApprovalItem } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { approvalItemFacts } from '@/lib/sign-off-words';

export function ApprovalsWaiting({
  tenantSlug,
  accountId,
}: {
  tenantSlug: string;
  accountId: string;
}) {
  const [items, setItems] = useState<AccountApprovalItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getAccountApprovals(tenantSlug, accountId)
      .then((list) => active && setItems(list))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId]);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="approvals-heading">
      <h2 id="approvals-heading" className="text-base-content text-xl font-semibold">
        Waiting for your approval
        {items && items.length > 0 ? ` (${items.length})` : ''}
      </h2>
      {failed ? (
        <Alert color="danger" role="alert">
          The orders waiting for your approval could not be loaded just now.
        </Alert>
      ) : items === null ? (
        <div className="skeleton h-20" />
      ) : items.length === 0 ? (
        <Alert color="success">
          Nothing is waiting for your approval. When someone on your account places an order over
          its spending limit, it shows here for you to approve or turn down.
        </Alert>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="card border-warning flex-row flex-wrap items-center justify-between gap-x-4 gap-y-3 border px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {/* An order number is one token: it must not break across lines. */}
                  <Link
                    href={`/account/b2b/${accountId}/orders/${item.id}`}
                    className="link link-primary font-semibold whitespace-nowrap"
                  >
                    {item.orderNumber}
                  </Link>
                  <strong className="text-lg whitespace-nowrap">
                    {formatMoney(item.totalCents, item.currency)}
                  </strong>
                </div>
                <ul className="text-base-content m-0 flex list-none flex-col gap-0.5 p-0 text-sm">
                  {approvalItemFacts(item).map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </div>
              <Button
                render={<Link href={`/account/b2b/${accountId}/orders/${item.id}`} />}
                color="primary"
              >
                Review
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
