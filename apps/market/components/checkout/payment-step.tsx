'use client';

// Payment step — Stripe Elements. sparx.market is MERCHANT-OF-RECORD: the charge
// runs through sparx's OWN (platform) Stripe account, not the seller's. So the
// publishable key here is sparx's PLATFORM key, read from
// NEXT_PUBLIC_MARKET_STRIPE_PUBLISHABLE_KEY (falling back to the shared
// NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY). The clientSecret still comes from the
// market checkout payment-intent endpoint, which creates the intent on the
// platform account.

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, Button } from '@wizeworks/silicaui-react';

import { formatCents } from '@/lib/format';
import {
  completeCheckout,
  submitPayment,
  type CheckoutSession,
  type PaymentIntentResult,
} from '@/lib/checkout-client';

const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MARKET_STRIPE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
  '';

// Memoize the Stripe.js loader across mounts (loadStripe should run once).
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  stripePromise ??= loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}

export interface PaymentStepProps {
  merchantSlug: string;
  token: string | null;
  session: CheckoutSession;
  createIntent: () => Promise<PaymentIntentResult>;
  onBack: () => void;
  onPaid: (result: { orderId: string; orderNumber: string }) => void;
}

export function PaymentStep({
  merchantSlug,
  token,
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

  if (!PUBLISHABLE_KEY) {
    return (
      <Alert color="danger" variant="soft">
        Payments aren’t configured for the marketplace yet (missing Stripe publishable key).
      </Alert>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
        <Button type="button" color="neutral" variant="ghost" onClick={onBack}>
          ← Back to shipping
        </Button>
      </div>
    );
  }

  if (!intent?.clientSecret) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base-content text-lg font-semibold">Payment</h2>
        <div className="text-base-content flex items-center gap-2 py-8 text-sm">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          Preparing secure payment…
        </div>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripe}
      options={{ clientSecret: intent.clientSecret, appearance: { theme: 'stripe' } }}
    >
      <PaymentInner
        merchantSlug={merchantSlug}
        token={token}
        session={session}
        providerSlug={intent.providerSlug}
        paymentRef={intent.paymentRef}
        onBack={onBack}
        onPaid={onPaid}
      />
    </Elements>
  );
}

function PaymentInner({
  merchantSlug,
  token,
  session,
  providerSlug,
  paymentRef,
  onBack,
  onPaid,
}: {
  merchantSlug: string;
  token: string | null;
  session: CheckoutSession;
  providerSlug: string;
  paymentRef: string;
  onBack: () => void;
  onPaid: (result: { orderId: string; orderNumber: string }) => void;
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
      // Record the confirmed payment on the session, then finalize the order. The
      // idempotency key is the payment ref so a double-submit can't double-place.
      await submitPayment(merchantSlug, token, session.sessionId, {
        paymentProviderSlug: providerSlug,
        paymentRef,
      });
      const result = await completeCheckout(merchantSlug, token, session.sessionId, paymentRef);
      onPaid(result);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={pay} className="flex flex-col gap-4">
      <h2 className="text-base-content text-lg font-semibold">Payment</h2>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error ? (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      ) : null}
      <div className="flex gap-3">
        <Button type="button" color="neutral" variant="ghost" onClick={onBack} disabled={busy}>
          ← Back
        </Button>
        <Button
          type="submit"
          color="primary"
          variant="solid"
          size="lg"
          className="flex-1"
          disabled={!stripe || busy}
          loading={busy}
        >
          {busy ? 'Processing…' : `Pay ${formatCents(session.totals.totalCents, session.currency)}`}
        </Button>
      </div>
    </form>
  );
}
