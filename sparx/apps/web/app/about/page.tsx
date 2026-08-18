import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = {
  title: 'About WizeWorks — sparx',
  description:
    'WizeWorks is a Visalia, California software studio. sparx is our flagship content and commerce platform. kanNINJA and HelpNinja are also ours.',
  alternates: { canonical: '/about' },
  robots: { index: false },
};

export default function AboutPage() {
  return (
    <ComingSoon
      eyebrow="Company"
      title="About WizeWorks"
      description="WizeWorks is a Visalia, California software studio founded by Brandon Korous. sparx is our flagship content and commerce platform; kanNINJA (project management) and HelpNinja (AI support) are also ours. wize.works for the full portfolio."
      contact="hello@sparx.works"
    />
  );
}
