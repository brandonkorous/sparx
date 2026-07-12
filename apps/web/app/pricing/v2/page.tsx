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
  title: 'Pricing (v2) — sparx',
  description:
    'Flat per-module pricing: switch on only what you use, from $10/mo. One platform, one invoice, and a 14-day free trial with no card to start. See what each module replaces and what you keep.',
  // Isolated design experiment — keep it out of the index while it lives
  // alongside the production /pricing route.
  robots: { index: false, follow: false },
};

// /pricing/v2 — the pricing page rebuilt the way landing-v3 rebuilt the
// homepage: a full silicaui purge (no primitives.tsx, no mkt-* classes, no
// heading-style override, no --gutter-page/--section-py-* vars) AND a genuine
// narrative redesign. The interactive switchboard is reused byte-for-byte; every
// figure/answer comes from the already-cleaned pricing-v1/data module unchanged.
//
// The argument is reordered around tension → release. Instead of opening on the
// tool (as v1/live do), it opens on the promise, then makes the reader FEEL the
// cost of a stitched-together stack (the money beat), THEN hands over the
// switchboard to build their own number, then removes every objection.
//
// Arc + band rhythm (colored/dark bands carry the page the way landing-v3's do):
// Hero (dark) → Stakes/money beat (light; dark receipt vs magenta answer) →
// Switchboard (violet band) → Dashboard (indigo band, product screenshot) →
// Foundation (slate bedrock band) → Features (light) → Principles (light) →
// Enterprise (dark) → FAQ (light) → Final CTA (dark).
export default function PricingV2() {
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
