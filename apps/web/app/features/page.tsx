import type { Metadata } from 'next';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { FeaturesPage } from '@/components/marketing/features-page';
import { capabilityCounts } from '@/lib/capabilities';

const counts = capabilityCounts();

export const metadata: Metadata = {
  title: 'Features — everything inside Sparx',
  description: `The pricing page lists ${counts.modules} modules. This is what's inside them: ${counts.live} shipped capabilities, ${counts.building} more in build, all on one data layer and one bill. Activate only what you need.`,
  alternates: { canonical: '/features' },
};

export default function Features() {
  return (
    <>
      <Nav />
      <FeaturesPage />
      <Footer />
    </>
  );
}
