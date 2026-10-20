'use client';

// WizeLens in the browser: page loads, React renders, fetches and errors, sent
// to this app's own server, which forwards them with its traces.
//
//  - On only when this page's server runs WizeLens. Such a server names its
//    trace in the document's Server-Timing header, so the check needs no build
//    flag and can never post spans to a server that does not take them.
//  - The HUD shows in development only. In production nothing is drawn.
//  - `apiUrl` is api-rest's browser-facing origin. Calls to it carry a
//    `traceparent` too, so api-rest's part joins the click that caused it.

import { WizeLensProvider, WizeLensUser } from '@wizeworks/lens-react';
import { useCallback, useSyncExternalStore } from 'react';

const DEVELOPMENT = process.env.NODE_ENV === 'development';

// The navigation entry never changes after load, so there is nothing to subscribe to.
const noSubscribe = () => () => undefined;

/** True when the server that rendered this page traces it (`wl-trace` in Server-Timing). */
export function serverTraces(): boolean {
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  return nav?.serverTiming?.some((entry) => entry.name === 'wl-trace') ?? false;
}

function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

export function WizeLens({ apiUrl }: { apiUrl?: string }) {
  const enabled = useSyncExternalStore(noSubscribe, serverTraces, () => false);
  const apiOrigin = originOf(apiUrl);
  const propagateTo = useCallback(
    (url: URL) => url.origin === window.location.origin || url.origin === apiOrigin,
    [apiOrigin]
  );
  return <WizeLensProvider enabled={enabled} hud={DEVELOPMENT} propagateTo={propagateTo} />;
}

/** Names the signed-in user on this page's browser spans, so the Users page counts what they do, calls to api-rest included. */
export function WizeLensSignedIn({ id, name }: { id: string; name: string | null }) {
  return <WizeLensUser id={id} name={name} />;
}
