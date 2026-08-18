// Data assembly for the sparx.market homepage. Loads everything the discovery
// surface renders, in two parallel batches — the second depends on the first's
// picks (the spotlight seller + the top categories). Every read degrades to empty
// on failure so the page always renders. Kept separate from page.tsx so the page
// file is pure composition (what renders where) and this is the "what data" layer.

import { Flame, Sparkles, Tag } from 'lucide-react';
import { MARKET_CATEGORIES } from '@wizeworks/commerce-schemas';

import type { PromoCardData } from '@/components/home-promos';
import type { CategoryTileData } from '@/components/home-sections';
import {
  listFacets,
  listMerchants,
  listProducts,
  listTrending,
  type ListingCard,
  type MerchantSummary,
} from '@/lib/market';

const emptyPage = { items: [] as ListingCard[], total: 0, page: 1, perPage: 0 };
const emptyMerchantPage = { items: [] as MerchantSummary[], total: 0, page: 1, perPage: 0 };
const emptyFacets = {
  categories: [] as { slug: string; count: number }[],
  inStockCount: 0,
  total: 0,
};

// A distinct hue per aisle (used only for the photoless fallback chip) so the
// category grid never reads as a monotone wall before imagery resolves.
const CATEGORY_COLORS: Record<string, string> = {
  auto: 'info',
  beauty: 'secondary',
  home: 'success',
  fashion: 'accent',
  food: 'warning',
  tech: 'primary',
  general: 'neutral',
};

/** Build the category tiles: real per-aisle listing counts (facets) + a
 *  representative product photo pulled from the top-rated catalog pool. */
function buildCategoryTiles(
  facetCounts: { slug: string; count: number }[],
  pool: ListingCard[]
): CategoryTileData[] {
  const countBySlug = new Map(facetCounts.map((c) => [c.slug, c.count]));
  const imageBySlug = new Map<string, string>();
  for (const p of pool) {
    if (p.category && p.imageUrl && !imageBySlug.has(p.category)) {
      imageBySlug.set(p.category, p.imageUrl);
    }
  }
  return MARKET_CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    count: countBySlug.get(c.slug) ?? 0,
    imageUrl: imageBySlug.get(c.slug) ?? null,
    color: CATEGORY_COLORS[c.slug] ?? 'neutral',
  }));
}

/** The three curated promo edits — each a real deep-link into a filtered PLP view,
 *  with a representative photo from the slice it links to. */
function buildPromos(
  trending: ListingCard[],
  newArrivals: ListingCard[],
  budget: ListingCard[]
): PromoCardData[] {
  const firstImage = (list: ListingCard[]) => list.find((p) => p.imageUrl)?.imageUrl ?? null;
  return [
    {
      label: 'Best sellers',
      sub: 'The most-loved products across the marketplace.',
      href: '/products?sort=rating',
      imageUrl: firstImage(trending),
      icon: Flame,
      color: 'warning',
    },
    {
      label: 'New this week',
      sub: 'Fresh arrivals from sellers across the network.',
      href: '/products?sort=newest',
      imageUrl: firstImage(newArrivals),
      icon: Sparkles,
      color: 'info',
    },
    {
      label: 'Great finds under $25',
      sub: 'Standout products that won’t break the bank.',
      href: '/products?maxPrice=25&sort=rating',
      imageUrl: firstImage(budget),
      icon: Tag,
      color: 'success',
    },
  ];
}

/** Pick the seller to spotlight: the first with a banner (best visual), else the
 *  first featured seller. */
function pickSpotlight(merchants: MerchantSummary[]): MerchantSummary | null {
  return merchants.find((m) => m.bannerUrl) ?? merchants[0] ?? null;
}

/** Top categories by live listing count, for the category-spotlight rails. */
function topCategorySlugs(facetCounts: { slug: string; count: number }[], take: number): string[] {
  return [...facetCounts]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, take)
    .map((c) => c.slug);
}

/** Load everything the home page renders, in two parallel batches — the second
 *  depends on the first's picks (spotlight seller + top categories). Each read
 *  degrades to empty on failure so the page always renders. */
export async function loadHomeData() {
  const [trending, pool, newArrivals, budget, merchants, facets] = await Promise.all([
    listTrending(12).catch(() => []),
    listProducts({ sort: 'rating', perPage: 48, inStock: true }).catch(() => emptyPage),
    listProducts({ sort: 'newest', perPage: 12 }).catch(() => emptyPage),
    listProducts({ sort: 'rating', maxPriceCents: 2500, perPage: 12, inStock: true }).catch(
      () => emptyPage
    ),
    listMerchants({ perPage: 12 }).catch(() => emptyMerchantPage),
    listFacets().catch(() => emptyFacets),
  ]);

  const categoryTiles = buildCategoryTiles(facets.categories, pool.items);
  const promos = buildPromos(trending, newArrivals.items, budget.items);
  const spotlight = pickSpotlight(merchants.items);
  const [catA, catB] = topCategorySlugs(facets.categories, 2);

  const [spotlightPage, catAPage, catBPage] = await Promise.all([
    spotlight
      ? listProducts({ merchant: spotlight.slug, sort: 'rating', perPage: 4 }).catch(
          () => emptyPage
        )
      : Promise.resolve(emptyPage),
    catA
      ? listProducts({ category: catA, sort: 'rating', perPage: 8 }).catch(() => emptyPage)
      : Promise.resolve(emptyPage),
    catB
      ? listProducts({ category: catB, sort: 'rating', perPage: 8 }).catch(() => emptyPage)
      : Promise.resolve(emptyPage),
  ]);

  return {
    trending,
    newArrivals,
    budget,
    merchants,
    categoryTiles,
    promos,
    spotlight,
    spotlightPage,
    catA,
    catAPage,
    catB,
    catBPage,
    // Real trust stats for the hero — the whole-catalog + whole-network counts.
    productCount: facets.total,
    sellerCount: merchants.total,
  };
}
