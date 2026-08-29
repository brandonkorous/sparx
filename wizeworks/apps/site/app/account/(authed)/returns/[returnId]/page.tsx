'use client';

// One return: where it has got to, what is on it, and what came back.
//
// The money block only appears once money has actually moved. A refund line
// reading $0.00 before anyone has settled anything would be a number nobody
// measured presented as one.

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { returnState, outcomeAsked } from '@/components/returns/return-status';
import {
  getReturn,
  AccountError,
  RETURN_REASONS,
  type ReturnDetailView,
} from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Her own reason, in the words she picked it by. Falls back to the stored code
 *  made readable rather than to nothing. */
function reasonLabel(code: string): string {
  return RETURN_REASONS.find((r) => r.code === code)?.label ?? code.replace(/_/g, ' ');
}

export default function ReturnDetailPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ returnId: string }>();
  const [detail, setDetail] = useState<ReturnDetailView | null>(null);
  const [error, setError] = useState<'missing' | 'error' | null>(null);

  useEffect(() => {
    let active = true;
    getReturn(tenantSlug, params.returnId)
      .then((r) => active && setDetail(r))
      .catch((err) =>
        active
          ? setError(err instanceof AccountError && err.status === 404 ? 'missing' : 'error')
          : null
      );
    return () => {
      active = false;
    };
  }, [tenantSlug, params.returnId]);

  if (error) {
    return (
      <div>
        <Alert color={error === 'missing' ? 'info' : 'danger'} role="alert">
          {error === 'missing'
            ? 'We could not find that return. It may have been removed, or the address may point at something that is not yours.'
            : 'We could not load this return just now.'}
        </Alert>
        <Button render={<Link href="/account/returns" />} className="mt-4">
          ← Back to your returns
        </Button>
      </div>
    );
  }
  if (!detail) return <div className="skeleton h-80" />;

  const state = returnState(detail.status);
  const tracking = detail.labels.find((l) => l.trackingNumber ?? l.trackingUrl);
  const moneyMoved = detail.refundedAmountCents !== null && detail.refundedAmountCents > 0;

  return (
    <div>
      <Link href="/account/returns" className="link link-hover text-sm">
        ← Returns
      </Link>
      <div className="mt-2 mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">
          {detail.orderNumber ? `Return from #${detail.orderNumber}` : 'Your return'}
        </h1>
        <Badge color={state.tone} variant="soft">
          {state.label}
        </Badge>
      </div>
      <p className="text-base-content mb-6">
        {state.hint} · You asked for {outcomeAsked(detail.preferredOutcome)} on{' '}
        {formatDate(detail.requestedAt)}.
      </p>

      {/* A refusal must never be a dead end — `deny` records the shop's reason and
          this is the only place she can read it. */}
      {detail.declinedReason ? (
        <Alert color="danger" className="mb-6">
          <span>
            <strong>What we said:</strong> {detail.declinedReason}
          </span>
        </Alert>
      ) : null}

      {state.actionNeeded ? (
        <Alert color="warning" className="mb-6">
          <span>
            Post the items back to us when you can.
            {tracking?.trackingNumber ? ` Your tracking number is ${tracking.trackingNumber}.` : ''}
          </span>
        </Alert>
      ) : null}

      {tracking?.trackingUrl ? (
        <p className="mb-6">
          <a
            href={tracking.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link text-primary font-semibold"
          >
            Track your return
          </a>
        </p>
      ) : null}

      <h2 className="text-base-content mb-3 text-2xl font-semibold">What you sent back</h2>
      <div className="mb-6 flex flex-col gap-3">
        {detail.items.map((it) => (
          <div key={it.id} className="card border-base-300 flex-col gap-1 border px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <strong className="text-base-content">{it.orderItemName ?? 'Item'}</strong>
              <span className="text-base-content text-sm">
                {it.quantity} {it.quantity === 1 ? 'item' : 'items'}
                {/* Only worth saying once they have actually decided a number, and
                    only when it differs from what she asked for. */}
                {it.approvedQuantity > 0 && it.approvedQuantity !== it.quantity
                  ? ` · ${it.approvedQuantity} agreed`
                  : ''}
              </span>
            </div>
            <span className="text-base-content text-sm">{reasonLabel(it.reasonCode)}</span>
            {it.customerNote ? (
              <span className="text-base-content text-sm">“{it.customerNote}”</span>
            ) : null}
          </div>
        ))}
      </div>

      {moneyMoved ? (
        <div className="rounded-box border-base-300 bg-base-100 ml-auto flex max-w-sm flex-col gap-3 border p-6">
          {detail.restockingFeeCents !== null && detail.restockingFeeCents > 0 ? (
            <div className="text-base-content flex justify-between text-sm">
              <span>Restocking fee</span>
              <span>−{formatMoney(detail.restockingFeeCents, 'USD')}</span>
            </div>
          ) : null}
          <div className="text-base-content flex justify-between text-lg font-semibold">
            <span>Refunded to you</span>
            <span>{formatMoney(detail.refundedAmountCents ?? 0, 'USD')}</span>
          </div>
          {detail.refundedAt ? (
            <span className="text-base-content text-sm">
              Sent back {formatDate(detail.refundedAt)}
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="text-base-content mt-8 text-sm">
        Our{' '}
        <Link href="/returns-policy" className="link">
          returns policy
        </Link>{' '}
        explains what we can take back and how long you have.
      </p>
    </div>
  );
}
