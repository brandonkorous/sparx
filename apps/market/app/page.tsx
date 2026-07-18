// sparx.market homepage — the discovery surface, merchandised like a real
// marketplace. Server component; PURE COMPOSITION — the data assembly lives in
// ./home-data (loadHomeData). The page alternates full-bleed colored bands (a pink
// hero with a real seller portrait, a warm maker-story band, a mood-first lifestyle
// trio, an Ember sell CTA) with contained white runs of product sections, so the
// long scroll reads as a rhythm rather than one flat wall. Every strip degrades to
// nothing if empty, so the page always renders. Solid fills only — no gradients.

import type { Metadata } from 'next';
import { marketCategoryLabel } from '@sparx/commerce-schemas';

import { HomeHero } from '@/components/home-hero';
import { PromoStrip } from '@/components/home-promos';
import { MakerStory } from '@/components/maker-story';
import { LifestyleTrio } from '@/components/lifestyle-trio';
import { ShopSpotlight } from '@/components/shop-spotlight';
import { RecentlyViewed } from '@/components/recently-viewed';
import { SellCta } from '@/components/sell-cta';
import { MerchantCard } from '@/components/merchant-card';
import { ProductGrid } from '@/components/product-grid';
import { CategoryTiles, ProductRail, SectionHeading, TrustStrip } from '@/components/home-sections';
import { Container } from '@/components/ui/layout';
import { toMerchantCardData } from '@/lib/market';
import { loadHomeData } from './home-data';

export const revalidate = 60;

// Consistent vertical rhythm for a contained (white) run of product sections
// between the full-bleed colored bands.
const FLOW_CLASS = 'flex flex-col gap-12 py-10 md:gap-16 md:py-14';

// The highest-value URL on the domain gets its own title + canonical rather than
// inheriting the layout defaults by accident. `title.absolute` opts out of the
// layout's `%s · sparx.market` template — the homepage title already names the
// site, so the template would render it twice.
export const metadata: Metadata = {
  title: { absolute: 'sparx.market — Shop thousands of independent sellers' },
  description:
    'Browse and buy from thousands of independent shops in one place. Real makers, shipped direct — discover products you won’t find on the big marketplaces.',
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const {
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
    productCount,
    sellerCount,
  } = await loadHomeData();

  // The page alternates full-bleed colored bands (hero, maker story, mood trio,
  // sell CTA) with contained white runs of product sections, so the long scroll
  // reads as a rhythm instead of one flat wall. Bands live OUTSIDE the container
  // (they set their own <Container> inside) so their color reaches the screen edge.
  return (
    <div className="flex flex-col">
      <HomeHero productCount={productCount} sellerCount={sellerCount} />

      <Container className={FLOW_CLASS}>
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
      </Container>

      {/* Band: the human story behind the listings. */}
      <MakerStory />

      <Container className={FLOW_CLASS}>
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
      </Container>

      {/* Band: a softer, mood-first way into the catalog. */}
      <LifestyleTrio />

      <Container className={FLOW_CLASS}>
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
      </Container>

      {/* Band: the closing seller pitch. */}
      <SellCta />
    </div>
  );
}
