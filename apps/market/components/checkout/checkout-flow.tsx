'use client';

// Multi-step marketplace checkout: Contact → Shipping → Payment → redirect to the
// order confirmation. Drives the market checkout API (single-merchant, via the
// /api/sparx proxy with ?merchant= + x-cart-token) and Stripe Elements on the
// PLATFORM account (merchant-of-record). The cart is loaded from localStorage by
// the page and handed in; on completion we route to /orders/[id]?merchant=.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Steps, Step, Alert, Button, Input } from 'silicaui-react';

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
import { formatCents } from '@/lib/format';
import type { Cart } from '@/lib/cart-client';

import { AddressForm, EMPTY_ADDRESS } from './address-form';
import { OrderSummary } from './order-summary';
import { PaymentStep } from './payment-step';
import { Field } from './ui';

type Step = 'contact' | 'shipping' | 'payment';
const STEP_LABELS = [{ label: 'Contact' }, { label: 'Shipping' }, { label: 'Payment' }];
const STEP_INDEX: Record<Step, number> = { contact: 0, shipping: 1, payment: 2 };

export function CheckoutFlow({ cart }: { cart: Cart }) {
  const router = useRouter();
  const { merchantSlug, token, cartId } = cart;

  const [step, setStep] = useState<Step>('contact');
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [chosenRate, setChosenRate] = useState<ShippingRate | null>(null);

  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Reuse an existing session, or start one. Both branches expose `sessionId`.
      const s = session ?? (await startCheckout(merchantSlug, token, cartId, email));
      const updated = await submitContact(merchantSlug, token, s.sessionId, {
        email,
        acceptsMarketing,
      });
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
        const quoted = await quoteShipping(merchantSlug, token, session.sessionId, {
          destinationCountry: address.country,
          destinationPostal: address.postalCode,
        });
        // Fall back to a single free standard option when the carrier engine has
        // no configured rates, so checkout still completes.
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
      const updated = await submitShipping(merchantSlug, token, session.sessionId, {
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

  function handlePaid(result: { orderId: string; orderNumber: string }) {
    // The cart is consumed; route to the public order confirmation. The order
    // view is scoped to the seller, so carry ?merchant=.
    router.replace(
      `/orders/${encodeURIComponent(result.orderId)}?merchant=${encodeURIComponent(merchantSlug)}`
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Steps>
          {STEP_LABELS.map((s, i) => (
            <Step key={s.label} color={i <= STEP_INDEX[step] ? 'primary' : undefined}>
              {s.label}
            </Step>
          ))}
        </Steps>

        {error ? (
          <Alert color="danger" variant="soft">
            {error}
          </Alert>
        ) : null}

        {step === 'contact' ? (
          <form onSubmit={handleContact} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Contact</h2>
            <Field label="Email">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                className="accent-[var(--sparx-primary)]"
                checked={acceptsMarketing}
                onChange={(e) => setAcceptsMarketing(e.target.checked)}
              />
              Email me with news and offers
            </label>
            <Button
              type="submit"
              color="primary"
              variant="solid"
              size="lg"
              disabled={busy}
              loading={busy}
            >
              {busy ? 'Saving…' : 'Continue to shipping'}
            </Button>
          </form>
        ) : null}

        {step === 'shipping' ? (
          <form onSubmit={handleShipping} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Shipping address
            </h2>
            <AddressForm value={address} onChange={setAddress} />

            {rates.length > 0 ? (
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-1 text-xs font-semibold tracking-[0.04em] text-[var(--color-text-secondary)] uppercase">
                  Shipping method
                </legend>
                {rates.map((rate) => {
                  const active = chosenRate?.rateRef === rate.rateRef;
                  return (
                    <label
                      key={rate.rateRef}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-3 text-sm transition-colors ${
                        active
                          ? 'border-[var(--sparx-primary)] bg-[color-mix(in_oklch,var(--sparx-primary)_6%,transparent)]'
                          : 'border-[var(--color-border-default)]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rate"
                        className="accent-[var(--sparx-primary)]"
                        checked={active}
                        onChange={() => setChosenRate(rate)}
                      />
                      <span className="flex-1">
                        <strong className="text-[var(--color-text-primary)]">{rate.service}</strong>
                        {rate.estimatedDays != null ? (
                          <span className="text-[var(--color-text-secondary)]">
                            {' '}
                            · {rate.estimatedDays} days
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[var(--color-text-primary)] tabular-nums">
                        {rate.amountCents === 0
                          ? 'Free'
                          : formatCents(rate.amountCents, session?.currency ?? cart.currency)}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ) : null}

            <div className="flex gap-3">
              <Button
                type="button"
                color="neutral"
                variant="ghost"
                onClick={() => setStep('contact')}
                disabled={busy}
              >
                ← Back
              </Button>
              <Button
                type="submit"
                color="primary"
                variant="solid"
                size="lg"
                className="flex-1"
                disabled={busy}
                loading={busy}
              >
                {busy
                  ? 'Loading…'
                  : rates.length === 0
                    ? 'Get shipping rates'
                    : 'Continue to payment'}
              </Button>
            </div>
          </form>
        ) : null}

        {step === 'payment' && session ? (
          <PaymentStep
            merchantSlug={merchantSlug}
            token={token}
            session={session}
            onBack={() => setStep('shipping')}
            onPaid={handlePaid}
            createIntent={() => createPaymentIntent(merchantSlug, token, session.sessionId)}
          />
        ) : null}
      </div>

      <OrderSummary
        items={cart.items}
        totals={session?.totals ?? cart.totals}
        currency={session?.currency ?? cart.currency}
        {...(session?.surchargeLabel ? { surchargeLabel: session.surchargeLabel } : {})}
      />
    </div>
  );
}
