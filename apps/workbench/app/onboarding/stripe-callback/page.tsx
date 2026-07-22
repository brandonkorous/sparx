'use client';

// Stripe Connect OAuth landing (onboarding payments step).
//
// Stripe redirects the connect popup here with ?code=&state= (or ?error= if the
// owner cancels). This page runs ONLY in that popup: it hands the values back to
// the workbench window that opened it via postMessage, then closes itself. The
// exchange for a stored connection happens back in the payments step, on the
// workbench's own token — nothing sensitive is handled here, and the code/state
// are same-origin data passed straight through.
//
// A popup (not a full-page redirect like the dashboard) so the in-page onboarding
// flow keeps its state — losing the composed story or a half-filled wizard to an
// OAuth round-trip is exactly the interruption the workbench avoids.
//
// NOTE: the redirect_uri `${origin}/onboarding/stripe-callback` must be registered
// in the Stripe Connect app's allowed OAuth redirect URIs for each origin the
// workbench runs on (localhost:3011 in dev, the deployed workbench host in prod).
//
// It reads from `window.location` inside an effect rather than `useSearchParams`
// so it needs no Suspense boundary and never runs on the server — this is a
// throwaway popup, not a rendered route.

import { useEffect, useState } from 'react';

export default function StripeConnectCallbackPage() {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = {
      source: 'sparx-stripe' as const,
      code: params.get('code') ?? undefined,
      state: params.get('state') ?? undefined,
      error: params.get('error') ?? undefined,
    };

    // Hand the result back to the window that opened this popup. Target the exact
    // origin rather than '*' so the code/state can never be read cross-origin.
    const opener = window.opener as Window | null;
    opener?.postMessage(message, window.location.origin);

    // Give the message a tick to deliver, then close. If the browser refuses to
    // close a window it did not script-open, fall back to a visible instruction.
    const timer = setTimeout(() => {
      window.close();
      setClosed(true);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="bg-base-200 text-base-content grid min-h-screen place-items-center p-8">
      <div className="card bg-base-100 flex max-w-sm flex-col gap-2 p-6 text-center">
        <h1 className="text-lg font-semibold">
          {closed ? 'You can close this window' : 'Finishing up…'}
        </h1>
        <p className="text-sm">
          {closed
            ? 'This window can be closed. Head back to setup to finish connecting payments.'
            : 'We are handing your Stripe connection back to setup. This window will close on its own.'}
        </p>
      </div>
    </div>
  );
}
