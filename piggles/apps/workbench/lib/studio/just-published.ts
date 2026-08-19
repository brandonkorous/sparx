'use client';

// Whether a publish is still working its way out to the site.
//
// The console knows the moment a publish is accepted; it does not know when a
// visitor sees it. Published builder reads are cached for 300s, with a tag purge
// on the publish event as the real mechanism and that TTL as the backstop — so the
// gap is usually seconds and can be minutes.
//
// "Saved and live." was printed the instant the API returned, which is a claim
// about the VISITOR made from the console's own state. An owner who publishes,
// opens Preview and sees the old page concludes the publish failed and does it
// again.

import { useEffect, useState } from 'react';

/** The storefront's TTL backstop for a published read. */
export const CATCH_UP_MS = 300_000;

/**
 * True while `publishedAt` is recent enough that the site may not have caught up.
 *
 * Ticks itself off, so the status settles to "live" on its own rather than staying
 * hedged until the pane is next re-rendered for some unrelated reason.
 */
export function useJustPublished(publishedAt: string | null | undefined): boolean {
  const [now, setNow] = useState(() => Date.now());
  const at = publishedAt ? Date.parse(publishedAt) : Number.NaN;
  const recent = Number.isFinite(at) && now - at < CATCH_UP_MS;

  useEffect(() => {
    if (!recent) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1000, CATCH_UP_MS - (now - at)));
    return () => clearTimeout(timer);
  }, [recent, now, at]);

  return recent;
}
