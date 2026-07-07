// Presentational marketplace product card. Pure — it takes fully-resolved props
// (the data layer resolves media URLs + price range before handing them here)
// and fetches nothing. Renders on a silicaui <Card>: product image, a corner
// promo/stock badge (sold-out / bestseller / featured), title, seller, star
// rating, price range, and a low-stock urgency cue — linking to the PDP.

import Link from 'next/link';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { Badge, type BadgeColor, type BadgeVariant, Card } from 'silicaui-react';
import { cx } from 'silicaui-react/server';

import { formatPriceRange } from '@/lib/format';
import { Stars } from '@/components/stars';
import { FavoriteButton } from '@/components/favorite-button';
import { INTERACTIVE_CARD_CLASS } from '@/components/ui/card';

export interface ProductCardData {
  slug: string;
  title: string;
  /** Fully-resolved image URL (already run through media resolution), or null. */
  imageUrl: string | null;
  priceMinCents: number;
  priceMaxCents: number;
  currency: string;
  merchantName: string;
  merchantSlug: string;
  inStock: boolean;
  averageRating: number | null;
  reviewCount: number;
  bestSellerRank: number | null;
  lowStock: boolean;
  featured: boolean;
}

// A product ranked in the tenant's top dozen wears the "Bestseller" flag.
const BEST_SELLER_BADGE_MAX = 12;

/** The single corner badge — the strongest signal wins (stock beats promo). */
function cornerBadge(
  p: ProductCardData
): { label: string; color: BadgeColor; variant: BadgeVariant } | null {
  if (!p.inStock) return { label: 'Sold out', color: 'neutral', variant: 'soft' };
  if (p.bestSellerRank != null && p.bestSellerRank <= BEST_SELLER_BADGE_MAX) {
    return { label: 'Bestseller', color: 'warning', variant: 'solid' };
  }
  if (p.featured) return { label: 'Featured', color: 'primary', variant: 'solid' };
  return null;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const price = formatPriceRange(product.priceMinCents, product.priceMaxCents, product.currency);
  const badge = cornerBadge(product);

  return (
    <Card className={cx('group', INTERACTIVE_CARD_CLASS)}>
      <FavoriteButton
        slug={product.slug}
        title={product.title}
        size={16}
        className="absolute top-2 right-2 z-10"
      />
      <Link
        href={`/products/${product.slug}`}
        aria-label={product.title}
        className="bg-base-200 relative block aspect-square overflow-hidden"
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span
            className="text-base-content/50 flex h-full w-full items-center justify-center"
            aria-hidden
          >
            <ImageOff size={28} />
          </span>
        )}
        {badge ? (
          <span className="absolute top-2 left-2">
            <Badge color={badge.color} variant={badge.variant} size="sm">
              {badge.label}
            </Badge>
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Link
          href={`/products/${product.slug}`}
          className="text-base-content group-hover:text-primary line-clamp-2 text-[0.9375rem] leading-tight font-semibold transition-colors"
        >
          {product.title}
        </Link>
        <Link
          href={`/merchants/${product.merchantSlug}`}
          className="text-base-content/70 text-[0.8125rem] transition-colors hover:underline"
        >
          {product.merchantName}
        </Link>
        <Stars rating={product.averageRating} reviewCount={product.reviewCount} size={13} compact />
        <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
          {price ? (
            <p className="text-base-content text-[0.9375rem] font-semibold">{price}</p>
          ) : (
            <span />
          )}
          {product.inStock && product.lowStock ? (
            <span className="text-warning text-[0.75rem] font-medium">Only a few left</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
