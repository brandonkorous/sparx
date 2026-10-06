'use client';

// Repeat orders: what is coming again, when, and the four things a customer can
// do about it (issue 739).
//
// Checkout promises "pause, skip or cancel any time from your account". Before
// this page the account could only switch which card paid, so that promise had
// nowhere to be kept and the only way out of a repeat delivery was asking the
// shop. Each action here is one press, refused by the API unless the repeat
// order is this customer's, and canceling asks once more because it cannot be
// undone from here.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cadenceWords } from '@wizeworks/commerce-schemas';
import { Alert, Badge, Button } from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { REPEAT_AMOUNT_EXTRA } from '@/lib/repeat-copy';
import {
  changeMySubscription,
  getMySubscriptions,
  type MySubscription,
} from '@/lib/customer-client';

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

/** "every month" from a stored cadence. Weeks and months come from the cadence
 *  words every other screen uses; anything else (a repeat the shop set up by
 *  hand) is still said in words. */
function howOften(sub: MySubscription): string {
  if (sub.intervalUnit === 'week' || sub.intervalUnit === 'month') {
    return cadenceWords({ intervalUnit: sub.intervalUnit, intervalCount: sub.intervalCount });
  }
  return sub.intervalCount === 1
    ? `every ${sub.intervalUnit}`
    : `every ${String(sub.intervalCount)} ${sub.intervalUnit}s`;
}

function whatIsInIt(sub: MySubscription): string {
  const lines = sub.lines ?? [];
  if (lines.length === 0) {
    return sub.itemCount === 1 ? '1 thing' : `${String(sub.itemCount)} things`;
  }
  return lines
    .map(
      (line) =>
        `${line.quantity > 1 ? `${String(line.quantity)} × ` : ''}${line.name}${
          line.variantTitle ? ` (${line.variantTitle})` : ''
        }`
    )
    .join(', ');
}

function howPaid(sub: MySubscription): string {
  if (sub.billingMode === 'invoice') return 'We email you a link to pay each time.';
  const card = sub.card;
  if (!card) return 'Charged automatically.';
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card';
  return card.last4
    ? `Charged automatically to ${brand} ending ${card.last4}.`
    : `Charged automatically to ${brand}.`;
}

const STATE: Record<string, { label: string; color: 'success' | 'warning' | 'danger' | 'info' }> = {
  active: { label: 'Running', color: 'success' },
  trialing: { label: 'Running', color: 'success' },
  paused: { label: 'Paused', color: 'warning' },
  past_due: { label: 'Payment needed', color: 'danger' },
  cancelled: { label: 'Canceled', color: 'info' },
};

export default function RepeatOrdersPage() {
  const { tenantSlug } = useCustomer();
  const [subscriptions, setSubscriptions] = useState<MySubscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<string | null>(null);

  const load = useCallback(() => {
    getMySubscriptions(tenantSlug)
      .then(setSubscriptions)
      .catch(() => {
        setError('Could not load your repeat orders.');
        setSubscriptions([]);
      });
  }, [tenantSlug]);

  useEffect(load, [load]);

  async function act(sub: MySubscription, action: 'pause' | 'resume' | 'skip' | 'cancel') {
    setError(null);
    setWorking(`${sub.id}:${action}`);
    try {
      await changeMySubscription(tenantSlug, sub.id, action);
      setConfirmingCancel(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that repeat order.');
    } finally {
      setWorking(null);
    }
  }

  const running = (subscriptions ?? []).filter((s) => s.status !== 'cancelled');
  const ended = (subscriptions ?? []).filter((s) => s.status === 'cancelled');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Repeat orders</h1>
        <p className="text-md">
          Things you have delivered again on a schedule. Pause one while you are away, skip the next
          delivery, or cancel it. Nothing more is sent or charged once it is canceled.
        </p>
      </div>

      {error ? (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      ) : null}

      {subscriptions === null ? (
        <p>Loading…</p>
      ) : running.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p>You have no repeat orders running.</p>
          <p>
            To start one, choose how often on a product that offers it, then check out as usual.{' '}
            <Link href="/products">Browse products</Link>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {running.map((sub) => {
            const state = STATE[sub.status] ?? { label: sub.status, color: 'info' as const };
            const busy = working?.startsWith(`${sub.id}:`) ?? false;
            const live = sub.status === 'active' || sub.status === 'trialing';
            return (
              <div
                key={sub.id}
                className="border-base-300 flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{whatIsInIt(sub)}</span>
                    <span>
                      {money(sub.cycleAmountCents, sub.currency)} {howOften(sub)},{' '}
                      {REPEAT_AMOUNT_EXTRA}
                    </span>
                    <span>
                      {sub.status === 'paused'
                        ? 'Paused. Nothing is sent until you resume it.'
                        : sub.nextOccurrenceAt
                          ? `Next delivery ${new Date(sub.nextOccurrenceAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
                          : 'No delivery scheduled.'}
                    </span>
                    <span>{howPaid(sub)}</span>
                  </div>
                  <Badge color={state.color} variant="soft">
                    {state.label}
                  </Badge>
                </div>

                {confirmingCancel === sub.id ? (
                  <Alert color="warning" variant="soft">
                    <div className="flex flex-col gap-3">
                      <span>
                        Cancel this repeat order? Nothing more will be sent or charged. To get it
                        again you would set it up from the product.
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          color="danger"
                          size="sm"
                          loading={working === `${sub.id}:cancel`}
                          onClick={() => void act(sub, 'cancel')}
                        >
                          Yes, cancel it
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setConfirmingCancel(null);
                          }}
                        >
                          Keep it
                        </Button>
                      </div>
                    </div>
                  </Alert>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {live ? (
                      <Button
                        size="sm"
                        color="primary"
                        variant="outline"
                        loading={working === `${sub.id}:skip`}
                        disabled={busy}
                        onClick={() => void act(sub, 'skip')}
                      >
                        Skip the next one
                      </Button>
                    ) : null}
                    {live ? (
                      <Button
                        size="sm"
                        color="warning"
                        variant="outline"
                        loading={working === `${sub.id}:pause`}
                        disabled={busy}
                        onClick={() => void act(sub, 'pause')}
                      >
                        Pause
                      </Button>
                    ) : null}
                    {sub.status === 'paused' ? (
                      <Button
                        size="sm"
                        color="success"
                        loading={working === `${sub.id}:resume`}
                        disabled={busy}
                        onClick={() => void act(sub, 'resume')}
                      >
                        Resume
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      color="danger"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setConfirmingCancel(sub.id);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {ended.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Canceled</h2>
          {ended.map((sub) => (
            <div key={sub.id} className="border-base-300 flex flex-col gap-1 rounded-lg border p-4">
              <span className="font-medium">{whatIsInIt(sub)}</span>
              <span>
                Was {money(sub.cycleAmountCents, sub.currency)} {howOften(sub)},{' '}
                {REPEAT_AMOUNT_EXTRA}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
