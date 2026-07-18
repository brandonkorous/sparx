// The grouped palette metadata the dashboard host merges into silica's Insert
// palette (`mergeCatalog(paletteGroups(), { extend: COMMERCE_CATALOG })`). One
// group — "Products" — of the commerce-domain composites; silica's own groups
// (layout, content, marketing blocks, forms…) carry everything else.

import type { CatalogGroup } from './types';
import { buyBox, collectionHeader, productCard, productsBlock } from './commerce';

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

/** Site/brand chrome composites the palette offers as STAMPED trees.
 *
 *  Empty by design. The brand mark used to live here as `brand_wordmark` — a stamped,
 *  pre-bound lockup — and that was the wrong sort: a stamped tree freezes at publish, so
 *  the tenants who published before it existed could never get a logo into their header,
 *  and improving the composite could never reach them. The mark is now the `site.brand`
 *  HOST core (`host-nodes.ts`), surfaced through `hostComponents()` instead, where the
 *  platform renders it live on every request.
 *
 *  Kept as an empty, exported group list rather than deleted so the seam stays obvious:
 *  a genuinely tenant-owned chrome composite (one that SHOULD freeze once authored)
 *  belongs here, not in the host registry. */
export const SITE_CATALOG: CatalogGroup[] = [];
