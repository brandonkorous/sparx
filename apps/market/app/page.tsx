// sparx.market homepage — the discovery surface. Server component: a hero with
// category quick-links, a "Trending now" scroll rail, the category tile grid, a
// new-arrivals grid, a featured-sellers strip, and the "Sell on sparx.market" CTA.
// Catalog reads revalidate every 60s; each strip degrades to nothing (the page
// stays renderable) if its data is empty. Solid fills only — no gradients.

import Link from 'next/link';
import { ArrowRight, Store } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Button } from 'silicaui-react';

import { MerchantCard } from '@/components/merchant-card';
import { ProductGrid } from '@/components/product-grid';
import { CategoryTiles, ProductRail, SectionHeading } from '@/components/home-sections';
import { Container } from '@/components/ui/layout';
import { listMerchants, listProducts, listTrending, toMerchantCardData } from '@/lib/market';

export const revalidate = 60;

const emptyPage = { items: [], total: 0, page: 1, perPage: 0 };

export default async function HomePage() {
  // Load the homepage strips in parallel. Each degrades to empty on failure so a
  // single slow/erroring strip never blanks the whole page.
  const [trending, newArrivals, merchants] = await Promise.all([
    listTrending(12).catch(() => []),
    listProducts({ sort: 'newest', perPage: 8 }).catch(() => emptyPage),
    listMerchants({ perPage: 6 }).catch(() => emptyPage),
  ]);

  return (
    <Container className="flex flex-col gap-14 py-10 md:gap-20 md:py-14">
      {/* Hero — solid surface, no gradient. */}
      <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-12 md:px-12 md:py-16">
        <h1 className="max-w-2xl text-[2rem] leading-[1.05] font-bold tracking-[-0.03em] text-[var(--color-text-primary)] md:text-[3.25rem]">
          Thousands of independent sellers, one marketplace.
        </h1>
        <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-[var(--color-text-secondary)]">
          Real shops, real makers, shipped direct. Discover products you won’t find on the big
          marketplaces — from the sparx network of independent stores.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button render={<Link href="/products" />} color="primary" variant="solid" size="lg">
            Browse the marketplace
            <ArrowRight size={18} aria-hidden />
          </Button>
          <Button render={<Link href="/merchants" />} color="neutral" variant="soft" size="lg">
            Meet the sellers
          </Button>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {MARKET_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/${category.slug}`}
              className="rounded-full border border-[var(--color-border-default)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
            >
              {category.name}
            </Link>
          ))}
        </div>
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

      {/* Shop by category */}
      <section>
        <SectionHeading
          title="Shop by category"
          sub="Every aisle, from auto parts to small-batch food."
        />
        <CategoryTiles />
      </section>

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
