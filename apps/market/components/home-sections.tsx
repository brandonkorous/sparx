// Presentational building blocks for the discovery home. Server components, pure —
// they take resolved data and compose silicaui-native layout (no bespoke mx-*). A
// section heading, the category tile grid, and a horizontally-scrollable product
// rail (the "carousel" — CSS scroll-snap, no JS, works on every breakpoint).

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';

import { CategoryIcon } from '@/components/category-icon';
import { ProductCard } from '@/components/product-card';
import { toProductCardData, type ListingCard } from '@/lib/market';

/** A section header row: title + optional subhead + optional "see all" link. */
export function SectionHeading({
  title,
  sub,
  href,
  linkLabel,
}: {
  title: string;
  sub?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--color-text-primary)] md:text-[1.75rem]">
          {title}
        </h2>
        {sub ? (
          <p className="mt-1.5 text-[0.9375rem] text-[var(--color-text-secondary)]">{sub}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium whitespace-nowrap text-[var(--sparx-primary)] hover:underline"
        >
          {linkLabel ?? 'See all'}
          <ArrowRight size={15} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

/** The category tile grid (homepage). Solid module-tint icon chips — no gradients. */
export function CategoryTiles() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {MARKET_CATEGORIES.map((category) => (
        <Link
          key={category.slug}
          href={`/${category.slug}`}
          className="group flex flex-col gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--sparx-primary)_45%,var(--color-border-default))] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)]"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--sparx-primary)_12%,var(--color-bg-subtle))] text-[var(--sparx-primary)]">
            <CategoryIcon name={category.icon} />
          </span>
          <span className="text-base font-semibold text-[var(--color-text-primary)]">
            {category.name}
          </span>
          <span className="text-[0.8125rem] leading-snug text-[var(--color-text-secondary)]">
            {category.tagline}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** A horizontally-scrollable product rail (scroll-snap "carousel"). */
export function ProductRail({ products }: { products: ListingCard[] }) {
  if (products.length === 0) return null;
  return (
    <div className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {products.map((product) => (
        <div key={product.slug} className="w-[220px] shrink-0 snap-start sm:w-[240px]">
          <ProductCard product={toProductCardData(product)} />
        </div>
      ))}
    </div>
  );
}
