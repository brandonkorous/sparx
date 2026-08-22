'use client';

// Payment step — Stripe Elements. Creates a PaymentIntent via the public
// checkout API (which delegates to the merchant's Stripe account through the
// provider layer), mounts the Payment Element with the returned clientSecret,
// confirms in-browser, then records the payment ref + completes the order.
//
// Publishable key comes from NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useEffect, useMemo, useState } from 'react';

import { Alert, Button, Input, NativeSelect } from '@wizeworks/silicaui-react';

import { formatMoney } from '@/lib/format';
import { getStripe, PLATFORM_PUBLISHABLE_KEY } from '@/lib/stripe-loader';
import {
  completeCheckout,
  submitPayment,
  type CheckoutSession,
  type PaymentIntentResult,
} from '@/lib/checkout-client';

const NET_TERMS_OPTIONS = [
  { value: 'net15', label: 'Net 15' },
  { value: 'net30', label: 'Net 30' },
  { value: 'net60', label: 'Net 60' },
  { value: 'net90', label: 'Net 90' },
] as const;

export interface PaymentStepProps {
  tenantSlug: string;
  session: CheckoutSession;
  createIntent: () => Promise<PaymentIntentResult>;
  onBack: () => void;
  onPaid: (orderNumber: string) => void;
}

// Top-level payment step. A signed-in B2B customer (session.companyId
// present — resolved server-side from their ACTIVE contact membership, never
// client-supplied) gets a choice between paying now by card and billing to
// their account on net terms; everyone else goes straight to card, unchanged
// from before this existed.
export function PaymentStep(props: PaymentStepProps) {
  const { session } = props;

  // The shop takes payment itself — over the counter, on collection, by
  // arrangement. There is no card form to draw and nothing to charge, so this
  // branch comes first: a business on manual payments is not a B2B question and
  // not a card question.
  //
  // It used to be neither, which meant it was a card question by default: the
  // step always created an intent, so a shop that chose "Manual payments" in the
  // picker had a checkout that stopped dead at the last step. The server has
  // always been able to place the order (a manual order settles outside the
  // platform, exactly like net terms) — the storefront simply never asked.
  if (session.paymentMode === 'in_person') {
    return <InPersonPaymentStep {...props} />;
  }
  // A prepay-designated account has no net-terms entitlement — go straight
  // to card, same as a non-B2B shopper (server-side submitPayment() also
  // rejects a net-terms request from a prepay account either way).
  const netTermsEligible =
    Boolean(session.companyId) && session.b2bAccountPaymentTerms !== 'prepay';
  const [method, setMethod] = useState<'choose' | 'card' | 'account'>(
    netTermsEligible ? 'choose' : 'card'
  );

  if (method === 'choose') {
    return (
      <div className="flex max-w-[560px] flex-col gap-4">
        <h2 className="text-base-content text-3xl font-semibold tracking-tight">Payment</h2>
        <div className="flex flex-col gap-3">
          <Button type="button" color="primary" size="lg" onClick={() => setMethod('card')}>
            Pay by card
          </Button>
          <Button
            type="button"
            color="neutral"
            variant="soft"
            size="lg"
            onClick={() => setMethod('account')}
          >
            Bill to my account (net terms)
          </Button>
        </div>
        <Button type="button" color="neutral" variant="ghost" onClick={props.onBack}>
          ← Back
        </Button>
      </div>
    );
  }

  if (method === 'account') {
    return <AccountPaymentStep {...props} onBack={() => setMethod('choose')} />;
  }

  return (
    <CardPaymentStep
      {...props}
      onBack={netTermsEligible ? () => setMethod('choose') : props.onBack}
    />
  );
}

// A B2B customer requesting terms instead of a card — skips the payment
// gateway entirely. Backed by the same submitPayment()/completeCheckout()
// calls the card flow uses; the service layer enforces this is only reachable
// for an active B2B account (checkout-service.ts submitPayment()).
/**
 * Paying the shop directly.
 *
 * No card fields, no gateway, nothing to confirm — the order is placed and the
 * money changes hands where the goods do. The one thing this screen owes the
 * customer is to be unambiguous that they have NOT paid yet, because every other
 * checkout they have ever used took the money at this point.
 */
function InPersonPaymentStep({ session, onBack, onPaid, tenantSlug }: PaymentStepProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Nothing is sent about HOW it will be paid. The server reads that from
      // the shop's own configuration, so a caller cannot declare itself paid in
      // person at a shop that expects a card.
      await submitPayment(tenantSlug, session.sessionId, {});
      const result = await completeCheckout(tenantSlug, session.sessionId, crypto.randomUUID());
      onPaid(result.orderNumber);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-[560px] flex-col gap-4">
      <h2 className="text-base-content text-3xl font-semibold tracking-tight">
        How you&rsquo;ll pay
      </h2>
      <Alert color="info">
        You pay when you collect. Placing this order does not take any money now, and no card
        details are needed.
      </Alert>
      {error ? <Alert color="danger">{error}</Alert> : null}
      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
          &larr; Back
        </Button>
        <Button type="submit" color="primary" size="lg" className="flex-1" disabled={busy}>
          {busy
            ? 'Placing order…'
            : `Place order — ${formatMoney(session.totals.totalCents, session.currency)} to pay`}
        </Button>
      </div>
    </form>
  );
}

