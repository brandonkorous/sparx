// Social card for a marketplace listing detail page.
//
// This exists because generateMetadata previously set `openGraph.images` to the
// listing's own media URL. That override REPLACES Next's file-based card
// convention, and those media assets are arbitrary-dimension CDN uploads with no
// og:image:width / og:image:height / og:image:type emitted alongside them.
// LinkedIn is strict here — it requires the dimension tags and enforces a 200×200
// floor — so a portrait or small listing photo was dropped outright, leaving the
// share with no image at all.
//
// Rendering the card ourselves guarantees a valid 1200×630 PNG with the correct
// metadata for every listing, and keeps marketplace shares visually consistent
// with the rest of the marketing site. `nodejs` (not `edge`) so it is a buffered
// response with a real Content-Length — see app/opengraph-image.tsx.

import { renderSimpleOg, OG_SIZE } from '@/lib/og-simple';
import { fetchListing } from '@/lib/marketplace';
import { getCategory } from '@/lib/marketplace-registry';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'sparx Marketplace';

// Match the page's own revalidate so a renamed listing's card doesn't lag its page.
export const revalidate = 300;

export default async function Image({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const [item, cat] = [await fetchListing(category, slug), getCategory(category)];

  // A missing listing still has to produce an image — returning nothing would
  // surface as a broken card rather than a generic one.
  const title = item?.name ?? 'sparx Marketplace';
  const subtitle = item?.tagline ?? item?.description ?? undefined;

  return renderSimpleOg({
    tag: (cat?.label ?? 'Marketplace').toUpperCase(),
    accent: cat?.accent ?? '#6366f1',
    title,
    subtitle,
    footerLeft: item ? `by ${item.publisher.displayName}` : undefined,
    footerRight: 'sparx.works/market',
  });
}
