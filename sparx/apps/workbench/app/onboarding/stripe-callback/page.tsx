'use client';

// sparx Pay (Stripe Connect Express) onboarding landing — the payments step's popup.
//
// Stripe returns the popup here after the merchant finishes hosted onboarding
// (return_url) or when the single-use Account Link expires (refresh_url). Unlike the
// old OAuth flow there is NO code/state to hand back — the Express account is created
// and reconciled entirely on the backend — so this page just signals "the popup came
// back" to the workbench window that opened it, which then refreshes sparx Pay status.
//
// A popup (not a full-page redirect) so the in-page onboarding keeps its state —
// losing the composed story or a half-filled wizard to a Stripe round-trip is exactly
// the interruption the workbench avoids. Account Links need no redirect-URI
// registration (unlike OAuth), so this route works on any origin the workbench runs on.
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
      done: true,
      error: params.get('error') ?? undefined,
    };

    // Signal the window that opened this popup. Target the exact origin (never '*').
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
    <div className="bg-base-200 grid min-h-screen place-items-center p-8">
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
