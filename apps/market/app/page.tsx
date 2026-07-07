// sparx.market homepage — the discovery surface, merchandised like a real
// marketplace. Server component. Section sequence (top → bottom): a shoppable hero
// mosaic, a promo strip of curated edits, the photo category grid, a best-sellers
// rail, a featured-shop spotlight, a value ("under $25") rail, category-spotlight
// rails, a new-arrivals grid, recently-viewed personalization, featured sellers, a
// buyer-trust strip, and the sell CTA. Data loads in two parallel batches (the
// second depends on the first's picks). Every strip degrades to nothing if empty,
// so the page always renders. Solid fills only — color comes from the photography.

import { Flame, Sparkles, Tag } from 'lucide-react';
import { MARKET_CATEGORIES, marketCategoryLabel } from '@sparx/commerce-schemas';

import { HomeHero } from '@/components/home-hero';
import { PromoStrip, type PromoCardData } from '@/components/home-promos';
import { ShopSpotlight } from '@/components/shop-spotlight';
import { RecentlyViewed } from '@/components/recently-viewed';
import { SellCta } from '@/components/sell-cta';
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
  type MerchantSummary,
} from '@/lib/market';

export const revalidate = 60;

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
async function loadHomeData() {
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

  const heroProducts = (trending.length >= 5 ? trending : pool.items).slice(0, 8);
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
    heroProducts,
    categoryTiles,
    promos,
    spotlight,
    spotlightPage,
    catA,
    catAPage,
    catB,
    catBPage,
  };
}

export default async function HomePage() {
  const {
    trending,
    newArrivals,
    budget,
    merchants,
    heroProducts,
    categoryTiles,
    promos,
    spotlight,
    spotlightPage,
    catA,
    catAPage,
    catB,
    catBPage,
  } = await loadHomeData();

  return (
    <Container className="flex flex-col gap-12 py-8 md:gap-16 md:py-12">
      <HomeHero products={heroProducts} />

      <PromoStrip promos={promos} />

      {/* Shop by category */}
      <section>
        <SectionHeading
          title="Shop by category"
          sub="Every aisle, from the workshop to the pantry."
        />
        <CategoryTiles categories={categoryTiles} />
      </section>

      {/* Best sellers */}
      {trending.length > 0 ? (
        <section>
          <SectionHeading
            title="Best sellers"
            sub="The most-loved products across the marketplace right now."
            href="/products?sort=rating"
            linkLabel="See all"
          />
          <ProductRail products={trending} />
        </section>
      ) : null}

      {/* Featured shop spotlight */}
      {spotlight && spotlightPage.items.length >= 4 ? (
        <section>
          <SectionHeading
            title="Shop spotlight"
            sub="Meet an independent seller shipping direct on sparx.market."
          />
          <ShopSpotlight merchant={spotlight} products={spotlightPage.items} />
        </section>
      ) : null}

      {/* Great value */}
      {budget.items.length > 0 ? (
        <section>
          <SectionHeading
            title="Great finds under $25"
            sub="Standout products that won’t break the bank."
            href="/products?maxPrice=25&sort=rating"
            linkLabel="See all"
          />
          <ProductRail products={budget.items} />
        </section>
      ) : null}

      {/* Category spotlight A */}
      {catA && catAPage.items.length > 0 ? (
        <section>
          <SectionHeading
            title={`Top-rated in ${marketCategoryLabel(catA)}`}
            sub="Highest-rated picks from this aisle."
            href={`/${catA}`}
            linkLabel="Shop the aisle"
          />
          <ProductRail products={catAPage.items} />
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

      {/* Recently viewed — guest personalization; renders only with history. */}
      <RecentlyViewed />

      {/* Category spotlight B */}
      {catB && catBPage.items.length > 0 ? (
        <section>
          <SectionHeading
            title={`Top-rated in ${marketCategoryLabel(catB)}`}
            sub="Highest-rated picks from this aisle."
            href={`/${catB}`}
            linkLabel="Shop the aisle"
          />
          <ProductRail products={catBPage.items} />
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
            {merchants.items.slice(0, 6).map((merchant) => (
              <MerchantCard key={merchant.slug} merchant={toMerchantCardData(merchant)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Why shop sparx.market */}
      <TrustStrip />

      <SellCta />
    </Container>
  );
}
