'use client';

// Adding a card outside a purchase (docs/142 §12 item 5).
//
// Checkout's card form only exists mid-purchase, and a repeat order needs a card
// long after the last one. So this is the second — and only other — place a
// shopper's card is collected: same Elements, same account, same Stripe.js
// loader, mounted against a SetupIntent instead of a PaymentIntent. Nothing is
// charged here.
//
// The whole session is begun HERE rather than on the account page. That page
// used to call `beginCardSetup` itself and hand the result over in the query
// string, which meant a client secret in the browser history and two places that
// knew how to branch inline-vs-hosted. One owner, no secrets in the URL.
//
// Three ways in, and they are the reason this looks more involved than a form:
//   1. fresh    — no query params: begin a setup session and mount the card form.
//   2. 3-D Secure return — Stripe bounced the shopper to their bank and back with
//      `setup_intent` + `redirect_status` appended. There is nothing to collect;
//      the card is already vaulted at the gateway and only needs saving here.
//   3. hosted   — a gateway that collects on its own page. Currently unreachable
//      (every gateway that can vault is inline — docs/111 §4.1), kept because
//      `beginSetup` can legitimately return a redirect and silently ignoring it
//      would strand the shopper on a blank page.

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Alert, Button, Switch } from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { beginCardSetup, completeCardSetup, type CardSetupSession } from '@/lib/customer-client';
import { getStripe, PLATFORM_PUBLISHABLE_KEY } from '@/lib/stripe-loader';

const CARDS_HOME = '/account/payment-methods';

/** Where to send the shopper when this is over. Same-origin paths only — an
 *  open redirect is trivially reachable through a query parameter, and this one
 *  sits at the end of a card-entry flow, which is exactly where a shopper is
 *  primed to trust whatever they land on. */
function safeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return CARDS_HOME;
  return raw;
}

export function SaveCardFlow({ tenantSlug }: { tenantSlug: string }) {
  const { status } = useCustomer();
  const router = useRouter();
  const params = useSearchParams();

  const returnTo = safeReturnTo(params.get('return'));
  // Stripe appends these when a card needed 3-D Secure and it took a full-page
  // redirect to get it.
  const returnedSetupIntent = params.get('setup_intent');
  const redirectStatus = params.get('redirect_status');

  const [session, setSession] = useState<CardSetupSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Both effects below can fire twice under React strict mode, and each one
  // creates or consumes a gateway-side object. Once is enough.
  const started = useRef(false);

  const finish = useCallback(() => {
    setSaved(true);
    router.replace(returnTo);
  }, [router, returnTo]);

  // Anonymous shoppers have no account to save a card to.
  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(`/account/login?redirect=${encodeURIComponent(CARDS_HOME)}`);
    }
  }, [status, router]);

  // Way in #2: back from the bank. The card is already at the gateway — all
  // that is left is to record it.
  useEffect(() => {
    if (status !== 'authenticated' || !returnedSetupIntent || started.current) return;
    started.current = true;

    if (redirectStatus === 'failed') {
      setError('Your bank did not approve that card. Nothing was saved — you can try another.');
      return;
    }
    completeCardSetup(tenantSlug, { setupRef: returnedSetupIntent })
      .then(finish)
      .catch(() => {
        setError('Your card was approved but we could not save it. Please try again.');
      });
  }, [status, returnedSetupIntent, redirectStatus, tenantSlug, finish]);

  // Way in #1/#3: a fresh visit — open a setup session.
  useEffect(() => {
    if (status !== 'authenticated' || returnedSetupIntent || started.current) return;
    started.current = true;

    beginCardSetup(tenantSlug, `${window.location.origin}${window.location.pathname}`)
      .then((next) => {
        if (next.redirectUrl) {
          window.location.href = next.redirectUrl;
          return;
        }
        setSession(next);
      })
      .catch((err: unknown) => {
        // `beginSetup` answers 422 with a shopper-safe sentence when the
        // merchant's processor cannot hold a card at all. Showing it as written
        // beats a generic failure, because it is not a failure — this store
        // simply bills repeat orders a different way.
        setError(
          err instanceof Error ? err.message : 'We could not open the card form. Please try again.'
        );
      });
  }, [status, returnedSetupIntent, tenantSlug]);

  if (status === 'loading' || (status === 'authenticated' && !session && !error && !saved)) {
    return <div className="skeleton h-[220px]" role="status" aria-label="Loading" />;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Alert color="danger">{error}</Alert>
        <div>
          <Button color="neutral" variant="outline" onClick={() => router.replace(CARDS_HOME)}>
            Back to your cards
          </Button>
        </div>
      </div>
    );
  }

  if (!session?.clientSecret) return null;

  const publishableKey = session.publishableKey ?? PLATFORM_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return (
      <Alert color="danger">
        This store isn’t set up to save cards yet. Please contact the store owner.
      </Alert>
    );
  }

  return (
    <StripeSetup
      tenantSlug={tenantSlug}
      session={session}
      publishableKey={publishableKey}
      returnTo={returnTo}
      onSaved={finish}
    />
  );
}

