// Marketplace top chrome. A server component — no client state — rendering the
// sparx.market wordmark, the primary destination links (Products / Merchants),
// a cart entry, and the full market category taxonomy as a scannable strip.
//
// The category nav is driven by MARKET_CATEGORIES (the single source of truth in
// @sparx/commerce-schemas), so the header can never drift from the indexed
// category landing pages. On small screens the category strip is a horizontally
// scrollable row (mx-catbar) rather than a hamburger — the platform's responsive
// top-2 rule keeps the whole taxonomy reachable on mobile.

import Link from 'next/link';
import { ShoppingBag, Store, Tag } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Wordmark, Button } from '@sparx/ui';

export function SiteHeader() {
  return (
    <header className="mx-header">
      <div className="mx-container">
        <div className="mx-header__bar">
          <Link href="/" aria-label="sparx.market home" className="inline-flex items-baseline">
            <Wordmark size={22} />
            <span
              className="ml-0.5 text-sm font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              .market
            </span>
          </Link>

          {/* Primary destinations — kept beside the brand on wider screens. */}
          <nav className="mx-nav hidden md:flex" aria-label="Primary">
            <Link href="/products" className="mx-nav__link">
              <Tag size={15} aria-hidden />
              Products
            </Link>
            <Link href="/merchants" className="mx-nav__link">
              <Store size={15} aria-hidden />
              Merchants
            </Link>
          </nav>

          {/* Right rail: sell CTA + cart. Pushed to the far edge. */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              asChild
              color="primary"
              variant="soft"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link href="/sell">Sell on sparx.market</Link>
            </Button>
            <Button
              asChild
              color="neutral"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Cart"
            >
              <Link href="/cart">
                <ShoppingBag size={18} aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Category strip — its own row so the bar stays clean; scrolls on mobile. */}
      <div className="mx-catbar">
        <div className="mx-container">
          <nav className="mx-catbar__row" aria-label="Categories">
            <Link href="/products" className="mx-nav__link">
              All
            </Link>
            {MARKET_CATEGORIES.map((category) => (
              <Link key={category.slug} href={`/${category.slug}`} className="mx-nav__link">
                {category.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
