import type { Metadata } from 'next';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { PartnersPage } from '@/components/marketing/partners-page';
import { fetchPartners } from '@/lib/partners';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Partner Program — build your practice on sparx',
  description:
    'Join the sparx Partner Program. Help businesses replace their site, CRM, and email stack with one platform — earn 20–30% on the first payment and 5% ongoing on managed accounts. Apply in two minutes.',
  alternates: { canonical: '/partners' },
  openGraph: {
    title: 'Build your practice on sparx',
    description:
      'The sparx Partner Program — refer clients, host bootcamps, and get paid every time a client goes live. Informal, Registered, and Certified tiers.',
    url: '/partners',
    type: 'website',
  },
};

export default async function PartnersRoute() {
  // Empty-safe social-proof count: the public directory total, summed from the
  // tier facet buckets (one cheap page). Degrades to undefined (→ "founding
  // partner" invite) when the endpoint isn't live yet.
  const page = await fetchPartners({ limit: '1' });
  const total = page.facets.tier.reduce((sum, f) => sum + (f.count ?? 0), 0);
  const partnerCount = total > 0 ? total : undefined;

  return (
    <>
      <Nav />
      <PartnersPage partnerCount={partnerCount} />
      <Footer />
    </>
  );
}
