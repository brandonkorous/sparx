// The grouped palette metadata the dashboard host merges into silica's Insert
// palette (`mergeCatalog(paletteGroups(), { extend: COMMERCE_CATALOG })`). One
// group — "Products" — of the commerce-domain composites; silica's own groups
// (layout, content, marketing blocks, forms…) carry everything else.

import type { CatalogGroup } from './types';
import { buyBox, collectionHeader, productCard, productsBlock } from './commerce';
import { brandWordmark } from './site-chrome';

/** sparx's `host.catalog().extend` — the commerce composites silica doesn't ship.
 *  Icons are silica `IconName`s (the dashboard adapter narrows the `string` type). */
export const COMMERCE_CATALOG: CatalogGroup[] = [
  {
    key: 'commerce',
    label: 'Products',
    items: [
      {
        // ONE configurable listing (docs/122). Drops a shop-all grid; the editor's
        // data-source picker repoints it to Featured / New / Related / a Category, and
        // the layout controls switch grid ↔ rail. Replaces the old separate
        // "Product grid" + "Featured products" entries.
        key: 'products',
        label: 'Products',
        icon: 'grid',
        hint: 'A product listing — pick the source (all, featured, new, related, a category) and grid or rail.',
        make: () => productsBlock(),
      },
      {
        key: 'product_card',
        label: 'Product card',
        icon: 'image',
        hint: 'A single product — image, name, price. Pin it to one product.',
        make: productCard,
      },
      {
        key: 'buy_box',
        label: 'Buy box',
        icon: 'shopping-cart',
        hint: 'Product detail: gallery, price, and Add to cart. For a product page.',
        make: buyBox,
      },
      {
        key: 'collection_header',
        label: 'Collection header',
        icon: 'layout',
        hint: 'A titled header band for a collection or category page.',
        make: collectionHeader,
      },
    ],
  },
];

/** Site/brand chrome composites — the pieces a tenant drops into the shared frame
 *  (navbar/footer). `brand_wordmark` is the logo-capable wordmark: pre-bound to the
 *  tenant's `site.identity.logo` + name, so dropping it into the navbar gives a real
 *  header logo with no binding work (docs/122 — the wordmark-logo gap). */
export const SITE_CATALOG: CatalogGroup[] = [
  {
    key: 'brand',
    label: 'Brand',
    items: [
      {
        key: 'brand_wordmark',
        label: 'Brand (logo + name)',
        icon: 'image',
        hint: 'Your logo beside your site name, both pre-filled from your brand. Drop it in the header; delete either part for logo-only or text-only.',
        make: brandWordmark,
      },
    ],
  },
];
