// Product tile for the PLP, collections, search, and "related" rails.
// Token-driven via silica color/surface utilities so tenant theme overrides
// flow through automatically.

import Image from 'next/image';
import Link from 'next/link';

import { formatMoney, formatPriceRange } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import type { PublicProductListItem } from '@/lib/commerce';
import { RatingStars } from './rating-stars';

export interface ProductCardProps {
  product: PublicProductListItem;
  tenantSlug: string;
  currency?: string;
  locale?: string;
}

export function ProductCard({
  product,
  tenantSlug,
  currency = 'USD',
  locale = 'en-US',
}: ProductCardProps) {
  const img = mediaUrl(product.primaryImageId, tenantSlug);
  const onSale =
    product.compareAtCents != null &&
    product.priceMinCents != null &&
    product.compareAtCents > product.priceMinCents;

  return (
    <Link
      href={`/products/${product.handle}`}
      className="group rounded-box bg-base-100 text-base-content focus-visible:outline-primary relative flex flex-col overflow-hidden no-underline transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="bg-base-200 relative aspect-square overflow-hidden">
        {/* Inline badge + positioning utilities over the relative media — the badge
            stays a badge; the call site composes the corner placement. */}
        {onSale ? (
          <span className="badge badge-highlight absolute top-3 left-3 z-10">Sale</span>
        ) : null}
        {!product.inStock ? (
          <span className="badge badge-neutral absolute top-3 left-3 z-10">Sold out</span>
        ) : null}
        {img ? (
          <Image
            src={img}
            alt={product.title}
            fill
            sizes="(max-width: 520px) 50vw, (max-width: 860px) 33vw, 230px"
            className="object-cover transition-transform duration-[400ms] group-hover:scale-105"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div
            className="bg-base-200 text-base-content/40 grid h-full place-items-center text-4xl"
            aria-hidden="true"
          >
            ◳
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 px-1 pt-4 pb-2">
        {product.vendor ? (
          <span className="text-base-content text-xs tracking-wider uppercase">
            {product.vendor}
          </span>
        ) : null}
        <span className="text-base-content text-base leading-snug font-medium">
          {product.title}
        </span>
        {product.reviewCount > 0 && product.averageRating != null ? (
          <RatingStars rating={product.averageRating} count={product.reviewCount} compact />
        ) : null}
        <PriceLine
          min={product.priceMinCents}
          max={product.priceMaxCents}
          compareAt={onSale ? product.compareAtCents : null}
          yourPriceCents={product.yourPriceCents}
          currency={currency}
          locale={locale}
        />
      </div>
    </Link>
  );
}

function PriceLine({
  min,
  max,
  compareAt,
  yourPriceCents,
  currency,
  locale,
}: {
  min: number | null;
  max: number | null;
  compareAt: number | null;
  yourPriceCents: number | null;
  currency: string;
  locale: string;
}) {
  // A signed-in B2B customer's contract price outranks the normal range/sale
  // display — the retail price still shows, struck through, for reference.
  if (yourPriceCents != null) {
    return (
      <span className="text-base-content mt-0.5 text-sm font-semibold">
        Your price: {formatMoney(yourPriceCents, currency, locale)}
        {min != null ? (
          <span className="text-base-content ml-1.5 font-normal line-through">
            {formatMoney(min, currency, locale)}
          </span>
        ) : null}
      </span>
    );
  }
  const range = formatPriceRange(min, max, currency, locale);
  if (!range) return null;
  return (
    <span className="text-base-content mt-0.5 text-sm font-semibold">
      {range}
      {compareAt != null ? (
        <span className="text-base-content ml-1.5 font-normal line-through">
          {formatMoney(compareAt, currency, locale)}
        </span>
      ) : null}
    </span>
  );
}