function StripeSetup({
  tenantSlug,
  session,
  publishableKey,
  returnTo,
  onSaved,
}: {
  tenantSlug: string;
  session: CardSetupSession;
  publishableKey: string;
  returnTo: string;
  onSaved: () => void;
}) {
  const stripe = useMemo(() => getStripe(publishableKey), [publishableKey]);
  return (
    <Elements
      stripe={stripe}
      options={{ clientSecret: session.clientSecret ?? undefined, appearance: { theme: 'stripe' } }}
    >
      <SetupForm
        tenantSlug={tenantSlug}
        setupRef={session.setupRef}
        returnTo={returnTo}
        onSaved={onSaved}
      />
    </Elements>
  );
}

function SetupForm({
  tenantSlug,
  setupRef,
  returnTo,
  onSaved,
}: {
  tenantSlug: string;
  setupRef: string;
  returnTo: string;
  onSaved: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [makeDefault, setMakeDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    try {
      const { error: confirmError } = await stripe.confirmSetup({
        elements,
        // `if_required` keeps the ordinary card on this page. A card whose bank
        // demands 3-D Secure still takes a full redirect, and `return_url` is
        // where it comes back to — the same page, which reads `setup_intent`
        // off the query string and finishes the save.
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}?return=${encodeURIComponent(returnTo)}`,
        },
      });
      if (confirmError) {
        setError(confirmError.message ?? 'That card could not be saved.');
        setBusy(false);
        return;
      }
      await completeCardSetup(tenantSlug, { setupRef, makeDefault });
      onSaved();
    } catch {
      // The card IS vaulted at the gateway at this point — the failure is ours,
      // between confirming and recording it. Sending them back to the list is
      // right: `completeSetup` is idempotent on the token, so if it half-landed
      // the card is already there, and if it did not, adding it again is safe.
      setError('Your card was accepted but we could not finish saving it. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: 'tabs' }} />

      {/* Not a <label>: the Switch renders its own control, so wrapping it would
          claim an association that does not exist. The visible text IS the
          accessible name, via aria-labelledby. */}
      <div className="flex items-center gap-3">
        <Switch
          checked={makeDefault}
          onCheckedChange={(next: boolean) => setMakeDefault(next)}
          aria-labelledby="save-card-default-label"
        />
        <span id="save-card-default-label" className="text-md">
          Use this card for my repeat orders
        </span>
      </div>

      {error ? <Alert color="danger">{error}</Alert> : null}

      <div className="flex gap-3">
        <Button
          type="button"
          color="neutral"
          variant="ghost"
          disabled={busy}
          onClick={() => router.replace(returnTo)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          color="primary"
          size="lg"
          className="flex-1"
          disabled={!stripe || busy}
        >
          {busy ? 'Saving…' : 'Save card'}
        </Button>
      </div>
    </form>
  );
}
