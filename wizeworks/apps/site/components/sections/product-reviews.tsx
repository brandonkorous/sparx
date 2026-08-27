// Bound product section — the legacy (`sitebuilder-schemas`) way onto a product
// page. The reviews are server-fetched on the PDP and handed in via
// ctx.productExtras.reviews (same pattern as the Q&A section).
//
// The LOOK lives in `products/product-reviews-view.tsx`, shared with the silica
// host core, so the two builder generations cannot drift apart. This file is only
// about where the data comes from: an already-loaded list on the context.

import type { ProductReviewsConfig } from '@wizeworks/sitebuilder-schemas';

import { ProductReviewsView } from '@/components/products/product-reviews-view';
import type { SectionContext } from '../section-renderer';

export function ProductReviewsSection({
  config,
  ctx,
}: {
  config: ProductReviewsConfig;
  ctx: SectionContext;
}) {
  const product = ctx.product;
  if (!product) return null;

  const reviews = ctx.productExtras?.reviews;
  // Prefer the live list summary (always current) over the product's
  // denormalized columns; fall back to the product when the list didn't load.
  const total = reviews?.summary.total ?? product.reviewCount;
  const average = reviews?.summary.averageRating ?? product.averageRating ?? 0;

  return (
    <ProductReviewsView
      heading={config.heading}
      emptyText={config.emptyText}
      showForm={config.showForm}
      tenantSlug={ctx.tenantSlug}
      handle={product.handle}
      average={average}
      total={total}
      items={reviews?.items ?? []}
    />
  );
}
