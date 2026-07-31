// Marketplace top chrome. A server component — no client state — rendering the
// sparx.market wordmark, an always-present prominent SEARCH bar (the marketplace
// signature; a plain GET form to /products, no JS needed — S3 adds autocomplete),
// the primary destinations, a cart entry, and the full category taxonomy strip.
//
// The category nav is driven by MARKET_CATEGORIES (the single source of truth in
// @sparx/commerce-schemas) so the header can never drift from the indexed category
// landing pages. On small screens the search moves to its own row and the category
// strip scrolls horizontally — the platform's responsive top-2 rule keeps the whole
// taxonomy reachable on mobile without a hamburger.

import Link from 'next/link';
import { Heart, ShoppingBag, Store, Tag } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Button } from '@wizeworks/silicaui-react';

import { Wordmark } from '@/components/sparx-brand';
import { SearchAutocomplete } from '@/components/search-autocomplete';
import { Container } from '@/components/ui/layout';

// Shared nav-link chrome (primary destinations + category strip).
const navLink =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-base-200';

export function SiteHeader() {
  return (
    <header className="border-base-300 bg-base-100/90 sticky top-0 z-50 border-b backdrop-blur-[8px] backdrop-saturate-[180%]">
      <Container>
        <div className="flex h-16 items-center gap-4 sm:gap-6">
          <Link
            href="/"
            aria-label="sparx.market home"
            className="inline-flex shrink-0 items-baseline"
          >
            <Wordmark size={22} />
            <span className="ml-0.5 text-sm font-medium">.market</span>
          </Link>

          {/* The search takes the middle and grows — the marketplace signature. */}
          <SearchAutocomplete className="hidden min-w-0 flex-1 sm:block" />

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link href="/products" className={`${navLink} hidden md:inline-flex`}>
              <Tag size={15} aria-hidden />
              Products
            </Link>
            <Link href="/merchants" className={`${navLink} hidden md:inline-flex`}>
              <Store size={15} aria-hidden />
              Shops
            </Link>
            {/* Hide below lg via max-lg:hidden ONLY — never set `display` on a
                silicaui Button (a utility-layer `inline-flex` overrides `.btn`'s
                own layout and breaks it). */}
            <Button
              render={<Link href="/sell" />}
              color="primary"
              variant="soft"
              size="sm"
              className="max-lg:hidden"
            >
              Sell on sparx.market
            </Button>
            <Button
              render={<Link href="/favorites" />}
              color="neutral"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Favorites"
            >
              <Heart size={18} aria-hidden />
            </Button>
            <Button
              render={<Link href="/cart" />}
              color="neutral"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Cart"
            >
              <ShoppingBag size={18} aria-hidden />
            </Button>
          </div>
        </div>

        {/* On the smallest screens the search gets its own row below the bar. */}
        <SearchAutocomplete className="pb-3 sm:hidden" />
      </Container>

      {/* Category strip — its own row so the bar stays clean; scrolls on mobile. */}
      <div className="border-base-300 bg-base-100 border-t">
        <Container>
          <nav
            className="flex h-11 [scrollbar-width:none] items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            aria-label="Categories"
          >
            <Link href="/products" className={navLink}>
              All
            </Link>
            {MARKET_CATEGORIES.map((category) => (
              <Link key={category.slug} href={`/${category.slug}`} className={navLink}>
                {category.name}
              </Link>
            ))}
          </nav>
        </Container>
      </div>
    </header>
  );
}
