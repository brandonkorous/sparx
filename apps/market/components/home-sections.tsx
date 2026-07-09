// Presentational building blocks for the discovery home. Server components, pure —
// they take resolved data and compose silicaui-native layout (no bespoke mx-*). A
// section heading, a photo-driven category grid, a horizontally-scrollable product
// rail (CSS scroll-snap, no JS), and a trust/value-props strip.

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, PackageCheck, RotateCcw, ShieldCheck, Store } from 'lucide-react';
import { Card } from '@wizeworks/silicaui-react';

import { CategoryIcon } from '@/components/category-icon';
import { ProductCard } from '@/components/product-card';
import { LinkCard } from '@/components/ui/card';
import { tintChip } from '@/lib/hue';
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
        <h2 className="text-base-content text-2xl font-semibold tracking-[-0.01em] md:text-[1.75rem]">
          {title}
        </h2>
        {sub ? <p className="text-base-content/70 mt-1.5 text-[0.9375rem]">{sub}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium whitespace-nowrap hover:underline"
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
        <LinkCard
          key={category.slug}
          href={`/${category.slug}`}
          ariaLabel={category.name}
          className="rounded-xl"
        >
          <div className="bg-base-200 relative aspect-[4/3] overflow-hidden">
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
                className={`flex h-full w-full items-center justify-center ${tintChip(category.color)}`}
                aria-hidden
              >
                <CategoryIcon name={category.icon} />
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-3.5 py-3">
            <div className="min-w-0">
              <span className="text-base-content block truncate text-base font-semibold">
                {category.name}
              </span>
              <span className="text-base-content/70 block text-[0.8125rem]">
                {categoryCountLabel(category.count)}
              </span>
            </div>
            <ArrowRight
              size={16}
              aria-hidden
              className="text-base-content/50 group-hover:text-primary shrink-0 transition-all group-hover:translate-x-0.5"
            />
          </div>
        </LinkCard>
      ))}
    </div>
  );
}

/** A horizontally-scrollable, scroll-snap "carousel" track. Shared by the product
 *  rails (home strips, category spotlights, recently-viewed). Each child should be
 *  a fixed-width rail item (use RAIL_ITEM_CLASS). */
export function ScrollRail({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

/** Fixed-width rail cell — keeps every rail's card width identical. */
export const RAIL_ITEM_CLASS = 'w-[220px] shrink-0 snap-start sm:w-[240px]';

/** A horizontally-scrollable product rail (scroll-snap "carousel"). */
export function ProductRail({ products }: { products: ListingCard[] }) {
  if (products.length === 0) return null;
  return (
    <ScrollRail>
      {products.map((product) => (
        <div key={product.slug} className={RAIL_ITEM_CLASS}>
          <ProductCard product={toProductCardData(product)} />
        </div>
      ))}
    </ScrollRail>
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
          <Card key={item.title} className="flex-row gap-3.5 p-4">
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tintChip(item.color)}`}
              aria-hidden
            >
              <Icon size={20} />
            </span>
            <div>
              <p className="text-base-content text-[0.9375rem] font-semibold">{item.title}</p>
              <p className="text-base-content/70 mt-0.5 text-[0.8125rem] leading-snug">
                {item.text}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
