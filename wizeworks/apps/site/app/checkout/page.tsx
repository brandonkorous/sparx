// Checkout page. The flow is fully client-driven (cart + Stripe + session
// state), so this server component just resolves the tenant and frames the
// client <CheckoutFlow>.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const site = await resolveSite();
  if (!site) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-6" style={{ paddingBlock: '2rem' }}>
      <h1
        className="text-base-content text-4xl font-semibold tracking-tight"
        style={{ marginBottom: '1.5rem' }}
      >
        Checkout
      </h1>
      {/* The shop's payment mode from the site payload, so the summary is honest
          on the FIRST step — the checkout session that also carries it does not
          exist until the shopper has given their details (issue 185). */}
      <CheckoutFlow tenantSlug={site.slug} paymentMode={site.commerce.paymentMode} />
    </div>
  );
}
