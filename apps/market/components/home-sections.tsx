// Presentational building blocks for the discovery home. Server components, pure —
// they take resolved data and compose silicaui-native layout (no bespoke mx-*). A
// section heading, a photo-driven category grid, a horizontally-scrollable product
// rail (CSS scroll-snap, no JS), and a trust/value-props strip.

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, PackageCheck, RotateCcw, ShieldCheck, Store } from 'lucide-react';

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

/** Resolved data for one category tile: identity + a representative product photo
 *  (from the live catalog) + the real listing count. */
export interface CategoryTileData {
  slug: string;
  name: string;
  icon: string;
  count: number;
  imageUrl: string | null;
  /** A token color name (`primary` | `secondary` | `info` | …) for the photoless
   *  fallback chip, so the grid isn't monotone before imagery loads. */
  color: string;
}

function categoryCountLabel(count: number): string {
  if (count <= 0) return 'Explore';
  return count === 1 ? '1 item' : `${count.toLocaleString()} items`;
}

/** The category grid — real product photography per aisle (the signature
 *  marketplace element), captioned with the live listing count. */
export function CategoryTiles({ categories }: { categories: CategoryTileData[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/${category.slug}`}
          className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--sparx-primary)_45%,var(--color-border-default))] hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.28)]"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-bg-subtle)]">
            {category.imageUrl ? (
              <Image
                src={category.imageUrl}
                alt={category.name}
                fill
                sizes="(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.05]"
              />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center"
                style={{
                  color: `var(--color-${category.color})`,
                  background: `color-mix(in oklch, var(--color-${category.color}) 12%, var(--color-bg-subtle))`,
                }}
                aria-hidden
              >
                <CategoryIcon name={category.icon} />
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-3.5 py-3">
            <div className="min-w-0">
              <span className="block truncate text-base font-semibold text-[var(--color-text-primary)]">
                {category.name}
              </span>
              <span className="block text-[0.8125rem] text-[var(--color-text-secondary)]">
                {categoryCountLabel(category.count)}
              </span>
            </div>
            <ArrowRight
              size={16}
              aria-hidden
              className="shrink-0 text-[var(--color-text-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--sparx-primary)]"
            />
          </div>
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

// The buyer-trust promises. Each carries its own hue (by function, not decoration)
// so the strip reads as a set of distinct guarantees rather than one flat wash.
const TRUST_ITEMS = [
  {
    icon: Store,
    color: 'primary',
    title: 'Independent sellers',
    text: 'Every shop is a real, verified maker — never a faceless reseller.',
  },
  {
    icon: ShieldCheck,
    color: 'success',
    title: 'Secure checkout',
    text: 'Pay once, safely. sparx handles payment and protects every order.',
  },
  {
    icon: PackageCheck,
    color: 'info',
    title: 'Ships direct',
    text: 'Straight from the seller to your door, with tracking on every parcel.',
  },
  {
    icon: RotateCcw,
    color: 'secondary',
    title: 'Easy returns',
    text: 'Changed your mind? Returns are backed by the sparx guarantee.',
  },
] as const;

/** The buyer-confidence strip — marketplace credibility, in the platform palette. */
export function TrustStrip() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TRUST_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.title}
            className="flex gap-3.5 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4"
          >
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{
                color: `var(--color-${item.color})`,
                background: `color-mix(in oklch, var(--color-${item.color}) 12%, var(--color-bg-surface))`,
              }}
              aria-hidden
            >
              <Icon size={20} />
            </span>
            <div>
              <p className="text-[0.9375rem] font-semibold text-[var(--color-text-primary)]">
                {item.title}
              </p>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-[var(--color-text-secondary)]">
                {item.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
