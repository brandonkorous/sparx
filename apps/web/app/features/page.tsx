import type { Metadata } from 'next';
import { FeaturesFinalCta } from '@/components/marketing/features/final-cta';
import { FeaturesHero } from '@/components/marketing/features/hero';
import { FeaturesIndexBand } from '@/components/marketing/features/index-band';
import { capabilityCounts } from '@/lib/capabilities';

const counts = capabilityCounts();

// Rounded for social/marketing copy so the numbers read cleanly and don't look
// like oddly precise internal counts. Both floor to the nearest ten so the "+" /
// "Over" claims stay true no matter how the catalog grows ("Over 300").
const liveFloor = Math.floor(counts.live / 10) * 10; // 250
const totalFloor = Math.floor(counts.total / 10) * 10; // 310
const upcoming = counts.building + counts.planned; // in-build + planned

const OG_TITLE = `One platform. Over ${totalFloor} capabilities.`;
const OG_DESCRIPTION = `${liveFloor}+ live today across ${counts.modules} modules, ${upcoming} more on the way — all on one data layer, one dashboard, one bill. The whole platform, in one place.`;

export const metadata: Metadata = {
  title: 'Features — everything inside sparx',
  description: `The pricing page lists ${counts.modules} modules. This is what's inside them: ${counts.live} shipped capabilities, ${counts.building} more in build, all on one data layer and one bill. Activate only what you need.`,
  alternates: { canonical: '/features' },
  // The marketing site historically headlines modules; this page (and its share
  // card) is about sheer breadth, so it sets its own OG text + image (the local
  // opengraph-image.tsx) rather than inheriting the root's generic card.
  // `type: 'article'` + publishedTime gives social scrapers a publish date
  // (LinkedIn surfaces it; without it the card shows "No publication date").
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: 'https://sparx.works/features',
    siteName: 'sparx',
    type: 'article',
    publishedTime: '2026-06-11T00:00:00.000Z',
    modifiedTime: '2026-06-11T00:00:00.000Z',
    authors: ['WizeWorks LLC'],
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: `${liveFloor}+ capabilities live across ${counts.modules} modules — one data layer, one bill. See everything sparx does.`,
  },
};

// Composed here the way /pricing is — one file per beat under
// components/marketing/features/, in the order below.
//
// The arc is deliberately short, because the page's substance is the index and
// everything else is scaffolding around it: state the breadth as a number (dark
// hero) → hand over the searchable catalog (page band, sticky finder) → close on
// the offer (dark band). The previous version had no finder, so its 300-odd
// capabilities were 6,700px of unsearchable pastel rows in which nothing could
// be found and nothing outranked anything else.
export default function Features() {
  return (
    <main>
      <FeaturesHero />
      <FeaturesIndexBand />
      <FeaturesFinalCta />
    </main>
  );
}
