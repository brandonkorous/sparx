'use client';

// The landing strip for every OAuth popup the console opens.
//
// A provider — a social platform, Search Console, an accounting system, Stripe —
// redirects the small consent popup to one of our own routes carrying `?code=`,
// `?state=` or `?error=`. That route renders THIS, which hands the values back
// through `window.opener` and closes itself. The pane that opened the popup does
// the actual exchange, on the console's own token.
//
// Nothing sensitive is handled here. The code and state are same-origin data
// passed straight through, posted to an exact origin rather than `'*'` so they
// can never be read cross-origin.
//
// ── WHY ONE COMPONENT AND FOUR ROUTES ───────────────────────────────────────
//
// The four flows differ in exactly two ways: the discriminator their pane
// listens for, and which query keys matter. Everything else — the origin check,
// the delivery tick, the close, the fallback when the browser refuses to close a
// window it did not script-open — is identical, and was four copies in the app
// this console forked from. Four copies of a security-relevant postMessage is
// four places to get `targetOrigin` wrong.

import { useEffect, useState } from 'react';
import { PigglesMascot } from '@piggles/mascot/react';

export interface OAuthPopupRelayProps {
  /** The discriminator the waiting pane checks — `piggles-social`, `piggles-gsc`, … */
  source: string;
  /**
   * Forward every query key that is not `code`/`state`/`error` under `params`.
   *
   * An allowlist would be the obvious design and is the wrong one: QuickBooks
   * returns the company-file id as `realmId`, Xero may add its own, and a
   * provider that adds a parameter next quarter would fail silently and
   * invisibly — the connect flow would complete and the connection would be
   * subtly wrong. Forwarding the remainder costs nothing; the pane names what it
   * wants.
   */
  forwardUnnamed?: boolean;
  /**
   * Post `done: true` instead of `code`/`state`. Stripe's hosted onboarding has
   * no OAuth code — the popup returning at all IS the signal, and the pane
   * re-reads status from the API.
   */
  signalDoneOnly?: boolean;
  /** What the person is waiting on, in their words. "your accounts", "Stripe". */
  what: string;
}

/** The three this component reads by name; everything else is the remainder. */
const NAMED = new Set(['code', 'state', 'error']);

export function OAuthPopupRelay({
  source,
  forwardUnnamed = false,
  signalDoneOnly = false,
  what,
}: OAuthPopupRelayProps) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const error = query.get('error') ?? undefined;

    const params: Record<string, string> = {};
    if (forwardUnnamed) {
      for (const [key, value] of query.entries()) {
        if (!NAMED.has(key)) params[key] = value;
      }
    }

    const message = signalDoneOnly
      ? { source, ...(error ? { error } : { done: true }) }
      : {
          source,
          code: query.get('code') ?? undefined,
          state: query.get('state') ?? undefined,
          error,
          ...(Object.keys(params).length > 0 ? { params } : {}),
        };

    // `window.opener` is typed loosely, so narrow it before posting. Target the
    // exact origin — never '*'.
    const opener = window.opener as Window | null;
    opener?.postMessage(message, window.location.origin);

    // A tick for delivery, then close. A browser that refuses to close a window
    // it did not script-open leaves the copy below as the instruction.
    const timer = setTimeout(() => {
      window.close();
      setClosed(true);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [source, forwardUnnamed, signalDoneOnly]);

  return (
    <div className="bg-base-200 grid min-h-screen place-items-center p-8">
      <div className="card bg-base-100 flex max-w-sm flex-col items-center gap-3 p-6 text-center">
        <PigglesMascot intent={closed ? 'success' : 'loading'} size="sm" />
        <h1 className="text-lg font-semibold">
          {closed ? 'All done — you can close this' : 'Nearly there…'}
        </h1>
        {/* A real ink token, never faded: this is the only sentence on the screen
            and the whole point of it is to be read. */}
        <p className="text-sm">
          {closed
            ? `This window is finished. Head back to Piggles to see ${what}.`
            : `We are handing ${what} back to Piggles. This window closes on its own.`}
        </p>
      </div>
    </div>
  );
}
