// Product tile for the PLP, collections, search, and "related" rails.
// Token-driven via the .st-tile classes in site.css so tenant theme
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
    <Link href={`/products/${product.handle}`} className="st-tile">
      <div className="st-tile__media">
        {onSale ? <span className="st-tile__badge st-tile__badge--sale">Sale</span> : null}
        {!product.inStock ? <span className="st-tile__badge st-tile__badge--out">Sold out</span> : null}
        {img ? (
          <Image
            src={img}
            alt={product.title}
            fill
            sizes="(max-width: 520px) 50vw, (max-width: 860px) 33vw, 230px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="st-tile__media st-tile__media--empty" aria-hidden="true">
            <span style={{ fontSize: '2rem' }}>◳</span>
          </div>
        )}
      </div>
      <div className="st-tile__body">
        {product.vendor ? <span className="st-tile__vendor">{product.vendor}</span> : null}
        <span className="st-tile__title">{product.title}</span>
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
    <span className="st-tile__price">
      {range}
      {compareAt != null ? (
        <span className="st-tile__compare">{formatMoney(compareAt, currency, locale)}</span>
      ) : null}
    </span>
  );
}
