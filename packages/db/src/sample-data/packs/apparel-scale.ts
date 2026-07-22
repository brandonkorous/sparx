// Apparel scale slice — a large, single-collection catalog for exercising
// catalog-scale surfaces (pagination, deep-offset reads, the eventual Typesense
// path — docs/127 §8). The authored apparel pack tells the rich cross-module
// story on a dozen deep products; this adds BREADTH: ~90 lean products in one
// "Full Line" collection so a collection detail page actually spans several pages
// at the real 24/page default, and so any "what happens at catalog scale" question
// has real local data to answer.
//
// Data-as-code, generated deterministically (index-driven, no randomness) so a
// reseed is reproducible. Each product is intentionally LEAN — one variant, no
// options, no reviews/Q&A — because breadth is the point here, not depth: the
// authored products carry the reviews/bundle/configurator story, these carry the
// count. They still get real stock movements (so the ledger + in-stock flags are
// honest) and a generated SVG hero (industry hue + garment emoji), like any other
// sample product.
//
// Spliced into `apparelPack` (collections + products) in ./apparel.ts.

import type { SampleCollection, SampleProduct } from '../types';

/** The collection every generated product opts into — a broad "everything we make"
 *  line, the natural home for a multi-page grid. Global (no site scope), so it's
 *  visible on any single-site tenant's storefront. */
export const APPAREL_SCALE_COLLECTION: SampleCollection = {
  key: 'full-line',
  name: 'The Full Line',
  handle: 'full-line',
  description:
    'Every piece we make, in one place — tops, bottoms, outerwear, and accessories across the season’s fabrics. Browse the whole range.',
};

/** How many products to generate. 90 spans four pages at the storefront's 24/page
 *  default (24 · 24 · 24 · 18) — enough to make the pager real without bloating the
 *  seed. Bump this to stress deeper pagination. */
const COUNT = 90;

/** Garment archetypes — each fixes a product type, its home category, a price floor,
 *  a tag, the emoji used in the generated hero, and a one-line garment blurb the
 *  description builds on. `i % garments.length` cycles these so the collection reads
 *  like a real mixed catalog rather than 90 tees. */
const GARMENTS = [
  {
    name: 'Crewneck Tee',
    type: 'T-Shirts',
    category: 'tops',
    base: 2800,
    tag: 'tee',
    emoji: '👕',
    blurb: 'A clean crew with a structured collar that holds its shape wash after wash.',
  },
  {
    name: 'Henley',
    type: 'T-Shirts',
    category: 'tops',
    base: 3400,
    tag: 'henley',
    emoji: '👕',
    blurb: 'A three-button placket and a ribbed cuff — the tee’s slightly-dressed cousin.',
  },
  {
    name: 'Crew Sweater',
    type: 'Sweaters',
    category: 'tops',
    base: 6800,
    tag: 'sweater',
    emoji: '🧶',
    blurb: 'A mid-gauge knit with full-fashioned shoulders that keep their line under a coat.',
  },
  {
    name: 'Pullover Hoodie',
    type: 'Hoodies',
    category: 'tops',
    base: 7200,
    tag: 'hoodie',
    emoji: '🧥',
    blurb: 'A structured hood, a deep kangaroo pocket, and ribbed cuffs that stay put.',
  },
  {
    name: 'Zip Pullover',
    type: 'Sweaters',
    category: 'tops',
    base: 7800,
    tag: 'pullover',
    emoji: '🧶',
    blurb: 'A quarter-zip that layers clean over a tee and under a shell.',
  },
  {
    name: 'Jogger',
    type: 'Bottoms',
    category: 'bottoms',
    base: 5800,
    tag: 'jogger',
    emoji: '👖',
    blurb: 'A tapered leg with a real drawcord and pockets deep enough to use.',
  },
  {
    name: 'Chino',
    type: 'Bottoms',
    category: 'bottoms',
    base: 6400,
    tag: 'chino',
    emoji: '👖',
    blurb: 'A straight, mid-rise cut with a touch of stretch and a clean break.',
  },
  {
    name: 'Overshirt',
    type: 'Outerwear',
    category: 'outerwear',
    base: 8800,
    tag: 'overshirt',
    emoji: '🧥',
    blurb: 'A shirt-jacket weight that works buttoned as a layer or open over a tee.',
  },
  {
    name: 'Field Cap',
    type: 'Accessories',
    category: 'accessories',
    base: 2400,
    tag: 'cap',
    emoji: '🧢',
    blurb: 'A six-panel cap with a broken-in brim and an adjustable back.',
  },
  {
    name: 'Crew Socks',
    type: 'Accessories',
    category: 'accessories',
    base: 1400,
    tag: 'socks',
    emoji: '🧦',
    blurb: 'A cushioned footbed and a ribbed leg that stays up all day.',
  },
  {
    name: 'Ribbed Beanie',
    type: 'Accessories',
    category: 'accessories',
    base: 2200,
    tag: 'beanie',
    emoji: '🧢',
    blurb: 'A close-knit cuff that sits without slouching.',
  },
  {
    name: 'Woven Scarf',
    type: 'Accessories',
    category: 'accessories',
    base: 3200,
    tag: 'scarf',
    emoji: '🧣',
    blurb: 'A soft, brushed weave that folds down small.',
  },
] as const;

/** Fabrics — `floor(i / GARMENTS.length)` selects one, so each garment appears in
 *  several fabrics and every (garment, fabric) pair is unique across the run (which
 *  keeps titles + handles unique with no numeric suffix). `premium` is added to the
 *  garment's price floor so a merino piece costs more than a jersey one. */
