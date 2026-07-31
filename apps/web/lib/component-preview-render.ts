// SERVER-ONLY. Renders a marketplace COMPONENT's silica section to preview HTML
// (docs/118). Imported only by lib/marketplace.ts (itself server-only), so the silica
// renderer + resolver never reach the client bundle — the browse/detail UI receives a
// ready HTML string.
//
// WHY A SAMPLE HOST. The sections are the real Builder catalog sections, and the
// data-bound ones (a product grid, a buy box, a blog strip) bind scope-relative field
// keys (`title`/`price`/`image`/…). Rendered with NO host, a bound `<img>` loses its
// `src` (the engine defers it to a resolution that never runs) and a `repeat` shows a
// single template row — so a preview would have broken images and empty grids. This
// host feeds the SAME shape the storefront's resolver does (`@sparx/builder-schemas`
// `createSilicaResolver`), but over a fixed set of neutral SAMPLE records, so every
// section renders populated + truthful with zero tenant data. Images resolve to a
// neutral static placeholder tile (see SAMPLE_IMAGE — a component preview must not imply
// a specific business's photography). Static marketing sections bind nothing and render
// their authored copy regardless — the host only affects the bound ones.

import { renderSilicaBody, PLACEHOLDER_IMAGE } from '@sparx/silica-catalog';
import {
  createSilicaResolver,
  defaultSilicaFormat,
  type DataSources,
} from '@sparx/builder-schemas';
import type { Node } from '@wizeworks/silicaui-html';

/** The neutral placeholder tile every sample image points at. It is a STATIC FILE
 *  (a relative URL), NOT silica-catalog's `PLACEHOLDER_IMAGE` data-URI: `toHtml`'s
 *  attribute sanitizer strips `data:` srcs entirely (only http(s)/relative survive),
 *  so the inline placeholder never renders through the projection. Served from
 *  apps/web/public; a component preview must not imply a specific business's photos. */
const SAMPLE_IMAGE = '/marketplace/sample-image.svg';

/** Neutral sample wordmarks for the logo wall (see below). Not real brands — just
 *  varied names so the wall reads as a wall, the way real client logos would. */
const SAMPLE_LOGOS = ['Northwind', 'Atlas & Co', 'Meridian', 'Bluebird', 'Forge Studio', 'Kestrel'];

/** Prepare a section's tree for a data-less preview — the transforms that make authored
 *  placeholders (invisible on a live site, where the merchant fills them) render as real
 *  content. A string pass over the serialized tree is exact + total (none of the swapped
 *  values contain a JSON-escaped character) and reaches every node shape without a walk:
 *    · a `PLACEHOLDER_IMAGE` data-URI (product/record composites) → the static tile —
 *      `toHtml`'s sanitizer strips every `data:` src, so it would render broken;
 *    · an EMPTY `src=""` (galleries, picture rows, team photos) → the tile too — an empty
 *      src is dropped, leaving a broken image;
 *    · the logo wall's six identical "Your client" text tiles (it ships no real marks on
 *      purpose) → varied sample wordmarks, so the preview reads as an actual logo wall.
 *  BOUND images are handled separately by the resolver. */
function preparePreviewTree(tree: object): object {
  let json = JSON.stringify(tree)
    .split(PLACEHOLDER_IMAGE)
    .join(SAMPLE_IMAGE)
    .split('"src":""')
    .join(`"src":"${SAMPLE_IMAGE}"`);
  let n = 0;
  json = json.replace(/"Your client"/g, () => `"${SAMPLE_LOGOS[n++ % SAMPLE_LOGOS.length]}"`);
  return JSON.parse(json) as object;
}

/** An image field in the shape the composites bind (`{ url, alt }`); the resolver's
 *  format unwraps it to the `<img src>` string. */
const img = (alt: string) => ({ url: SAMPLE_IMAGE, alt });

/** Neutral sample products (the `toSilicaProduct` shape — `price` is a raw number the
 *  resolver formats as currency). One carries a `compareAtPrice` so the sale-price
 *  strikethrough shows. Deliberately vertical-agnostic. */
