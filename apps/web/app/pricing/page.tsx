import type { Metadata } from 'next';
import { PricingPage } from '@/components/marketing/pricing-page';

export const metadata: Metadata = {
  title: 'Pricing — sparx',
  description:
    'Per-module pricing — switch on only what you use, from $10/mo. One platform, one invoice, a 14-day free trial with no card to start. See what each module replaces and what you keep.',
  alternates: { canonical: '/pricing' },
  // `openGraph.url` must be set per page. Without it the page inherits the
  // layout's `url: 'https://sparx.works'`, and LinkedIn treats og:url as
  // canonical and DE-DUPLICATES shares by it — so sharing /pricing resolved to
  // the homepage's cached preview instead of this page's own card.
  openGraph: {
    title: 'Pricing — sparx',
    description:
      'Per-module pricing — switch on only what you use, from $10/mo. One platform, one invoice, a 14-day free trial with no card to start.',
    url: 'https://sparx.works/pricing',
  },
};

export default function Pricing() {
  return <PricingPage />;
}
