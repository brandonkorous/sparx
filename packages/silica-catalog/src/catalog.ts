// The grouped palette metadata the studio host merges into silica's Insert palette
// (`mergeCatalog(paletteGroups(), { extend: SPARX_CATALOG })`).
//
// TWO HALVES, and the split is meaningful. `COMMERCE_CATALOG` is the commerce-domain
// composites that BIND THE SPINE — a product card, a repeating grid, a buy box — and
// they are here because they know about products. `SECTION_CATALOG` is the section
// library (docs/builder-audit slice 19): the galleries, comparisons, timelines, price
// lists, menus and forms that any business needs and that no engine can ship, because
// the engine's 18 blocks are a good spine for a software marketing page and a thin one
// for a photographer, a restaurant or a garage. See `sections/index.ts`.

import type { CatalogGroup } from './types';
import { buyBox, collectionHeader, productCard, productsBlock } from './commerce';
import { SECTION_CATALOG } from './sections';
import { MEDIA_CATALOG } from './sections/media';

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
        // A SEPARATE entry, not a third value on the layout control, because grid ↔ rail
        // is a class swap and a carousel is not: it needs the behavior marker on the
        // section plus `track`/`slide`/`prev`/`next` parts, which no amount of restyling
        // the Products block can produce. Offering it as a layout would mean picking
        // "carousel" gave you a rail with no controls and no explanation.
        key: 'product_carousel',
        label: 'Product carousel',
        icon: 'gallery',
        hint: 'Products a few at a time, with Previous and Next. Set how many to load on the repeat.',
        make: () => productsBlock({ source: 'commerce.featured', layout: 'carousel' }),
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

/**
 * Everything sparx adds to the Insert palette, in one list.
 *
 * The order is the order an author sees: the commerce composites first (they are the
 * ones that bind live data and the ones a shop reaches for constantly), then the
 * section library grouped by what a page is FOR — pictures, choosing, how it works,
 * people, where and when, getting in touch, writing, selling.
 *
 * One export so a host cannot merge half of it. The studio wires
 * `mergeCatalog(paletteGroups(), { extend: SPARX_CATALOG })`; a host that merged only
 * `COMMERCE_CATALOG` would silently ship a builder missing every section, which is
 * exactly the state this slice existed to end.
 */
export const SPARX_CATALOG: CatalogGroup[] = [
  ...COMMERCE_CATALOG,
  ...SECTION_CATALOG,
  ...MEDIA_CATALOG,
];