const PRODUCTS = [
  {
    id: 's1',
    handle: 'field-kettle',
    title: 'Field Kettle',
    price: 48,
    compareAtPrice: null,
    description: 'A stovetop classic in brushed steel.',
    image: img('Field Kettle'),
    variantId: 'v1',
    url: '/products/field-kettle',
  },
  {
    id: 's2',
    handle: 'merino-crew',
    title: 'Merino Crew',
    price: 96,
    compareAtPrice: 130,
    description: 'Lightweight everyday knit in soft merino.',
    image: img('Merino Crew'),
    variantId: 'v2',
    url: '/products/merino-crew',
  },
  {
    id: 's3',
    handle: 'ceramic-mug',
    title: 'Ceramic Mug',
    price: 22,
    compareAtPrice: null,
    description: 'Hand-glazed, a comfortable 12oz pour.',
    image: img('Ceramic Mug'),
    variantId: 'v3',
    url: '/products/ceramic-mug',
  },
  {
    id: 's4',
    handle: 'canvas-tote',
    title: 'Canvas Tote',
    price: 34,
    compareAtPrice: null,
    description: 'Heavyweight cotton, built to be overpacked.',
    image: img('Canvas Tote'),
    variantId: 'v4',
    url: '/products/canvas-tote',
  },
  {
    id: 's5',
    handle: 'field-notebook',
    title: 'Field Notebook',
    price: 18,
    compareAtPrice: null,
    description: 'Stitched, lay-flat, ninety numbered pages.',
    image: img('Field Notebook'),
    variantId: 'v5',
    url: '/products/field-notebook',
  },
  {
    id: 's6',
    handle: 'cast-pan',
    title: 'Cast Iron Pan',
    price: 65,
    compareAtPrice: null,
    description: 'Pre-seasoned, oven to table, lasts a lifetime.',
    image: img('Cast Iron Pan'),
    variantId: 'v6',
    url: '/products/cast-pan',
  },
];

/** Neutral sample CMS entries (the `toSilicaEntry` body shape — bound by the journal
 *  composites). `date` is pre-formatted for display; `url` links to a post detail. */
const POSTS = [
  {
    title: 'A field guide to getting started',
    excerpt: 'The short version of everything we wish we had known on day one.',
    date: 'March 12, 2026',
    featuredImage: img('A field guide to getting started'),
    slug: 'field-guide',
    url: '/blog/field-guide',
  },
  {
    title: 'How we think about quality',
    excerpt: 'Why we make fewer things, and make them to last.',
    date: 'March 2, 2026',
    featuredImage: img('How we think about quality'),
    slug: 'quality',
    url: '/blog/quality',
  },
  {
    title: 'Behind the workshop doors',
    excerpt: 'A morning with the people who actually make the work.',
    date: 'February 18, 2026',
    featuredImage: img('Behind the workshop doors'),
    slug: 'workshop',
    url: '/blog/workshop',
  },
  {
    title: 'What ships this season',
    excerpt: 'A look at what is landing, and when to expect it.',
    date: 'February 4, 2026',
    featuredImage: img('What ships this season'),
    slug: 'this-season',
    url: '/blog/this-season',
  },
];

/** The fixed sample data root. Mirrors the storefront resolver root (`silica-data.ts`)
 *  minus the fetches: every commerce product source is populated (so a grid/rail/
 *  carousel fills), the single `product` object scopes a buy box (collection-of-one),
 *  and `cms.blog_post` fills a journal strip. */
const ROOT: DataSources = {
  commerce: {
    product: PRODUCTS,
    featured: PRODUCTS.slice(0, 5),
    new: PRODUCTS.slice(0, 5),
    related: PRODUCTS.slice(0, 5),
  },
  cms: { blog_post: POSTS },
  // The in-scope product a `commerce.product` object template (the buy box) binds.
  product: PRODUCTS[0],
  // Bare image refs bound at the ROOT with no enclosing scope (the standalone Product
  // card, an author byline) resolve here — without this they stay unresolved and the
  // bound `<img>` renders with no src. `title`/`price` are deliberately NOT set at the
  // root: a lone card + a collection header both bind them here, and each reads best
  // with its OWN authored placeholder ("Product name" / "Collection").
  image: { url: SAMPLE_IMAGE, alt: 'Sample image' },
  featuredImage: { url: SAMPLE_IMAGE, alt: 'Sample image' },
};

// `defaultSilicaFormat` covers exactly the two shapes the sample data uses: it unwraps
// an `{ url, alt }` image to its src string and renders a raw `price` number as currency.
const HOST = createSilicaResolver({ root: ROOT, format: defaultSilicaFormat });

/** Render one component's stored silica tree to preview HTML against the sample host,
 *  or null if the tree is missing/unrenderable (a legacy row → the UI shows a
 *  placeholder). Static sections ignore the host; bound sections render populated. */
export function renderComponentPreview(tree: unknown): string | null {
  if (!tree || typeof tree !== 'object') return null;
  try {
    const prepared = preparePreviewTree(tree) as Node;
    return renderSilicaBody(prepared, { host: HOST, html: { ids: false } });
  } catch {
    return null;
  }
}
