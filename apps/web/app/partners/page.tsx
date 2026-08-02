import type { Metadata } from 'next';
import { PartnersApply } from '@/components/marketing/partners/apply';
import { PartnersDirectory } from '@/components/marketing/partners/directory';
import { PartnersEarningsBand } from '@/components/marketing/partners/earnings-band';
import { PartnersFaq } from '@/components/marketing/partners/faq';
import { PartnersFinalCta } from '@/components/marketing/partners/final-cta';
import { PartnersHero } from '@/components/marketing/partners/hero';
import { PartnersResources } from '@/components/marketing/partners/resources';
import { PartnersSteps } from '@/components/marketing/partners/steps';
import { PartnersTiers } from '@/components/marketing/partners/tiers';
import { fetchPartners } from '@/lib/partners';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Partner Program — build your practice on sparx',
  description:
    'Refer clients to sparx and earn 20–30% of their first payment, plus 5% every month after on managed accounts. Your clients replace five subscriptions with one platform; your fee stays yours. No contract, no minimum. Apply in two minutes.',
  alternates: { canonical: '/partners' },
  // `openGraph.url` must be ABSOLUTE. A bare '/partners' leaves LinkedIn
  // resolving og:url against nothing and de-duplicating the share against the
  // homepage's cached card — the same bug /pricing was fixed for.
  openGraph: {
    title: 'Build your practice on sparx',
    description:
      'Earn 20–30% of a referred client’s first payment and 5% of every month after. Informal, Registered and Certified tiers — no reseller contract, no minimum.',
    url: 'https://sparx.works/partners',
    type: 'website',
  },
};

// Composed the way /pricing and /features are — one file per beat under
// components/marketing/partners/, in the order below.
//
// The arc answers an agency's questions in the order it actually asks them: what
// is the deal (dark hero) → what would I make (the earnings ledger, the beat the
// old page was missing entirely) → which tier am I → how does it work → what do I
// get to work with → the directory aside → apply → objections → close.
//
// `partners-page.tsx` / `partners-sections.tsx` / `partners-tiers.tsx` are
// deleted, along with the bespoke `.mkt-*` layout classes they needed in
// app/marketing.css. docs/114 §B.6 called for that pattern; every page rebuilt
// since has dropped it for `<Band>` + plain utilities, which is the only reason
// this page could be re-laid-out without touching a stylesheet.
export default async function PartnersRoute() {
  // Real directory entries for the aside — three at most, and none at all if the
  // endpoint is not up yet. That block renders fine without them, which is the
  // whole reason it no longer ships three invented agencies.
  const page = await fetchPartners({ limit: '3' });

  return (
    <main>
      <PartnersHero />
      <PartnersEarningsBand />
      <PartnersTiers />
      <PartnersSteps />
      <PartnersResources />
      <PartnersDirectory partners={page.items} />
      <PartnersApply />
      <PartnersFaq />
      <PartnersFinalCta />
    </main>
  );
}
