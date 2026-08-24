'use client';

// The parts of checkout that are not a step: the progress track, the empty
// cart, and the last screen anybody reads.

import Link from 'next/link';

import { Button, Step, Steps } from '@wizeworks/silicaui-react';

import { formatMoney } from '@/lib/format';
import type { CheckoutMadeToOrder } from '@/lib/checkout-client';

// Named CheckoutStep, not Step: silica's <Step> is the stepper node component.
export type CheckoutStep = 'contact' | 'shipping' | 'payment' | 'done';

/** A `YYYY-MM-DD` as a day a person recognises. Built from the parts rather
 *  than parsed as an instant — `new Date('2026-08-29')` is UTC midnight, which
 *  prints as the 28th anywhere west of Greenwich. */
function readyDayLabel(day: string): string | null {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return null;
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const ORDER: CheckoutStep[] = ['contact', 'shipping', 'payment', 'done'];

export function StepIndicator({
  step,
  /** The middle step is not always about shipping. A shop that hands orders
   *  over its counter has no delivery to name, and naming one anyway is what
   *  told a collecting customer to expect an address form (issue 064). */
  collectionOnly,
}: {
  step: CheckoutStep;
  collectionOnly: boolean;
}) {
  const steps: { key: CheckoutStep; label: string }[] = [
    { key: 'contact', label: 'Your details' },
    { key: 'shipping', label: collectionOnly ? 'Collection' : 'Delivery' },
    { key: 'payment', label: 'Payment' },
  ];
  const currentIdx = ORDER.indexOf(step);
  // silica's Steps track has no per-step `state`: a step is "reached" when it
  // carries a color, so coloring every step up to and including the current one
  // paints the track's filled portion. A cleared step swaps its number for a ✓.
  return (
    <Steps className="mb-6 w-full">
      {steps.map((s) => {
        const idx = ORDER.indexOf(s.key);
        const reached = idx <= currentIdx;
        const cleared = idx < currentIdx;
        return (
          <Step
            key={s.key}
            {...(reached ? { color: 'primary' as const } : {})}
            {...(cleared ? { 'data-content': '✓' } : {})}
          >
            {s.label}
          </Step>
        );
      })}
    </Steps>
  );
}

export function EmptyCart() {
  return (
    <div className="text-base-content grid min-h-[40vh] place-items-center gap-3 px-6 py-[clamp(3rem,8vw,6rem)] text-center">
      <span className="text-[2.5rem] opacity-50" aria-hidden="true">
        🛒
      </span>
      <h2 className="text-base-content text-3xl font-semibold tracking-tight">
        Your cart is empty
      </h2>
      <Button render={<Link href="/products" />} color="primary">
        Shop all products
      </Button>
    </div>
  );
}

/**
 * The last thing a customer reads, so every sentence in it has to be true.
 *
 * ── WHY THE EMAIL LINE IS CONDITIONAL ───────────────────────────────────────
 *
 * "A confirmation email is on its way" was unconditional, and for an order that
 * is not paid by card it was not true. The order-confirmation email is sent from
 * the PAYMENT WEBHOOK (`payment-webhook-reconcile.ts`), so an order that never
 * takes a card payment never triggers one — a shop on manual payments, a B2B
 * order billed to account, anything settled in person. The seeded automations
 * cover `order.paid`, `.delivered`, `.cancelled` and `.refunded`; there is no
 * `order.placed` one, deliberately, because order-confirmation is the payment's
 * counterpart.
 *
 * Whether that should change is a design decision about transactional email and
 * it is written up in the issue, not patched here — a naive `order.placed` rule
 * would send a card customer two. What is NOT a decision is telling somebody an
 * email is coming when we know none is.
 */
export function Confirmation({
  orderNumber,
  paymentMode,
  /** Nothing is being posted, so "we'll send it" would be the wrong promise. */
  collecting,
  madeToOrder,
  currency,
}: {
  orderNumber: string;
  paymentMode?: 'card' | 'in_person' | 'unavailable';
  collecting: boolean;
  /** Made to order (issue 026) — the day it can be collected and what is still
   *  owing. This is the moment somebody most needs both, and it is the last
   *  screen before they close the tab. */
  madeToOrder?: CheckoutMadeToOrder;
  currency?: string;
}) {
  const ready = madeToOrder?.readyOn ? readyDayLabel(madeToOrder.readyOn) : null;
  const owing = (madeToOrder?.balanceCents ?? 0) > 0;
  return (
    <div className="text-base-content grid min-h-[50vh] place-items-center gap-3 px-6 py-[clamp(3rem,8vw,6rem)] text-center">
      <span className="text-[2.5rem] opacity-50" aria-hidden="true">
        🎉
      </span>
      <h1 className="text-base-content text-4xl font-semibold tracking-tight">Order confirmed</h1>
      <p className="text-base-content m-0">
        Thank you! Your order <strong>{orderNumber}</strong> has been placed.{' '}
        {paymentMode === 'in_person'
          ? 'Keep this order number — you pay when you collect.'
          : 'A confirmation email is on its way.'}
      </p>
      {ready ? (
        <p className="text-base-content m-0 font-semibold">Ready from {ready}.</p>
      ) : collecting ? (
        <p className="text-base-content m-0">We&rsquo;ll let you know when it&rsquo;s ready.</p>
      ) : null}
      {owing && madeToOrder ? (
        <p className="text-base-content m-0">
          You paid {formatMoney(madeToOrder.dueNowCents, currency)} today.{' '}
          {formatMoney(madeToOrder.balanceCents, currency)} is due when you collect.
        </p>
      ) : null}
      <Button render={<Link href="/products" />} color="primary" className="mt-2">
        Continue shopping
      </Button>
    </div>
  );
}
