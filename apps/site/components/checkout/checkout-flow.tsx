'use client';

// Multi-step checkout: Contact → Shipping → Payment → Confirmation.
// Drives the public checkout API and Stripe Elements. The cart's ownership
// token (x-cart-token) is sent by the checkout-client helpers.

import Link from 'next/link';
import { useState } from 'react';

import { SparxAlert, SparxButton, SparxInput } from '@sparx/site-ui';

import { formatMoney } from '@/lib/format';
import {
  createPaymentIntent,
  quoteShipping,
  startCheckout,
  submitContact,
  submitShipping,
  type Address,
  type CheckoutSession,
  type ShippingRate,
} from '@/lib/checkout-client';
import { useCart } from '../cart-provider';
import { AddressForm, EMPTY_ADDRESS } from './address-form';
import { PaymentStep } from './payment-step';
import { OrderSummary } from './order-summary';

type Step = 'contact' | 'shipping' | 'payment' | 'done';

export function CheckoutFlow({ tenantSlug }: { tenantSlug: string }) {
  const cart = useCart();
  const [step, setStep] = useState<Step>('contact');
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [chosenRate, setChosenRate] = useState<ShippingRate | null>(null);

  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const cartReady = cart.cartId !== null;
  const cartEmpty = cartReady && cart.lines.length === 0;

  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.cartId) return;
    setBusy(true);
    setError(null);
    try {
      const s = session ?? (await startCheckout(tenantSlug, cart.cartId, email));
      const updated = await submitContact(tenantSlug, s.sessionId, { email, acceptsMarketing });
      setSession(updated);
      setStep('shipping');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleShipping(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      // First submit: quote rates for the entered destination + require a pick.
      if (rates.length === 0) {
        const quoted = await quoteShipping(tenantSlug, session.sessionId, {
          destinationCountry: address.country,
          destinationPostal: address.postalCode,
        });
        // Fall back to a single free standard option when the carrier engine
        // has no configured rates yet, so checkout still completes.
        const options =
          quoted.length > 0
            ? quoted
            : [
                {
                  providerSlug: 'manual',
                  rateRef: 'standard',
                  service: 'Standard shipping',
                  carrier: 'Standard',
                  amountCents: 0,
                  estimatedDays: null,
                },
              ];
        setRates(options);
        setChosenRate(options[0] ?? null);
        setBusy(false);
        return;
      }

      const rate = chosenRate ?? rates[0]!;
      const updated = await submitShipping(tenantSlug, session.sessionId, {
        shippingAddress: address,
        shippingRateRef: rate.rateRef,
        shippingProviderSlug: rate.providerSlug,
      });
      setSession(updated);
      setStep('payment');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handlePaid(orderNum: string) {
    setOrderNumber(orderNum);
    setStep('done');
    cart.reset();
  }

  if (cartEmpty && step !== 'done') {
    return (
      <div className="st-empty" style={{ minHeight: '40vh' }}>
        <span className="st-empty__icon" aria-hidden="true">
          🛒
        </span>
        <h2 className="st-h2" style={{ color: 'var(--st-text)' }}>
          Your cart is empty
        </h2>
        <SparxButton asChild color="primary">
          <Link href="/products">Shop all products</Link>
        </SparxButton>
      </div>
    );
  }

  if (step === 'done' && orderNumber) {
    return <Confirmation orderNumber={orderNumber} />;
  }

  return (
    <div className="st-checkout">
      <div className="st-checkout__main">
        <StepIndicator step={step} />

        {error ? <SparxAlert color="danger">{error}</SparxAlert> : null}

        {step === 'contact' ? (
          <form onSubmit={handleContact} className="st-form">
            <h2 className="st-h2">Contact</h2>
            <label className="st-field">
              <span>Email</span>
              <SparxInput
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label className="st-check">
              <input
                type="checkbox"
                checked={acceptsMarketing}
                onChange={(e) => setAcceptsMarketing(e.target.checked)}
              />
              Email me with news and offers
            </label>
            <SparxButton type="submit" color="primary" size="lg" disabled={busy}>
              {busy ? 'Saving…' : 'Continue to shipping'}
            </SparxButton>
          </form>
        ) : null}

        {step === 'shipping' ? (
          <form onSubmit={handleShipping} className="st-form">
            <h2 className="st-h2">Shipping address</h2>
            <AddressForm value={address} onChange={setAddress} />

            {rates.length > 0 ? (
              <fieldset className="st-rates">
                <legend className="st-h3">Shipping method</legend>
                {rates.map((rate) => (
                  <label key={rate.rateRef} className="st-rate">
                    <input
                      type="radio"
                      name="rate"
                      checked={chosenRate?.rateRef === rate.rateRef}
                      onChange={() => setChosenRate(rate)}
                    />
                    <span style={{ flex: 1 }}>
                      <strong>{rate.service}</strong>
                      {rate.estimatedDays != null ? (
                        <span className="st-muted"> · {rate.estimatedDays} days</span>
                      ) : null}
                    </span>
                    <span>
                      {rate.amountCents === 0
                        ? 'Free'
                        : formatMoney(rate.amountCents, session?.currency ?? 'USD')}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <SparxButton
                type="button"
                color="neutral"
                variant="ghost"
                onClick={() => setStep('contact')}
              >
                ← Back
              </SparxButton>
              <SparxButton
                type="submit"
                color="primary"
                size="lg"
                style={{ flex: 1 }}
                disabled={busy}
              >
                {busy
                  ? 'Loading…'
                  : rates.length === 0
                    ? 'Get shipping rates'
                    : 'Continue to payment'}
              </SparxButton>
            </div>
          </form>
        ) : null}

        {step === 'payment' && session ? (
          <PaymentStep
            tenantSlug={tenantSlug}
            session={session}
            onBack={() => setStep('shipping')}
            onPaid={handlePaid}
            createIntent={() => createPaymentIntent(tenantSlug, session.sessionId)}
          />
        ) : null}
      </div>

      <aside className="st-checkout__aside">
        <OrderSummary
          lines={cart.lines}
          totals={session?.totals ?? cart.totals}
          currency={session?.currency ?? cart.currency}
          {...(session?.surchargeLabel ? { surchargeLabel: session.surchargeLabel } : {})}
        />
      </aside>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'contact', label: 'Contact' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'payment', label: 'Payment' },
  ];
  const order: Step[] = ['contact', 'shipping', 'payment', 'done'];
  const currentIdx = order.indexOf(step);
  return (
    <ol className="st-steps">
      {steps.map((s, i) => {
        const idx = order.indexOf(s.key);
        const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'todo';
        return (
          <li key={s.key} className="st-steps__item" data-state={state}>
            <span className="st-steps__dot">{state === 'done' ? '✓' : i + 1}</span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

function Confirmation({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="st-empty" style={{ minHeight: '50vh' }}>
      <span className="st-empty__icon" aria-hidden="true">
        🎉
      </span>
      <h1 className="st-h1" style={{ color: 'var(--st-text)' }}>
        Order confirmed
      </h1>
      <p style={{ margin: 0 }}>
        Thank you! Your order <strong>{orderNumber}</strong> has been placed. A confirmation email
        is on its way.
      </p>
      <SparxButton asChild color="primary">
        <Link href="/products" style={{ marginTop: '0.5rem' }}>
          Continue shopping
        </Link>
      </SparxButton>
    </div>
  );
}