function AccountPaymentStep({ session, onBack, onPaid, tenantSlug }: PaymentStepProps) {
  const [poNumber, setPoNumber] = useState('');
  const [terms, setTerms] = useState<string>('net30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitPayment(tenantSlug, session.sessionId, {
        paymentTermsRequested: terms,
        ...(poNumber.trim() ? { poNumber: poNumber.trim() } : {}),
      });
      const result = await completeCheckout(tenantSlug, session.sessionId, crypto.randomUUID());
      onPaid(result.orderNumber);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-[560px] flex-col gap-4">
      <h2 className="text-base-content text-3xl font-semibold tracking-tight">Bill to account</h2>
      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">PO number (optional)</span>
        <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">Payment terms</span>
        <NativeSelect value={terms} onChange={(e) => setTerms(e.target.value)}>
          {NET_TERMS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </label>
      {error ? <Alert color="danger">{error}</Alert> : null}
      <div className="flex gap-3">
        <Button type="button" color="neutral" variant="ghost" onClick={onBack} disabled={busy}>
          ← Back
        </Button>
        <Button type="submit" color="primary" size="lg" className="flex-1" disabled={busy}>
          {busy
            ? 'Placing order…'
            : `Place order — ${formatMoney(session.totals.totalCents, session.currency)}`}
        </Button>
      </div>
    </form>
  );
}

function CardPaymentStep({ tenantSlug, session, createIntent, onBack, onPaid }: PaymentStepProps) {
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

  // The merchant's own key when the gateway sent one, else sparx's platform key.
  const publishableKey = intent?.publishableKey ?? PLATFORM_PUBLISHABLE_KEY;
  const stripe = useMemo(
    () => (publishableKey ? getStripe(publishableKey) : null),
    [publishableKey]
  );

  if (error) {
    return (
      <div className="flex max-w-[560px] flex-col gap-4">
        <Alert color="danger">{error}</Alert>
        <Button type="button" color="neutral" variant="ghost" onClick={onBack}>
          ← Back to shipping
        </Button>
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="flex max-w-[560px] flex-col gap-4">
        <h2 className="text-base-content text-3xl font-semibold tracking-tight">Payment</h2>
        <div className="skeleton h-[180px]" />
      </div>
    );
  }

  // Hosted-redirect gateways (Square / Authorize.net / 1stPay / custom, docs/111 D4):
  // the shopper pays on the vendor's own page. No Stripe key / Elements involved.
  if (intent.redirectUrl) {
    return <RedirectPay intent={intent} session={session} onBack={onBack} />;
  }

  if (!stripe) {
    return (
      <Alert color="danger">
        Payments aren’t configured for this store yet (missing Stripe publishable key).
      </Alert>
    );
  }

  if (!intent.clientSecret) {
    return (
      <div className="flex max-w-[560px] flex-col gap-4">
        <h2 className="text-base-content text-3xl font-semibold tracking-tight">Payment</h2>
        <div className="skeleton h-[180px]" />
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
    <div className="flex max-w-[560px] flex-col gap-4">
      <h2 className="text-base-content text-3xl font-semibold tracking-tight">Payment</h2>
      <Alert color="info">
        You’ll finish paying securely on your payment provider’s page, then return here.
      </Alert>
      <div className="flex gap-3">
        <Button type="button" color="neutral" variant="ghost" onClick={onBack} disabled={busy}>
          ← Back
        </Button>
        <Button
          type="button"
          color="primary"
          size="lg"
          className="flex-1"
          onClick={go}
          disabled={busy}
        >
          {busy
            ? 'Redirecting…'
            : `Continue to pay ${formatMoney(session.totals.totalCents, session.currency)}`}
        </Button>
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
    <form onSubmit={pay} className="flex max-w-[560px] flex-col gap-4">
      <h2 className="text-base-content text-3xl font-semibold tracking-tight">Payment</h2>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error ? <Alert color="danger">{error}</Alert> : null}
      <div className="flex gap-3">
        <Button type="button" color="neutral" variant="ghost" onClick={onBack} disabled={busy}>
          ← Back
        </Button>
        <Button
          type="submit"
          color="primary"
          size="lg"
          className="flex-1"
          disabled={!stripe || busy}
        >
          {busy ? 'Processing…' : `Pay ${formatMoney(session.totals.totalCents, session.currency)}`}
        </Button>
      </div>
    </form>
  );
}
