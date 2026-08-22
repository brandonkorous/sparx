'use client';

// Route-segment error boundary (docs/50 §4). Catches render/runtime errors below
// the root layout so a single broken page degrades to a recover-able message
// instead of a blank screen.
//
// ── WHO READS THIS ──────────────────────────────────────────────────────────
//
// The same person `not-found.tsx` is written for: a tenant's own customer, on a
// real business's website, who is not a developer and did nothing wrong. It
// renders INSIDE the tenant's layout, so their header, footer, colours and type
// are already around these words — the rest of the site is visibly still there,
// which is most of the reassurance this page has to give.
//
// Two things it deliberately does NOT say:
//
//   "the store" — a sparx site is content and/or commerce. A CMS-only publisher
//       and a CRM-only team both render this file, and neither has a store to
//       head back to. The neutral noun is the site itself.
//   an eyebrow — it opened with `SOMETHING WENT WRONG` in uppercase mono above
//       the heading, which is the label-above-a-heading pattern RULE #2 bans.
//       This is platform chrome in the site app, not tenant content, so the ban
//       reaches it. The heading carries itself.
//
// The reference code is shown because it is the only handle a shopper has when
// they tell the shop what happened — so it is worded as that errand rather than
// as a field name, and it gets real ink like anything else meant to be read.

import { Button } from '@wizeworks/silicaui-react';
import { useEffect } from 'react';
import { ButtonLink } from '@/components/button-link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console / server logs. A future error tracker hooks in here.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-base-content text-4xl font-semibold tracking-tight">
        This page didn&rsquo;t load
      </h1>
      <p className="text-base-content text-lg">
        Something went wrong at our end, not yours. Trying again often works — and if it
        doesn&rsquo;t, the rest of the site is still here.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button color="primary" size="lg" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" size="lg">
          Go to the front page
        </ButtonLink>
      </div>

      {error.digest ? (
        <p className="text-base-content mt-6 text-sm">
          If you let them know, quote <span className="font-mono">{error.digest}</span>.
        </p>
      ) : null}
    </main>
  );
}
