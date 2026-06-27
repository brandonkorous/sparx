'use client';

// Payment step — Stripe Elements. Creates a PaymentIntent via the public
// checkout API (which delegates to the merchant's Stripe account through the
// provider layer), mounts the Payment Element with the returned clientSecret,
// confirms in-browser, then records the payment ref + completes the order.
//
// Publishable key comes from NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useEffect, useMemo, useState } from 'react';

import { SparxAlert, SparxButton } from '@sparx/site-ui';

import { formatMoney } from '@/lib/format';
import {
  completeCheckout,
  submitPayment,
  type CheckoutSession,
  type PaymentIntentResult,
} from '@/lib/checkout-client';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

// Memoize the Stripe.js loader across mounts (loadStripe should run once).
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  stripePromise ??= loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}

export interface PaymentStepProps {
  tenantSlug: string;
  session: CheckoutSession;
  createIntent: () => Promise<PaymentIntentResult>;
  onBack: () => void;
  onPaid: (orderNumber: string) => void;
}

export function PaymentStep({
  tenantSlug,
  session,
  createIntent,
  onBack,
  onPaid,
}: PaymentStepProps) {
  const [intent, setIntent] = useState<PaymentIntentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createIntent()
      .then((res) => {
        if (!cancelled) setIntent(res);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
    // createIntent identity is stable per session in the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stripe = useMemo(() => getStripe(), []);

  if (error) {
    return (
      <div className="st-form">
        <SparxAlert color="danger">{error}</SparxAlert>
        <SparxButton type="button" color="neutral" variant="ghost" onClick={onBack}>
          ← Back to shipping
        </SparxButton>
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="st-form">
        <h2 className="st-h2">Payment</h2>
        <div className="st-skeleton" style={{ height: 180 }} />
      </div>
    );
  }

  // Hosted-redirect gateways (Square / Authorize.net / 1stPay / custom, docs/111 D4):
  // the shopper pays on the vendor's own page. No Stripe key / Elements involved.
  if (intent.redirectUrl) {
    return <RedirectPay intent={intent} session={session} onBack={onBack} />;
  }

  if (!PUBLISHABLE_KEY) {
    return (
      <SparxAlert color="danger">
        Payments aren’t configured for this store yet (missing Stripe publishable key).
      </SparxAlert>
    );
  }

  if (!intent.clientSecret) {
    return (
      <div className="st-form">
        <h2 className="st-h2">Payment</h2>
        <div className="st-skeleton" style={{ height: 180 }} />
      </div>
    );
  }

  return (
    <Elements
      stripe={stripe}
      options={{ clientSecret: intent.clientSecret, appearance: { theme: 'stripe' } }}
    >
      <PaymentInner
        tenantSlug={tenantSlug}
        session={session}
        providerSlug={intent.providerSlug}
        paymentRef={intent.paymentRef}
        onBack={onBack}
        onPaid={onPaid}
      />
    </Elements>
  );
}

// Hosted-redirect handoff: send the shopper to the vendor's hosted payment page. Most
// gateways take a plain GET redirect; Authorize.net Accept Hosted needs a form POST of
// the token (carried in `clientSecret`). The order is reconciled by the gateway webhook
// + completed on return (docs/111 §4 — exercised per-vendor at go-live).
function RedirectPay({
  intent,
  session,
  onBack,
}: {
  intent: PaymentIntentResult;
  session: CheckoutSession;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);

  function go() {
    if (!intent.redirectUrl) return;
    setBusy(true);
    if (intent.clientSecret) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = intent.redirectUrl;
      const field = document.createElement('input');
      field.type = 'hidden';
      field.name = 'token';
      field.value = intent.clientSecret;
      form.appendChild(field);
      document.body.appendChild(form);
      form.submit();
      return;
    }
    window.location.href = intent.redirectUrl;
  }

  return (
    <div className="st-form">
      <h2 className="st-h2">Payment</h2>
      <SparxAlert color="info">
        You’ll finish paying securely on your payment provider’s page, then return here.
      </SparxAlert>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <SparxButton type="button" color="neutral" variant="ghost" onClick={onBack} disabled={busy}>
          ← Back
        </SparxButton>
        <SparxButton
          type="button"
          color="primary"
          size="lg"
          style={{ flex: 1 }}
          onClick={go}
          disabled={busy}
        >
          {busy
            ? 'Redirecting…'
            : `Continue to pay ${formatMoney(session.totals.totalCents, session.currency)}`}
        </SparxButton>
      </div>
    </div>
  );
}

function PaymentInner({
  tenantSlug,
  session,
  providerSlug,
  paymentRef,
  onBack,
  onPaid,
}: {
  tenantSlug: string;
  session: CheckoutSession;
  providerSlug: string;
  paymentRef: string;
  onBack: () => void;
  onPaid: (orderNumber: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    try {
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (confirmError) {
        setError(confirmError.message ?? 'Payment could not be processed.');
        setBusy(false);
        return;
      }
      // Record the confirmed payment on the session, then finalize the order.
      await submitPayment(tenantSlug, session.sessionId, {
        paymentProviderSlug: providerSlug,
        paymentRef,
      });
      const result = await completeCheckout(tenantSlug, session.sessionId, paymentRef);
      onPaid(result.orderNumber);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={pay} className="st-form">
      <h2 className="st-h2">Payment</h2>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error ? <SparxAlert color="danger">{error}</SparxAlert> : null}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <SparxButton type="button" color="neutral" variant="ghost" onClick={onBack} disabled={busy}>
          ← Back
        </SparxButton>
        <SparxButton
          type="submit"
          color="primary"
          size="lg"
          style={{ flex: 1 }}
          disabled={!stripe || busy}
        >
          {busy ? 'Processing…' : `Pay ${formatMoney(session.totals.totalCents, session.currency)}`}
        </SparxButton>
      </div>
    </form>
  );
}
