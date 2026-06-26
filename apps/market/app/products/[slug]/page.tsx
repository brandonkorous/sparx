// Product detail page (PDP). Server-loads the listing, renders the gallery,
// price, rating, seller attribution, and the interactive variant selector +
// add-to-cart buy-box (the only client island). Emits Product JSON-LD and
// OG/meta from the listing. Revalidate 60.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { Badge } from '@sparx/ui';
import { marketCategoryLabel } from '@sparx/commerce-schemas';

import { AddToCart } from '@/components/add-to-cart';
import { SellerAttribution } from '@/components/seller-attribution';
import { Stars } from '@/components/stars';
import { getProduct } from '@/lib/market';
import { formatPriceRange } from '@/lib/format';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};

  const description =
    product.description?.slice(0, 200) ??
    `${product.title} from ${product.merchantName} on sparx.market.`;

  return {
    title: product.title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.title,
      description,
      url: `/products/${product.slug}`,
      ...(product.imageUrl ? { images: [{ url: product.imageUrl }] } : {}),
    },
    twitter: {
      card: product.imageUrl ? 'summary_large_image' : 'summary',
      title: product.title,
      description,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const price = formatPriceRange(product.priceMinCents, product.priceMaxCents, product.currency);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description ?? undefined,
    ...(product.imageUrl ? { image: [product.imageUrl] } : {}),
    brand: { '@type': 'Brand', name: product.merchantName },
    ...(product.reviewCount > 0 && product.averageRating != null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.averageRating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: product.currency,
      lowPrice: product.priceMinCents / 100,
      highPrice: product.priceMaxCents / 100,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: product.merchantName },
    },
  };

  return (
    <div className="mx-container mx-section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      {/* Breadcrumb trail */}
      <nav
        className="mb-6 text-sm"
        aria-label="Breadcrumb"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <Link href="/products" className="hover:underline">
          Products
        </Link>
        {product.category ? (
          <>
            <span aria-hidden> / </span>
            <Link href={`/${product.category}`} className="hover:underline">
              {marketCategoryLabel(product.category)}
            </Link>
          </>
        ) : null}
        <span aria-hidden> / </span>
        <span style={{ color: 'var(--color-text-primary)' }}>{product.title}</span>
      </nav>

      <div className="mx-pdp">
        {/* Gallery */}
        <div className="mx-pdp__media">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          ) : (
            <span className="mx-pdp__media--placeholder" aria-hidden>
              <ImageOff size={48} />
            </span>
          )}
        </div>

        {/* Buy column */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            {product.category ? (
              <Link href={`/${product.category}`}>
                <Badge color="primary" variant="soft">
                  {marketCategoryLabel(product.category)}
                </Badge>
              </Link>
            ) : null}
            <h1 className="mx-pdp__title">{product.title}</h1>
            <Stars rating={product.averageRating} reviewCount={product.reviewCount} />
          </div>

          <div className="flex items-center gap-3">
            {price ? <p className="mx-pdp__price">{price}</p> : null}
            {!product.inStock ? (
              <Badge color="danger" variant="soft">
                Sold out
              </Badge>
            ) : null}
          </div>

          <SellerAttribution
            merchantSlug={product.merchantSlug}
            merchantName={product.merchantName}
            merchantLogoUrl={product.merchantLogoUrl}
            storeUrl={product.productUrl}
          />

          <AddToCart
            merchantSlug={product.merchantSlug}
            merchantName={product.merchantName}
            variants={product.variants}
            currency={product.currency}
          />

          {product.description ? (
            <div
              className="flex flex-col gap-2 border-t pt-5"
              style={{ borderColor: 'var(--color-border-default)' }}
            >
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                About this product
              </h2>
              <p className="mx-pdp__desc">{product.description}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
