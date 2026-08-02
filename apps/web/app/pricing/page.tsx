import type { Metadata } from 'next';
import { PricingV2Hero } from '@/components/marketing/pricing-v2/hero';
import { PricingV2Stakes } from '@/components/marketing/pricing-v2/stakes';
import { PricingV2Switchboard } from '@/components/marketing/pricing-v2/switchboard';
import { PricingV2DashboardSection } from '@/components/marketing/pricing-v2/dashboard-section';
import { PricingV2Foundation } from '@/components/marketing/pricing-v2/foundation';
import { PricingV2Features } from '@/components/marketing/pricing-v2/features';
import { PricingV2Principles } from '@/components/marketing/pricing-v2/principles';
import { PricingV2Enterprise } from '@/components/marketing/pricing-v2/enterprise';
import { PricingV2Faq } from '@/components/marketing/pricing-v2/faq';
import { PricingV2FinalCta } from '@/components/marketing/pricing-v2/final-cta';

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

// The pricing page, rebuilt the way landing-v3 rebuilt the homepage: a full
// silicaui purge (no primitives.tsx, no mkt-* classes, no heading-style
// override, no --gutter-page/--section-py-* vars) AND a genuine narrative
// redesign. The interactive switchboard is reused byte-for-byte; every
// figure/answer comes from the already-cleaned pricing-v1/data module unchanged.
//
// The argument is ordered around tension → release. Instead of opening on the
// tool, it opens on the promise, then makes the reader FEEL the cost of a
// stitched-together stack (the money beat), THEN hands over the switchboard to
// build their own number, then removes every objection.
//
// Arc + band rhythm (colored/dark bands carry the page the way landing-v3's do):
// Hero (dark) → Stakes/money beat (light; dark receipt vs magenta answer) →
// Switchboard (violet band) → Dashboard (indigo band, product screenshot) →
// Foundation (slate bedrock band) → Features (light) → Principles (light) →
// Enterprise (dark) → FAQ (light) → Final CTA (dark).
//
// This composition lived at /pricing/v2 while it was an experiment. It is now
// THE pricing page and that route is gone — it was `robots: noindex`, so there
// was no search equity to preserve and no redirect is owed.
export default function Pricing() {
  return (
    <main>
      <PricingV2Hero />
      <PricingV2Stakes />
      <PricingV2Switchboard />
      <PricingV2DashboardSection />
      <PricingV2Foundation />
      <PricingV2Features />
      <PricingV2Principles />
      <PricingV2Enterprise />
      <PricingV2Faq />
      <PricingV2FinalCta />
    </main>
  );
}
