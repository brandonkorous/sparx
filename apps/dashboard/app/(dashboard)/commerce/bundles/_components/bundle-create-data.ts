import { api } from '@/lib/api-rest-client';

import type { BundleProductOption, VariantOption } from './bundle-editor';

// Shared server loader for the bundle CREATE surface (docs/86 F layout). Both the
// `/new` page route and the @detail overlay wrapper call this to feed the SAME
// `BundleEditor` create flow with its option lists — fetch variants + products +
// existing bundles, drop wrapper-product ids already taken by a bundle, and map to
// the editor's option shapes. Server-side (uses `@/lib/api-rest-client`); never a
// client module.

interface VariantListRow {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
  productId: string;
  productTitle: string;
  productHandle: string;
  productStatus: string;
  archivedAt: string | null;
}

interface ProductListRow {
  id: string;
  title: string;
  handle: string;
  status: string;
}

interface BundleSummary {
  id: string;
  bundleProductId: string;
}

export async function loadBundleCreateData(): Promise<{
  products: BundleProductOption[];
  variants: VariantOption[];
}> {
  const [variantRows, productsResponse, bundles] = await Promise.all([
    api.get<VariantListRow[]>('/v1/commerce/variants?take=500'),
    api.getPaged<ProductListRow[]>('/v1/commerce/products?take=250'),
    api.get<BundleSummary[]>('/v1/commerce/bundles'),
  ]);

  const takenIds = new Set(bundles.map((b) => b.bundleProductId));
  const products: BundleProductOption[] = productsResponse.data
    .filter((p) => !takenIds.has(p.id))
    .map((p) => ({ id: p.id, title: p.title, handle: p.handle, status: p.status }));

  const variants: VariantOption[] = variantRows.map((v) => ({
    id: v.id,
    sku: v.sku,
    title: v.title,
    priceCents: v.priceCents,
    productId: v.productId,
    productTitle: v.productTitle,
  }));

  return { products, variants };
}
