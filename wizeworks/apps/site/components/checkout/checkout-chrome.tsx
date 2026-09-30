'use client';

// The parts of checkout that are not a step: the progress track, the empty
// cart, and the last screen anybody reads.

import Link from 'next/link';

import { Button, Step, Steps } from '@wizeworks/silicaui-react';

import { formatMoney } from '@/lib/format';
import { readyDayLabel, type StorefrontPaymentMode } from '@/lib/made-to-order-copy';
import type { Address, CheckoutMadeToOrder, ShippingRate } from '@/lib/checkout-client';
import type { CartLine, CartTotals } from '../cart-provider';
import { OrderSummary } from './order-summary';

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
    <div className="text-base-content grid min-h-[40vh] place-items-center gap-3 py-[clamp(3rem,8vw,6rem)] text-center">
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
  orderId,
  orderNumber,
  paymentMode = 'card',
  /** Nothing is being posted, so "we'll send it" would be the wrong promise. */
  collecting,
  madeToOrder,
  currency,
  lines,
  totals,
  rate,
  address,
  signedIn,
}: {
  /** The order's own id, for the link to it. `placeOrder` has always returned
   *  one; checkout used to drop it on the floor one line later. */
  orderId: string;
  orderNumber: string;
  paymentMode?: StorefrontPaymentMode;
  collecting: boolean;
  /** Made to order (issue 026) — the day it can be collected and what is still
   *  owing. This is the moment somebody most needs both, and it is the last
   *  screen before they close the tab. */
  madeToOrder?: CheckoutMadeToOrder;
  currency?: string;
  /** What was bought, taken before the cart is emptied. */
  lines: CartLine[];
  totals: CartTotals;
  /** How it is coming, and where. Null when it is being collected. */
  rate: ShippingRate | null;
  address: Address | null;
  /** Only a signed-in shopper has an order page to be sent to. */
  signedIn: boolean;
}) {
  const ready = madeToOrder?.readyOn ? readyDayLabel(madeToOrder.readyOn) : null;
  // "You paid X today" describes a CARD CHARGE. A shop on manual payments took
  // nothing — the sentence directly above says so in the same breath — and a
  // shop with no working gateway took nothing either, so on both the deposit
  // split is a receipt for a transaction that did not happen (issue 185). What
  // they need is the line they already get: keep this number, you pay on
  // collection. The whole amount is settled with the shop, so nothing is lost by
  // not splitting it, and a number nobody collected is never printed as money.
  const owing = paymentMode === 'card' && (madeToOrder?.balanceCents ?? 0) > 0;
  return (
    // No px-6. The checkout page already sets a 24px gutter, and adding a
    // second one here inset this screen twice as far as the four steps before
    // it — on a phone that is 48px of nothing down each side.
    <div className="text-base-content grid min-h-[50vh] place-items-center gap-3 py-[clamp(3rem,8vw,6rem)] text-center">
      <span className="text-[2.5rem] opacity-50" aria-hidden="true">
        🎉
      </span>
      <h1 className="text-base-content text-4xl font-semibold tracking-tight">Order confirmed</h1>
      <p className="text-base-content m-0">
        Thank you! Your order <strong>{orderNumber}</strong> has been placed.{' '}
        {paymentMode === 'in_person'
          ? collecting
            ? 'Keep this order number. You pay when you collect.'
            : 'Keep this order number: we’ll be in touch about paying.'
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

      {/* The receipt. This screen used to carry an order number and nothing
          else — not what was bought, not what it cost, not where it was going —
          and on a shop that takes money in person no email follows it either,
          so the number was the entire record of the sale. The same summary that
          stood beside every step stands under it now, so the last screen agrees
          with the four before it. */}
      <div className="mt-4 w-full max-w-[420px] text-left">
        <OrderSummary
          lines={lines}
          totals={totals}
          currency={currency ?? 'USD'}
          {...(madeToOrder ? { madeToOrder } : {})}
          paymentMode={paymentMode}
        />
      </div>

      {rate !== null || address !== null ? (
        <div className="text-base-content w-full max-w-[420px] text-left">
          {rate !== null ? (
            <p className="m-0">
              <strong>{collecting ? 'Collecting:' : 'Coming by:'}</strong> {rate.service}
              {rate.estimatedDays !== null ? ` · about ${String(rate.estimatedDays)} days` : ''}
            </p>
          ) : null}
          {address !== null ? (
            <p className="m-0">
              <strong>Going to:</strong> {addressLine(address)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {signedIn ? (
          <Button render={<Link href={`/account/orders/${orderId}`} />} color="primary">
            See your order
          </Button>
        ) : null}
        <Button
          render={<Link href="/products" />}
          {...(signedIn ? { variant: 'outline' as const } : { color: 'primary' as const })}
        >
          Continue shopping
        </Button>
      </div>
    </div>
  );
}

/** One line, the way an envelope reads. */
function addressLine(a: Address): string {
  return [a.name, a.line1, a.line2, [a.city, a.region, a.postalCode].filter(Boolean).join(' ')]
    .filter((part) => typeof part === 'string' && part.trim() !== '')
    .join(', ');
}
