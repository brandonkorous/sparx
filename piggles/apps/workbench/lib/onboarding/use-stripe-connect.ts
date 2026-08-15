'use client';

// The sparx Pay (Stripe Connect EXPRESS) onboarding handshake, as a hook — so the
// wizard's payments step and the story's "get paid" chapter share ONE copy of the
// fiddly part (open Stripe's hosted onboarding in a popup, wait for the callback's
// postMessage, then refresh status) and only differ in how they PRESENT it.
//
// The workbench keeps its whole flow on one page, so it never full-page redirects to
// Stripe (that would evaporate every in-page choice). It opens the Account Link in a
// popup and waits for /onboarding/stripe-callback to postMessage back. There is no
// OAuth code to exchange — the backend created + reconciles the Express account — so
// on return we simply refresh sparx Pay status. Connecting is always optional; the
// caller's CTA proceeds either way.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OnboardingActions } from './api';

interface StripeMessage {
  source: 'sparx-stripe';
  /** The popup returned from Stripe's hosted onboarding (no OAuth code any more). */
  done?: boolean;
  error?: string;
}

function isStripeMessage(data: unknown): data is StripeMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === 'sparx-stripe'
  );
}

export interface StripeConnect {
  /** Open the Stripe popup and begin the handshake. */
  connect: () => void;
  /** The popup is open / the code is exchanging. */
  connecting: boolean;
  /** A human-readable failure, or null. */
  error: string | null;
}

export function useStripeConnect(
  actions: OnboardingActions,
  onConnected: () => void
): StripeConnect {
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Same-origin only: the callback route lives in this app, so a message from any
      // other origin is not ours to trust.
      if (event.origin !== window.location.origin) return;
      if (!isStripeMessage(event.data)) return;

      popupRef.current?.close();
      popupRef.current = null;

      if (event.data.error) {
        setConnecting(false);
        setError('Stripe could not connect. Please try again.');
        return;
      }

      // The popup returned from Stripe's hosted onboarding. Pull live status so the
      // step reflects charge-readiness right away (and syncs the config so Settings
      // agrees), then let the caller advance.
      void actions
        .refreshPaymentsStatus()
        .then(() => {
          setConnecting(false);
          onConnected();
        })
        .catch(() => {
          setConnecting(false);
          setError('We could not finish connecting Stripe. Please try again.');
        });
    },
    [actions, onConnected]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const connect = useCallback(() => {
    setError(null);
    setConnecting(true);
    // Stripe returns the popup to this callback route on finish (return_url) or when
    // the single-use link expires (refresh_url). The callback page postMessages back.
    const callback = `${window.location.origin}/onboarding/stripe-callback`;
    void actions
      .startPaymentsOnboarding(callback, callback)
      .then(({ url }) => {
        const popup = window.open(url, 'sparx-stripe-connect', 'width=520,height=720');
        if (!popup) {
          setConnecting(false);
          setError('Your browser blocked the Stripe window. Allow pop-ups and try again.');
          return;
        }
        popupRef.current = popup;
      })
      .catch(() => {
        setConnecting(false);
        setError('We could not open Stripe. Please try again.');
      });
  }, [actions]);

  return { connect, connecting, error };
}
