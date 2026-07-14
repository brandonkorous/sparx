// The MCP-servable equivalent of `/builder/studio`'s Insert palette (docs/118).
//
// The dashboard editor merges silica's native block library with sparx's domain
// composites via `mergeCatalog` — an assembly internal to the React
// `@wizeworks/silicaui-builder/react` engine, not reusable server-side. This
// module reproduces that merge as a plain, framework-free list an MCP tool can
// list/fetch from: silica's own marketing/content blocks (hero, feature grid,
// testimonials, pricing, team, stats, FAQ, contact form, nav/footer chrome) plus
// sparx's commerce/content composites (product grid/card, buy box, featured
// products, collection header, the sparx-branded navbar/footer) that silica has
// no concept of.

import {
  getBlock as getNativeBlock,
  listBlocks as listNativeBlocks,
} from '@wizeworks/silicaui-html/blocks';
import type { Node } from '@wizeworks/silicaui-html';
import {
  buyBox,
  collectionHeader,
  featuredProducts,
  productCard,
  productGrid,
  siteFooter,
  siteNavbar,
} from '@sparx/silica-catalog';

/** One servable catalog row: enough to list cheaply, plus a factory to fetch the
 *  full tree on demand. `category` groups native blocks by silica's own
 *  taxonomy; sparx composites are grouped under "commerce" / "chrome". */
export interface SilicaCatalogEntry {
  key: string;
  label: string;
  category: string;
  hint: string;
  make: () => Node;
}

const SPARX_ENTRIES: SilicaCatalogEntry[] = [
  {
    key: 'sparx.product_grid',
    label: 'Product grid',
    category: 'commerce',
    hint: "A responsive grid of products from the tenant's catalog.",
    make: productGrid,
  },
  {
    key: 'sparx.featured_products',
    label: 'Featured products',
    category: 'commerce',
    hint: 'A horizontal, scrolling rail of highlighted products.',
    make: featuredProducts,
  },
  {
    key: 'sparx.product_card',
    label: 'Product card',
    category: 'commerce',
    hint: 'A single product tile (image, name, price) — usually used inside a product grid.',
    make: productCard,
  },
  {
    key: 'sparx.buy_box',
    label: 'Buy box',
    category: 'commerce',
    hint: 'Product-detail purchase panel: gallery, price, variant picker, Add to cart. For a product page.',
    make: buyBox,
  },
  {
    key: 'sparx.collection_header',
    label: 'Collection header',
    category: 'commerce',
    hint: 'A titled header band for a collection or category page, bound to the in-scope record.',
    make: collectionHeader,
  },
  {
    key: 'sparx.navbar',
    label: 'Sparx navbar',
    category: 'chrome',
    hint: 'Branded nav bar bound to site.identity — prefer this over the native navbar block for the frame.',
    make: siteNavbar,
  },
  {
    key: 'sparx.footer',
    label: 'Sparx footer',
    category: 'chrome',
    hint: 'Branded footer bound to site.identity/site.social — prefer this over the native footer block for the frame.',
    make: siteFooter,
  },
];

const NATIVE_KEY_PREFIX = 'native.';

/** The merged catalog summary (no trees) — cheap enough to return in full for a
 *  listing tool. Native blocks are prefixed `native.<key>`; sparx composites are
 *  prefixed `sparx.` (already on their `key` above) to keep the two namespaces
 *  from colliding. */
export function listSilicaCatalog(filter?: {
  category?: string;
}): Omit<SilicaCatalogEntry, 'make'>[] {
  const native = listNativeBlocks().map((t) => ({
    key: `${NATIVE_KEY_PREFIX}${t.key}`,
    label: t.name,
    category: t.category,
    hint: t.description,
  }));
  const all = [...native, ...SPARX_ENTRIES.map(({ make: _make, ...rest }) => rest)];
  return filter?.category ? all.filter((e) => e.category === filter.category) : all;
}

/** The full, id-free `Node` for one catalog entry (a native block's `root`, or a
 *  sparx composite's fresh factory output) — the tree an agent edits in place. */
export function getSilicaCatalogEntry(key: string): Node | undefined {
  if (key.startsWith(NATIVE_KEY_PREFIX)) {
    return getNativeBlock(key.slice(NATIVE_KEY_PREFIX.length))?.root;
  }
  return SPARX_ENTRIES.find((e) => e.key === key)?.make();
}
