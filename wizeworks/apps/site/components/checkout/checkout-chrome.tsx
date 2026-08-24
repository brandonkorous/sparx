'use client';

// The parts of checkout that are not a step: the progress track, the empty
// cart, and the last screen anybody reads.

import Link from 'next/link';

import { Button, Step, Steps } from '@wizeworks/silicaui-react';

// Named CheckoutStep, not Step: silica's <Step> is the stepper node component.
export type CheckoutStep = 'contact' | 'shipping' | 'payment' | 'done';

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
}: {
  orderNumber: string;
  paymentMode?: 'card' | 'in_person' | 'unavailable';
  collecting: boolean;
}) {
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
      {collecting ? (
        <p className="text-base-content m-0">We&rsquo;ll let you know when it&rsquo;s ready.</p>
      ) : null}
      <Button render={<Link href="/products" />} color="primary" className="mt-2">
        Continue shopping
      </Button>
    </div>
  );
}
