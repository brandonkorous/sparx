// Presentational marketplace product card. Pure — it takes fully-resolved props
// (the data layer resolves media URLs + price range before handing them here)
// and fetches nothing. Renders the product image, title, seller, price range,
// and an out-of-stock affordance, linking to the product detail route.

import Link from 'next/link';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { Badge } from '@sparx/ui';
import { formatPriceRange } from '@/lib/format';

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
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const price = formatPriceRange(product.priceMinCents, product.priceMaxCents, product.currency);

  return (
    <article className="mx-card">
      <Link
        href={`/products/${product.slug}`}
        className="mx-card__media"
        aria-label={product.title}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          <span className="mx-card__media--placeholder" aria-hidden>
            <ImageOff size={28} />
          </span>
        )}
        {!product.inStock ? (
          <span className="absolute top-2 left-2">
            <Badge color="neutral" variant="soft">
              Sold out
            </Badge>
          </span>
        ) : null}
      </Link>

      <div className="mx-card__body">
        <Link href={`/products/${product.slug}`} className="mx-card__title">
          {product.title}
        </Link>
        <Link
          href={`/merchants/${product.merchantSlug}`}
          className="mx-card__meta transition-colors hover:underline"
        >
          {product.merchantName}
        </Link>
        {price ? <p className="mx-card__price">{price}</p> : null}
      </div>
    </article>
  );
}
