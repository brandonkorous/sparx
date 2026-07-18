// Product detail page (PDP). Server-loads the listing, renders the gallery,
// price, rating, seller attribution, and the interactive variant selector +
// add-to-cart buy-box (the only client island). Emits Product JSON-LD and
// OG/meta from the listing. Revalidate 60.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@wizeworks/silicaui-react';
import { marketCategoryLabel } from '@sparx/commerce-schemas';

import { AddToCart } from '@/components/add-to-cart';
import { RecordView } from '@/components/record-view';
import { SellerAttribution } from '@/components/seller-attribution';
import { ProductGallery } from '@/components/product-gallery';
import { ProductReviews } from '@/components/product-reviews';
import { ProductQA } from '@/components/product-qa';
import { ProductGrid } from '@/components/product-grid';
import { Stars } from '@/components/stars';
import { Container } from '@/components/ui/layout';
import {
  getProduct,
  getProductReviews,
  getProductQuestions,
  getRelatedProducts,
} from '@/lib/market';
import { formatPriceRange } from '@/lib/format';
import { SITE_ORIGIN } from '@/lib/site';

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

  // PDP depth loads alongside the listing; a failure in any one degrades to empty
  // rather than 500ing the whole page.
  const [reviewsResult, questions, related] = await Promise.all([
    getProductReviews(slug).catch(() => null),
    getProductQuestions(slug).catch(() => []),
    getRelatedProducts(slug).catch(() => []),
  ]);

  const reviewSummary = reviewsResult?.summary ?? {
    averageRating: product.averageRating ?? 0,
    total: product.reviewCount,
  };
  const reviewItems = reviewsResult?.items ?? [];

  const price = formatPriceRange(product.priceMinCents, product.priceMaxCents, product.currency);
  const galleryUrls =
    product.images.length > 0
      ? product.images.map((i) => i.url)
      : product.imageUrl
        ? [product.imageUrl]
        : [];

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description ?? undefined,
    ...(galleryUrls.length > 0 ? { image: galleryUrls } : {}),
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

  // Mirrors the visual trail below exactly — Google requires the markup to match
  // what the page actually shows. `item` must be an ABSOLUTE URL; a relative path
  // invalidates the entry. The final crumb (this product) deliberately carries no
  // `item`: the current page is not a link to itself.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Products', item: `${SITE_ORIGIN}/products` },
      ...(product.category
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: marketCategoryLabel(product.category),
              item: `${SITE_ORIGIN}/${product.category}`,
            },
          ]
        : []),
      { '@type': 'ListItem', position: product.category ? 3 : 2, name: product.title },
    ],
  };

  return (
    <Container className="py-8 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <RecordView slug={product.slug} />

      {/* Breadcrumb trail */}
      <nav className="text-base-content mb-6 text-sm" aria-label="Breadcrumb">
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
        <span className="text-base-content">{product.title}</span>
      </nav>

      {/* Top: gallery + buy column */}
      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <ProductGallery
          images={product.images}
          fallbackUrl={product.imageUrl}
          title={product.title}
        />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            {product.category ? (
              <Link href={`/${product.category}`}>
                <Badge color="primary" variant="soft">
                  {marketCategoryLabel(product.category)}
                </Badge>
              </Link>
            ) : null}
            <h1 className="text-base-content text-2xl font-semibold md:text-3xl">
              {product.title}
            </h1>
            <Stars rating={product.averageRating} reviewCount={product.reviewCount} />
          </div>

          <div className="flex items-center gap-3">
            {price ? <p className="text-base-content text-2xl font-semibold">{price}</p> : null}
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
        </div>
      </div>

      {/* Below the fold: description, reviews, Q&A, related — stacked full-width. */}
      <div className="mt-12 flex flex-col gap-12">
        {product.description ? (
          <section aria-labelledby="about-heading" className="flex flex-col gap-3">
            <h2 id="about-heading" className="text-base-content text-xl font-semibold">
              About this product
            </h2>
            <p className="text-base-content max-w-3xl leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </section>
        ) : null}

        <ProductReviews slug={slug} summary={reviewSummary} reviews={reviewItems} />

        <ProductQA slug={slug} questions={questions} />

        {related.length > 0 ? (
          <section aria-labelledby="related-heading" className="flex flex-col gap-5">
            <h2 id="related-heading" className="text-base-content text-xl font-semibold">
              You may also like
            </h2>
            <ProductGrid products={related} />
          </section>
        ) : null}
      </div>
    </Container>
  );
}
