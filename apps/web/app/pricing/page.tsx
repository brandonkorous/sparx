import type { Metadata } from 'next';
import { PricingHero } from '@/components/marketing/pricing/hero';
import { PricingStakes } from '@/components/marketing/pricing/stakes';
import { PricingSwitchboardBand } from '@/components/marketing/pricing/switchboard';
import { PricingDashboardSection } from '@/components/marketing/pricing/dashboard-section';
import { PricingFoundation } from '@/components/marketing/pricing/foundation';
import { PricingFeatures } from '@/components/marketing/pricing/features';
import { PricingPrinciples } from '@/components/marketing/pricing/principles';
import { PricingEnterprise } from '@/components/marketing/pricing/enterprise';
import { PricingFaq } from '@/components/marketing/pricing/faq';
import { PricingFinalCta } from '@/components/marketing/pricing/final-cta';

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

// The pricing page, built the way the homepage is: a full silicaui purge (no
// primitives.tsx, no mkt-* classes, no bespoke font-size override, no
// --gutter-page/--section-py-* vars) around a narrative argument. The
// interactive switchboard is the shared PricingSwitchboard, reused
// byte-for-byte; every figure and answer comes from ./pricing/data.
//
// The argument is ordered around tension → release. Instead of opening on the
// tool, it opens on the promise, then makes the reader FEEL the cost of a
// stitched-together stack (the money beat), THEN hands over the switchboard to
// build their own number, then removes every objection.
//
// Arc + band rhythm (colored/dark bands carry the page the way landing's do):
// Hero (dark) → Stakes/money beat (light; dark receipt vs magenta answer) →
// Switchboard (violet band) → Dashboard (indigo band, product screenshot) →
// Foundation (slate bedrock band) → Features (light) → Principles (light) →
// Enterprise (dark) → FAQ (light) → Final CTA (dark).
//
// The sections live in components/marketing/pricing/ — one file per beat, in
// the order above.
export default function Pricing() {
  return (
    <main>
      <PricingHero />
      <PricingStakes />
      <PricingSwitchboardBand />
      <PricingDashboardSection />
      <PricingFoundation />
      <PricingFeatures />
      <PricingPrinciples />
      <PricingEnterprise />
      <PricingFaq />
      <PricingFinalCta />
    </main>
  );
}
