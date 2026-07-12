import type { Metadata } from 'next';
import { FinalCta } from '@/components/marketing/final-cta';
import { Container } from '@/components/marketing/primitives';
import { PricingSwitchboard } from '@/components/marketing/pricing-switchboard';
import { PricingV1AlwaysIncluded } from '@/components/marketing/pricing-v1/always-included';
import { PricingV1CostSavings } from '@/components/marketing/pricing-v1/cost-savings';
import { PricingV1FeatureTable } from '@/components/marketing/pricing-v1/feature-table';
import { PricingV1BillingPrinciples } from '@/components/marketing/pricing-v1/billing-principles';
import { PricingV1Enterprise } from '@/components/marketing/pricing-v1/enterprise';
import { PricingV1Faq } from '@/components/marketing/pricing-v1/faq-section';

export const metadata: Metadata = {
  title: 'Pricing (v1) — sparx',
  description:
    'Per-module pricing — switch on only what you use, from $10/mo. One platform, one invoice, a 14-day free trial with no card to start. See what each module replaces and what you keep.',
  // Isolated design experiment — keep it out of the index while it lives
  // alongside the production /pricing route.
  robots: { index: false, follow: false },
};

// /pricing/v1 — an isolated redesign experiment. Reuses the finished, shared
// switchboard (PricingSwitchboard / ModuleToggleCard / StackSummaryCard) and the
// shared FinalCta byte-for-byte; every beat below the switchboard is rebuilt on
// the homepage's visual language (real silicaui components, big sans numerals,
// the mkt-paneled depth-tier band system) with all facts/numbers preserved.
// Band rhythm: content → stage → content → stage → content → dark → content →
// dark, so no two identical tiers sit adjacent.
export default function PricingV1() {
  return (
    <main className="mkt-paneled">
      <section className="px-[var(--gutter-page)] py-[var(--section-py-lg)]">
        <Container>
          <PricingSwitchboard />
        </Container>
      </section>
      <PricingV1AlwaysIncluded />
      <PricingV1CostSavings />
      <PricingV1FeatureTable />
      <PricingV1BillingPrinciples />
      <PricingV1Enterprise />
      <PricingV1Faq />
      <FinalCta />
    </main>
  );
}
