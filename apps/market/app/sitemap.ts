import type { MetadataRoute } from 'next';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';

import { listMerchantSlugs, listProductSlugs } from '@/lib/sitemap-data';
import { SITE_ORIGIN as BASE } from '@/lib/site';

// Static marketplace routes + one indexed landing page per market category +
// the live catalog (every product + merchant). The category list comes from
// MARKET_CATEGORIES (the single source of truth in @sparx/commerce-schemas), so
// the sitemap can never drift from the category pages that actually render. The
// catalog fan-out is best-effort: each slug read degrades to [] so the sitemap
// always ships at least its static routes.
//
// Revalidated daily (the catalog changes constantly but the sitemap doesn't need
// to be real-time).
export const revalidate = 86_400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [productSlugs, merchantSlugs] = await Promise.all([
    listProductSlugs(),
    listMerchantSlugs(),
  ]);

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE}/products`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE}/merchants`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    // Each market category is a real, indexed landing page (/auto /beauty /…).
    ...MARKET_CATEGORIES.map((category) => ({
      url: `${BASE}/${category.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    // The live catalog.
    ...productSlugs.map((slug) => ({
      url: `${BASE}/products/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...merchantSlugs.map((slug) => ({
      url: `${BASE}/merchants/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ];
}
