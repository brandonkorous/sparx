'use client';

// Everything she has asked to send back, newest first.
//
// Leads with WHOSE MOVE IT IS rather than with the stored status: "waiting for a
// decision" and "post it back to us" are a status and a task, and only one of
// them needs her to do something today.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { returnState, outcomeLabel } from '@/components/returns/return-status';
import { getReturns, type ReturnSummaryView } from '@/lib/customer-client';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReturnsPage() {
  const { tenantSlug } = useCustomer();
  const [returns, setReturns] = useState<ReturnSummaryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getReturns(tenantSlug)
      .then((r) => active && setReturns(r))
      .catch(() => active && setError('We could not load your returns just now.'));
    return () => {
      active = false;
    };
  }, [tenantSlug]);

  return (
    <div>
      <h1 className="text-base-content mb-5 text-3xl font-semibold tracking-tight">Returns</h1>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : returns === null ? (
        <div className="skeleton h-40" />
      ) : returns.length === 0 ? (
        <div className="card border-base-300 items-center border p-8 text-center">
          <p className="text-base-content mb-1 text-lg font-medium">
            You have not sent anything back
          </p>
          <p className="text-base-content mb-4">
            If something is not right, you can start a return from the order it came on.
          </p>
          <Button render={<Link href="/account/orders" />} color="primary">
            Go to your orders
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {returns.map((r) => {
            const state = returnState(r.status);
            return (
              <Link
                key={r.id}
                href={`/account/returns/${r.id}`}
                className="card border-base-300 flex-col gap-2 border px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <strong className="text-base-content">
                    {r.orderNumber ? `Order #${r.orderNumber}` : 'Your return'}
                  </strong>
                  <Badge color={state.tone} variant="soft">
                    {state.label}
                  </Badge>
                </div>
                <span className="text-base-content text-sm">
                  {state.hint} · {r.itemCount} {r.itemCount === 1 ? 'item' : 'items'} ·{' '}
                  {outcomeLabel(r.preferredOutcome)} · asked {formatDate(r.requestedAt)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
