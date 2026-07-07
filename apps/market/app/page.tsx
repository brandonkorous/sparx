// sparx.market homepage — the discovery surface. Server component, merchandised
// like a real marketplace: a shoppable hero mosaic of live products, a photo-driven
// category grid, a "Trending now" rail, a new-arrivals grid, featured sellers, a
// buyer-trust strip, and the "Sell on sparx.market" CTA. Catalog reads revalidate
// every 60s; each strip degrades to nothing (the page stays renderable) if its data
// is empty. Solid fills only — the color comes from the product photography.

import Link from 'next/link';
import { Store } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Button } from 'silicaui-react';

import { HomeHero } from '@/components/home-hero';
import { MerchantCard } from '@/components/merchant-card';
import { ProductGrid } from '@/components/product-grid';
import {
  CategoryTiles,
  ProductRail,
  SectionHeading,
  TrustStrip,
  type CategoryTileData,
} from '@/components/home-sections';
import { Container } from '@/components/ui/layout';
import {
  listFacets,
  listMerchants,
  listProducts,
  listTrending,
  toMerchantCardData,
  type ListingCard,
} from '@/lib/market';

export const revalidate = 60;

const emptyPage = { items: [], total: 0, page: 1, perPage: 0 };
const emptyFacets = { categories: [], inStockCount: 0, total: 0 };

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

export default async function HomePage() {
  // Load the homepage data in parallel. Each degrades to empty on failure so a
  // single slow/erroring source never blanks the whole page.
  const [trending, pool, newArrivals, merchants, facets] = await Promise.all([
    listTrending(10).catch(() => []),
    listProducts({ sort: 'rating', perPage: 48, inStock: true }).catch(() => emptyPage),
    listProducts({ sort: 'newest', perPage: 12 }).catch(() => emptyPage),
    listMerchants({ perPage: 6 }).catch(() => emptyPage),
    listFacets().catch(() => emptyFacets),
  ]);

  const heroProducts = (trending.length >= 5 ? trending : pool.items).slice(0, 8);
  const categoryTiles = buildCategoryTiles(facets.categories, pool.items);

  return (
    <Container className="flex flex-col gap-12 py-8 md:gap-16 md:py-12">
      <HomeHero products={heroProducts} />

      {/* Shop by category */}
      <section>
        <SectionHeading
          title="Shop by category"
          sub="Every aisle, from the workshop to the pantry."
        />
        <CategoryTiles categories={categoryTiles} />
      </section>

      {/* Trending now */}
      {trending.length > 0 ? (
        <section>
          <SectionHeading
            title="Trending now"
            sub="The most-loved products across the marketplace right now."
            href="/products?sort=rating"
            linkLabel="See all"
          />
          <ProductRail products={trending} />
        </section>
      ) : null}

      {/* New arrivals */}
      {newArrivals.items.length > 0 ? (
        <section>
          <SectionHeading
            title="New arrivals"
            sub="Just listed by sellers across the sparx network."
            href="/products?sort=newest"
            linkLabel="See all new"
          />
          <ProductGrid products={newArrivals.items} />
        </section>
      ) : null}

      {/* Featured sellers */}
      {merchants.items.length > 0 ? (
        <section>
          <SectionHeading
            title="Featured sellers"
            sub="Independent shops shipping direct on sparx.market."
            href="/merchants"
            linkLabel="View all sellers"
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {merchants.items.map((merchant) => (
              <MerchantCard key={merchant.slug} merchant={toMerchantCardData(merchant)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Why shop sparx.market */}
      <TrustStrip />

      {/* Sell CTA — solid surface, no gradient. */}
      <section className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-8 md:flex-row md:items-center md:p-12">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.01em] text-[var(--color-text-primary)]">
            Sell on sparx.market
          </h2>
          <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
            Already running a store on sparx? List your products on the marketplace in a click and
            reach shoppers across the whole network — sparx handles payment and payout.
          </p>
        </div>
        <Button render={<Link href="/sell" />} color="primary" variant="solid" size="lg">
          <Store size={18} aria-hidden />
          Start selling
        </Button>
      </section>
    </Container>
  );
}
