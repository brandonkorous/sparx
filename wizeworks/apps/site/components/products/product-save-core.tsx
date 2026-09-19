// The `commerce.product-save` host core — save for later, on a silica-authored
// product page.
//
// A host core rather than a bound node, for the reason reviews and questions are
// cores: it is a TRANSACTION. Pressing it writes to the shopper's saved list and
// the control has to know whether it is already on it, which a binding cannot
// carry.
//
// It exists because everything else was already built and only the button on the
// page was missing — the endpoint, the shopper's `/account/wishlist` page, the
// link to it in the account menu, and the heart itself, which lived in the
// PREVIOUS generation's product body and went out of reach when product pages
// became silica trees. 43 shops, 0 saved lists, over a console screen saying
// "when a shopper saves a product for later, it shows up here" (issue 642).
//
// It fetches the product for one thing only: the list of versions, so a stale
// value in the buy box's form field can be refused rather than saved.

import { getProduct } from '@/lib/commerce';
import { ProductSaveView } from '@/components/products/product-save-view';

export interface ProductSaveCoreProps {
  tenantSlug: string;
  /** The in-scope product's URL handle, from the route's record context. */
  handle: string;
  label: string;
  savedLabel: string;
}

export async function ProductSaveCore({
  tenantSlug,
  handle,
  label,
  savedLabel,
}: ProductSaveCoreProps) {
  // No handle means no product in scope — somebody placed this on a page that is
  // not a product template. Render nothing rather than a heart that saves nothing.
  if (!handle) return null;

  const product = await getProduct(tenantSlug, handle);
  const variantIds = (product?.variants ?? []).map((v) => v.id);
  // A product with no versions cannot be saved, because a saved item IS a version.
  if (variantIds.length === 0) return null;

  return <ProductSaveView variantIds={variantIds} label={label} savedLabel={savedLabel} />;
}
