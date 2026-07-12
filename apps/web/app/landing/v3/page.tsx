import { LandingV3Hero } from '@/components/marketing/landing-v3/hero';
import { LandingV3Whoever } from '@/components/marketing/landing-v3/whoever';
import { LandingV3Story } from '@/components/marketing/landing-v3/story';
import { LandingV3Switchboard } from '@/components/marketing/landing-v3/switchboard';
import { LandingV3Timeline } from '@/components/marketing/landing-v3/timeline';
import { LandingV3Proof } from '@/components/marketing/landing-v3/proof';
import { LandingV3DashboardSection } from '@/components/marketing/landing-v3/dashboard-section';
import { LandingV3Faq } from '@/components/marketing/landing-v3/faq';
import { LandingV3FinalCta } from '@/components/marketing/landing-v3/final-cta';

export const metadata = {
  robots: { index: false, follow: false },
};

// v3 — rebuilding the homepage on pure silicaui (no primitives.tsx, no
// mkt-* CSS classes, no inline style objects, no hardcoded colors), keeping
// only the actual copy/content from the live homepage (formerly /landing/v2).
// Built and reviewed section by section; sections land here as they're
// signed off, in the same order they run on the live page. Currently:
// Hero, Whoever, Story, Switchboard, Timeline, Proof, DashboardSection, Faq,
// FinalCta — every section from the live homepage now has a v3 build.
export default function LandingV3Page() {
  return (
    <main>
      <LandingV3Hero />
      <LandingV3Whoever />
      <LandingV3Story />
      <LandingV3Switchboard />
      <LandingV3Timeline />
      <LandingV3Proof />
      <LandingV3DashboardSection />
      <LandingV3Faq />
      <LandingV3FinalCta />
    </main>
  );
}
