// sparx.market homepage. Server component — hero, a featured-products strip, the
// category grid (MARKET_CATEGORIES), a top-merchants strip, and the "Sell on
// sparx.market" CTA. Catalog reads revalidate every 60s. Each strip degrades to
// nothing (homepage stays renderable) if its data is empty.

import Link from 'next/link';
import { ArrowRight, Store } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Button } from '@sparx/ui';

import { CategoryIcon } from '@/components/category-icon';
import { MerchantCard } from '@/components/merchant-card';
import { ProductGrid } from '@/components/product-grid';
import { listMerchants, listProducts, toMerchantCardData } from '@/lib/market';

export const revalidate = 60;

export default async function HomePage() {
  // Load the homepage strips in parallel. Each degrades to empty on failure so a
  // single slow/erroring strip never blanks the whole page.
  const [featured, merchants] = await Promise.all([
    listProducts({ featured: true, perPage: 8 }).catch(() => ({
      items: [],
      total: 0,
      page: 1,
      perPage: 8,
    })),
    listMerchants({ perPage: 6 }).catch(() => ({ items: [], total: 0, page: 1, perPage: 6 })),
  ]);

  return (
    <div className="mx-container">
      {/* Hero */}
      <section className="mx-section">
        <div className="mx-hero">
          <h1 className="mx-hero__title">
            Shop thousands of independent sellers, all in one place.
          </h1>
          <p className="mx-hero__lead">
            Real shops, real makers, shipped direct. Discover products you won’t find on the big
            marketplaces — from the sparx network of independent stores.
          </p>
          <div className="mx-hero__actions">
            <Button asChild color="primary" variant="solid" size="lg">
              <Link href="/products">
                Browse the marketplace
                <ArrowRight size={18} aria-hidden />
              </Link>
            </Button>
            <Button asChild color="neutral" variant="soft" size="lg">
              <Link href="/merchants">Meet the sellers</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured products */}
      {featured.items.length > 0 ? (
        <section className="mx-section">
          <div className="mx-section__head">
            <div>
              <h2 className="mx-section__title">Featured this week</h2>
              <p className="mx-section__sub">Hand-picked finds from across the marketplace.</p>
            </div>
            <Link href="/products?featured=true" className="mx-section__see-all">
              See all featured
            </Link>
          </div>
          <ProductGrid products={featured.items} />
        </section>
      ) : null}

      {/* Category grid */}
      <section className="mx-section">
        <div className="mx-section__head">
          <div>
            <h2 className="mx-section__title">Shop by category</h2>
            <p className="mx-section__sub">Every aisle, from auto parts to small-batch food.</p>
          </div>
        </div>
        <div className="mx-cat-grid">
          {MARKET_CATEGORIES.map((category) => (
            <Link key={category.slug} href={`/${category.slug}`} className="mx-cat-tile">
              <span className="mx-cat-tile__icon">
                <CategoryIcon name={category.icon} />
              </span>
              <span className="mx-cat-tile__name">{category.name}</span>
              <span className="mx-cat-tile__tagline">{category.tagline}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Top merchants */}
      {merchants.items.length > 0 ? (
        <section className="mx-section">
          <div className="mx-section__head">
            <div>
              <h2 className="mx-section__title">Top sellers</h2>
              <p className="mx-section__sub">Independent shops shipping direct on sparx.market.</p>
            </div>
            <Link href="/merchants" className="mx-section__see-all">
              View all merchants
            </Link>
          </div>
          <div className="mx-grid">
            {merchants.items.map((merchant) => (
              <MerchantCard key={merchant.slug} merchant={toMerchantCardData(merchant)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Sell CTA */}
      <section className="mx-section">
        <div className="mx-sell">
          <div>
            <h2 className="mx-sell__title">Sell on sparx.market</h2>
            <p className="mx-sell__lead">
              Already running a store on sparx? List your products on the marketplace in a click and
              reach shoppers across the whole network — sparx handles payment and payout.
            </p>
          </div>
          <Button asChild color="primary" variant="solid" size="lg">
            <Link href="/sell">
              <Store size={18} aria-hidden />
              Start selling
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
