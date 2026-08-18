// Add a card without buying anything (docs/142 §12 item 5).
//
// Lives under /checkout rather than /account because it mounts the checkout
// card element — the same Elements, the same Stripe account, the same loader.
// A second card form under /account would be a copy that drifts.
//
// Server component: resolve the tenant, frame the client flow. Everything else
// (the setup session, the 3-D Secure return leg, the save) is client-side, the
// same as checkout itself.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { SaveCardFlow } from '@/components/checkout/save-card-flow';
import { resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Save a card',
  robots: { index: false, follow: false },
};

export default async function SaveCardPage() {
  const site = await resolveSite();
  if (!site) notFound();

  return (
    <div className="mx-auto w-full max-w-[560px] px-6 py-8">
      <h1 className="text-base-content mb-2 text-4xl font-semibold tracking-tight">Save a card</h1>
      <p className="text-md mb-6">
        For repeat orders, so you don’t have to enter it again. We never see or store your card
        number — it’s held securely by our payment processor.
      </p>
      {/* useSearchParams needs a Suspense boundary to keep the route from
          opting the whole page out of static rendering. */}
      <Suspense fallback={<div className="skeleton h-[220px]" />}>
        <SaveCardFlow tenantSlug={site.slug} />
      </Suspense>
    </div>
  );
}