const FABRICS = [
  { name: 'Combed Cotton', premium: 0 },
  { name: 'Brushed Terry', premium: 400 },
  { name: 'Waffle-Knit', premium: 600 },
  { name: 'Slub Jersey', premium: 300 },
  { name: 'Pima Cotton', premium: 900 },
  { name: 'Merino Wool', premium: 2600 },
  { name: 'Linen Blend', premium: 1200 },
  { name: 'Recycled Fleece', premium: 500 },
] as const;

/** Colorways — flavor only (baked into the variant title + the description); not part
 *  of uniqueness, so they can cycle independently on a short stride. */
const COLORS = [
  'Black',
  'Sand',
  'Olive',
  'Slate',
  'Ecru',
  'Navy',
  'Rust',
  'Heather Grey',
  'Forest',
  'Clay',
] as const;

/** Rotating vendors, so the vendor facet has real spread. */
const VENDORS = ['Northloom', 'Alder & Co', 'Terrace Goods', 'Fieldspun', 'Maren Supply'] as const;

/** Swatch hex per colorway (for the storefront's color picker). */
const SWATCH: Record<string, string> = {
  Black: '#111111',
  Sand: '#d8c3a5',
  Olive: '#5a5a3c',
  Slate: '#54606e',
  Ecru: '#efe7d3',
  Navy: '#1f2a44',
  Rust: '#9c4a2f',
  'Heather Grey': '#9aa0a6',
  Forest: '#2f4a3a',
  Clay: '#b0664a',
};

/** Apparel sizes for sized garments (tops/bottoms/outerwear). Accessories are one-size. */
const SIZES = ['S', 'M', 'L'] as const;

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Build the generated products. Deterministic: product `i` is fully a function of
 *  `i`, so the same seed run always produces the same catalog. */
export function apparelScaleProducts(): SampleProduct[] {
  const products: SampleProduct[] = [];
  for (let i = 0; i < COUNT; i++) {
    const garment = GARMENTS[i % GARMENTS.length]!;
    const fabric = FABRICS[Math.floor(i / GARMENTS.length) % FABRICS.length]!;
    const color = COLORS[(i * 3) % COLORS.length]!;
    const vendor = VENDORS[i % VENDORS.length]!;

    const title = `${fabric.name} ${garment.name}`;
    const handle = slug(title);
    const priceCents = garment.base + fabric.premium;
    const costCents = Math.round(priceCents * 0.42);

    // Cross-link a slice into the merchandised collections too, so those grids aren't
    // frozen at their authored size and the "featured / sale" facets have depth.
    const collectionKeys = ['full-line'];
    if (i % 5 === 0) collectionKeys.push('sale');
    if (i % 7 === 0) collectionKeys.push('new-arrivals');

    // Real variant axes so the storefront's Color/Size facets have data: every piece comes
    // in its assigned colorway PLUS a neutral (Black, or Ecru when the piece IS black), and
    // sized garments carry S/M/L. Accessories are one-size (Color only). Across the 90
    // products the assigned colors spread the Color facet; the neutral gives a real choice.
    const isSized = garment.category !== 'accessories';
    const colors = [color, color === 'Black' ? 'Ecru' : 'Black'];
    const options = [
      {
        name: 'Color',
        displayType: 'swatch',
        values: colors.map((c) => ({ value: c, swatchHex: SWATCH[c] ?? '#888888' })),
      },
      ...(isSized
        ? [{ name: 'Size', displayType: 'segmented', values: SIZES.map((s) => ({ value: s })) }]
        : []),
    ];

    // color × size (or color only) → variants, each with its own modest stock so some sit
    // low and availability is honest. Deterministic quantities keyed off (i, variant index).
    const variants = [];
    let vn = 0;
    for (const c of colors) {
      for (const s of isSized ? SIZES : [null]) {
        vn += 1;
        const received = 14 + ((i + vn) % 6) * 8;
        const sold = 2 + ((i + vn) % 7) * 2;
        variants.push({
          key: `fl-${i + 1}-v${vn}`,
          sku: `FL-${String(i + 1).padStart(3, '0')}-${vn}`,
          title: s ? `${c} / ${s}` : c,
          priceCents,
          costCents,
          optionValues: s ? [c, s] : [c],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 8,
              reorderQuantity: 40,
              leadTimeDays: 21,
              movements: [
                { delta: received, reason: 'receive', daysAgo: 28 },
                { delta: -sold, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        });
      }
    }

    products.push({
      key: `fl-${i + 1}`,
      title,
      handle,
      description:
        `<p>A ${fabric.name.toLowerCase()} ${garment.name.toLowerCase()} cut for everyday wear, shown in ${color.toLowerCase()}. ${garment.blurb}</p>` +
        `<p>Pre-washed for a stable fit and finished to layer through the season. Part of the full line — the same make and hand across every piece.</p>`,
      productType: garment.type,
      vendor,
      tags: [garment.tag, slug(fabric.name), 'full-line'],
      seoTitle: `${title} — ${fabric.name}`,
      seoDescription: `A ${fabric.name.toLowerCase()} ${garment.name.toLowerCase()} in ${color.toLowerCase()}, cut for everyday wear and built to layer.`,
      categoryKeys: [garment.category],
      collectionKeys,
      emoji: garment.emoji,
      options,
      variants,
    });
  }
  return products;
}
