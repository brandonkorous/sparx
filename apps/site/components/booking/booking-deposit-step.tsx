'use client';

// Booking deposit / card-hold step (docs/79 §9). Shown after a booking is created
// for a service whose policy requires payment: mounts the Stripe Payment Element
// with the clientSecret the booking API returned and confirms in-browser. Mirrors
// the storefront checkout's payment step — a card hold authorizes (manual capture,
// charged only on a no-show/late cancel), a deposit/prepay charges immediately.
//
// Publishable key: the booking API's own `deposit.publishableKey` when the tenant runs
// its own Stripe account (`stripe_direct` — the intent lives there, so only that
// account's key can confirm it), else sparx's build-time platform key, which is the
// right one for sparx Pay. Same resolution as the checkout payment step.

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useMemo, useState } from 'react';

import { Alert, Button } from '@wizeworks/silicaui-react';

import type { DepositType } from '../../lib/scheduling-client';

const PLATFORM_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

// loadStripe should run once per account across mounts — keyed so two tenants on
// different Stripe accounts can't be handed each other's publishable key.
const stripePromises = new Map<string, Promise<Stripe | null>>();
function getStripe(publishableKey: string): Promise<Stripe | null> {
  let promise = stripePromises.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripePromises.set(publishableKey, promise);
  }
  return promise;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const INTRO: Record<DepositType, string> = {
  card_hold: 'requires a card on file',
  deposit: 'requires a deposit of',
  prepay: 'is prepaid',
};

export interface BookingDepositStepProps {
  clientSecret: string;
  /** The tenant's own Stripe publishable key, when the deposit intent is on their
   *  account rather than sparx's. Falls back to the platform key when absent. */
  publishableKey?: string;
  amountCents: number;
  type: DepositType;
  serviceName: string;
  onPaid: () => void;
}

export function BookingDepositStep({
  clientSecret,
  publishableKey,
  amountCents,
  type,
  serviceName,
  onPaid,
}: BookingDepositStepProps) {
  const key = publishableKey ?? PLATFORM_PUBLISHABLE_KEY;
  const stripe = useMemo(() => (key ? getStripe(key) : null), [key]);

  if (!stripe) {
    return (
      <Alert color="danger">
        Payments aren’t configured for this site yet (missing Stripe publishable key).
      </Alert>
    );
  }

  return (
    <Elements stripe={stripe} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <DepositInner
        amountCents={amountCents}
        type={type}
        serviceName={serviceName}
        onPaid={onPaid}
      />
    </Elements>
  );
}

function DepositInner({
  amountCents,
  type,
  serviceName,
  onPaid,
}: Omit<BookingDepositStepProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    // A card hold authorizes (manual capture); a deposit/prepay charges. Either way
    // confirmPayment resolves without redirect for a card; the booking's
    // depositStatus is tracked server-side (creation + webhook).
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    if (confirmError) {
      setError(confirmError.message ?? 'Payment could not be processed.');
      setBusy(false);
      return;
    }
    onPaid();
  }

  const verb = type === 'card_hold' ? 'Authorize' : 'Pay';
  const lead =
    type === 'card_hold'
      ? `${serviceName} ${INTRO.card_hold} — a hold of ${money(amountCents)}, charged only if you miss the appointment or cancel late.`
      : type === 'deposit'
        ? `${serviceName} ${INTRO.deposit} ${money(amountCents)}.`
        : `${serviceName} ${INTRO.prepay} — ${money(amountCents)}.`;

  return (
    <form onSubmit={confirm} className="st-card st-booking__deposit" style={{ padding: '1rem' }}>
      <h2 className="st-h3">Secure your booking</h2>
      <p className="st-muted">{lead}</p>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error ? <Alert color="danger">{error}</Alert> : null}
      <Button type="submit" color="primary" disabled={!stripe || busy}>
        {busy ? 'Processing…' : `${verb} ${money(amountCents)}`}
      </Button>
    </form>
  );
}
