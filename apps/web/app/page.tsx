import { LandingHero } from '@/components/marketing/landing/hero';
import { LandingWhoever } from '@/components/marketing/landing/whoever';
import { LandingStory } from '@/components/marketing/landing/story';
import { LandingSwitchboard } from '@/components/marketing/landing/switchboard';
import { LandingTimeline } from '@/components/marketing/landing/timeline';
import { LandingProof } from '@/components/marketing/landing/proof';
import { LandingDashboardSection } from '@/components/marketing/landing/dashboard-section';
import { LandingFaq } from '@/components/marketing/landing/faq';
import { LandingFinalCta } from '@/components/marketing/landing/final-cta';

export const metadata = {
  // Lowercase `sparx` — it is the brand, and the title promised a different line
  // ("Run the business, not the software") than the H1 delivers, so a visitor
  // arriving from a search result was sold one thing and shown another.
  title: 'sparx — Your story, multiplied',
  description:
    'A narrative walkthrough of sparx — the modular content and commerce OS that brings your site, customers, sales, email and AI into one connected system.',
};
// The homepage. Built on pure silicaui — no primitives.tsx, no mkt-* CSS
// classes, no inline style objects, no hardcoded colors — so a token or
// component change upstream lands here with zero edits (RULE #1).
//
// Every section is its own file under components/marketing/landing/, in the
// order they run down the page: Hero, Whoever, Story, Switchboard, Timeline,
// Proof, DashboardSection, Faq, FinalCta.
export default function LandingPage() {
  return (
    <main>
      <LandingHero />
      <LandingWhoever />
      <LandingStory />
      <LandingSwitchboard />
      <LandingTimeline />
      <LandingProof />
      <LandingDashboardSection />
      <LandingFaq />
      <LandingFinalCta />
    </main>
  );
}
