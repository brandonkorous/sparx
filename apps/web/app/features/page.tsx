import type { Metadata } from 'next';
import { FeaturesPage } from '@/components/marketing/features-page';
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
    authors: ['WizeWorks, Inc.'],
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: `${liveFloor}+ capabilities live across ${counts.modules} modules — one data layer, one bill. See everything sparx does.`,
  },
};

export default function Features() {
  return <FeaturesPage />;
}
