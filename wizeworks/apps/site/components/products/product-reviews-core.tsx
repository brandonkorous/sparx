// The `commerce.product-reviews` host core — reviews on a silica-authored product
// page.
//
// A host core rather than a bound node tree because reviews are a TRANSACTION, not
// a read: a shopper types into a form and posts to the API, and the list that comes
// back is moderated server-side. Binding refs can draw the list; they cannot carry
// the form, and a review section without one is a wall a customer cannot write on.
//
// It fetches its own reviews from the handle the route puts in scope, because a host
// core cannot read the URL and the PDP route already knows which product it resolved.
// `listProductReviews` degrades to an empty list rather than throwing, so a reviews
// service having a bad afternoon leaves the product page intact (issue 253's rule).

import { listProductReviews } from '@/lib/commerce';
import { ProductReviewsView } from '@/components/products/product-reviews-view';

export interface ProductReviewsCoreProps {
  tenantSlug: string;
  /** The in-scope product's URL handle, from the route's record context. */
  handle: string;
  heading: string;
  emptyText: string;
  showForm: boolean;
}

export async function ProductReviewsCore({
  tenantSlug,
  handle,
  heading,
  emptyText,
  showForm,
}: ProductReviewsCoreProps) {
  // No handle means no product in scope — someone placed this on a page that is not
  // a product template. Render nothing rather than an empty reviews heading, which
  // would read as "this thing has no reviews" about a page that has no thing.
  if (!handle) return null;

  const reviews = await listProductReviews(tenantSlug, handle);

  return (
    <ProductReviewsView
      heading={heading}
      emptyText={emptyText}
      showForm={showForm}
      tenantSlug={tenantSlug}
      handle={handle}
      average={reviews.summary.averageRating}
      total={reviews.summary.total}
      items={reviews.items}
    />
  );
}
