import type { Metadata } from 'next';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { FeaturesPage } from '@/components/marketing/features-page';
import { capabilityCounts } from '@/lib/capabilities';

const counts = capabilityCounts();

// Rounded for social/marketing copy so the numbers read cleanly and don't look
// like oddly precise internal counts. `live` floors (so the "+" claim stays true);
// `total` rounds to the nearest ten ("nearly 300").
const liveFloor = Math.floor(counts.live / 10) * 10; // 230
const totalRound = Math.round(counts.total / 10) * 10; // 300
const upcoming = counts.building + counts.planned; // in-build + planned

const OG_TITLE = `One platform. Nearly ${totalRound} capabilities.`;
const OG_DESCRIPTION = `${liveFloor}+ live today across ${counts.modules} modules, ${upcoming} more on the way — all on one data layer, one dashboard, one bill. The whole platform, in one place.`;

export const metadata: Metadata = {
  title: 'Features — everything inside Sparx',
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
    siteName: 'Sparx',
    type: 'article',
    publishedTime: '2026-06-11T00:00:00.000Z',
    modifiedTime: '2026-06-11T00:00:00.000Z',
    authors: ['WizeWorks, Inc.'],
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: `${liveFloor}+ capabilities live across ${counts.modules} modules — one data layer, one bill. See everything Sparx does.`,
  },
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
