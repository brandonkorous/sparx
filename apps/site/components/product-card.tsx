// Product tile for the PLP, collections, search, and "related" rails.
// Token-driven via the .st-card classes in site.css so tenant theme
// overrides flow through automatically.

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
    <Link href={`/products/${product.handle}`} className="st-card">
      <div className="st-card__media">
        {/* Inline badge + positioning utilities over the relative media — the badge
            stays a badge; the call site composes the corner placement. */}
        {onSale ? (
          <span className="st-badge st-badge--sale absolute top-3 left-3 z-10">Sale</span>
        ) : null}
        {!product.inStock ? (
          <span className="st-badge st-badge--out absolute top-3 left-3 z-10">Sold out</span>
        ) : null}
        {img ? (
          <Image
            src={img}
            alt={product.title}
            fill
            sizes="(max-width: 520px) 50vw, (max-width: 860px) 33vw, 230px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="st-card__media st-card__media--empty" aria-hidden="true">
            <span style={{ fontSize: '2rem' }}>◳</span>
          </div>
        )}
      </div>
      <div className="st-card__body">
        {product.vendor ? <span className="st-card__vendor">{product.vendor}</span> : null}
        <span className="st-card__title">{product.title}</span>
        {product.reviewCount > 0 && product.averageRating != null ? (
          <RatingStars rating={product.averageRating} count={product.reviewCount} compact />
        ) : null}
        <PriceLine
          min={product.priceMinCents}
          max={product.priceMaxCents}
          compareAt={onSale ? product.compareAtCents : null}
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
  currency,
  locale,
}: {
  min: number | null;
  max: number | null;
  compareAt: number | null;
  currency: string;
  locale: string;
}) {
  const range = formatPriceRange(min, max, currency, locale);
  if (!range) return null;
  return (
    <span className="st-card__price">
      {range}
      {compareAt != null ? (
        <span className="st-card__compare">{formatMoney(compareAt, currency, locale)}</span>
      ) : null}
    </span>
  );
}
