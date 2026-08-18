'use client';

// Accounting OAuth landing.
//
// QuickBooks Online or Xero redirects the small consent popup here with
// ?code=&state= (or ?error= if the owner cancels). This page runs ONLY in that
// popup: it hands the values back to the workbench window that opened it via
// postMessage, then closes itself. The exchange for a stored grant happens in
// the Accounting pane, on the workbench's own token — nothing sensitive is
// handled here, and the code and state are same-origin data passed straight
// through.
//
// WHY THIS IS NOT `app/social/callback` WITH ANOTHER TAG. That page forwards
// exactly `code`, `state` and `error`, and QuickBooks puts the company file id
// in a THIRD parameter — `realmId`, on the callback query and nowhere else in
// the round trip. Drop it and the connect appears to succeed, then every later
// request 401s with an authentication message that has nothing to do with the
// token, which is close to undiagnosable. So this page forwards every parameter
// it was given and lets the server decide which ones matter. Generalising the
// two pages into one would mean a shared `source` tag and two panes listening to
// each other's messages, which is worse than fifty duplicated lines.
//
// It reads from `window.location` inside an effect rather than `useSearchParams`
// so it needs no Suspense boundary and never runs on the server — this is a
// throwaway popup, not a rendered route.

import { useEffect, useState } from 'react';

/** Parameters the pane consumes by name; everything else rides in `params`. */
const NAMED = new Set(['code', 'state', 'error', 'error_description']);

export default function AccountingCallbackPage() {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);

    // Everything the provider sent that is not one of ours. `realmId` is the one
    // that matters today; forwarding the rest costs nothing and means the next
    // provider's quirk is a server change rather than another edit here.
    const params: Record<string, string> = {};
    for (const [key, value] of query.entries()) {
      if (!NAMED.has(key)) params[key] = value;
    }

    const message = {
      source: 'sparx-accounting' as const,
      code: query.get('code') ?? undefined,
      state: query.get('state') ?? undefined,
      // Providers disagree about which field carries the human-readable reason,
      // so prefer the descriptive one and fall back to the code.
      error: query.get('error_description') ?? query.get('error') ?? undefined,
      params,
    };

    // Target the exact origin rather than '*' so the code and state can never be
    // read cross-origin. `window.opener` is typed `any`, so narrow it first.
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
            ? 'This window can be closed. Head back to the workbench to see your accounting connection.'
            : 'We are handing your connection back to the workbench. This window will close on its own.'}
        </p>
      </div>
    </div>
  );
}
