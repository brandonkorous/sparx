// The grouped palette metadata the dashboard host merges into silica's Insert
// palette (`mergeCatalog(paletteGroups(), { extend: COMMERCE_CATALOG })`). One
// group — "Products" — of the commerce-domain composites; silica's own groups
// (layout, content, marketing blocks, forms…) carry everything else.

import type { CatalogGroup } from './types';
import { buyBox, collectionHeader, featuredProducts, productCard, productGrid } from './commerce';

/** sparx's `host.catalog().extend` — the commerce composites silica doesn't ship.
 *  Icons are silica `IconName`s (the dashboard adapter narrows the `string` type). */
export const COMMERCE_CATALOG: CatalogGroup[] = [
  {
    key: 'commerce',
    label: 'Products',
    items: [
      {
        key: 'product_grid',
        label: 'Product grid',
        icon: 'grid',
        hint: 'A responsive grid of products from your catalog.',
        make: productGrid,
      },
      {
        key: 'featured_products',
        label: 'Featured products',
        icon: 'sparkles',
        hint: 'A horizontal, scrolling rail of highlighted products.',
        make: featuredProducts,
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
