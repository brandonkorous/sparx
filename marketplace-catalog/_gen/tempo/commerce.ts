// Tempo generator — commerce catalog: ~12 products across four categories (Originals,
// Running, Soccer, Lifestyle), two manual collections (Best Sellers, New Arrivals), their
// product-image asset references (`assets`), and the categories/collections/products
// payload (`commerce`). Both are spread into the manifest verbatim — pure data, no node()
// calls — so they resolve before any builder tree is assembled. Sizes are a real `Size`
// option (a size lattice of SKUs); accessories are one-size single variants. A few styles
// carry a `compareAtPriceCents` so the PDP + cards render the mockup's strike-through sale
// price. Everything installs `draft`; the tenant publishes.

import { productSvg } from './media';

type SizeKind = 'shoe' | 'apparel' | 'one';

interface ProductSpec {
  handle: string;
  title: string;
  description: string;
  category: string;
  collections?: string[];
  priceCents: number;
  /** Compare-at (was) price → renders a strike-through sale price. */
  compareCents?: number;
  productType: string;
  sizeKind: SizeKind;
  tags: string[];
  seed: string;
}

const PRODUCTS: ProductSpec[] = [
  // ── Originals (heritage / lifestyle sneakers) ──────────────────────────────────
  { handle: 'vega-og', title: 'Vega OG', description: 'The terrace classic, back in its original cut — soft suede overlays, a gum sole, and the clean low profile that started it all.', category: 'originals', collections: ['best-sellers', 'new-arrivals'], priceCents: 10000, productType: 'Shoes', sizeKind: 'shoe', tags: ['heritage', 'lifestyle'], seed: 'street' },
  { handle: 'halt-lo', title: 'Halt Lo', description: 'A low-top court shoe with a full-grain leather upper and a vulcanized sole — built for the street, styled for everywhere.', category: 'originals', collections: ['best-sellers'], priceCents: 9000, compareCents: 12000, productType: 'Shoes', sizeKind: 'shoe', tags: ['court', 'sale'], seed: 'court' },
  { handle: 'field-bold', title: 'Field Bold', description: 'A bold heritage runner reissue — nubuck and mesh, a chunky midsole, and a colorway pulled straight from the archive.', category: 'originals', collections: ['new-arrivals'], priceCents: 12000, productType: 'Shoes', sizeKind: 'shoe', tags: ['heritage'], seed: 'street' },
  // ── Running ────────────────────────────────────────────────────────────────────
  { handle: 'glide-boost', title: 'Glide Boost', description: 'Our most-cushioned daily trainer — a responsive energy-return midsole and a knit upper that moves with every stride.', category: 'running', collections: ['best-sellers'], priceCents: 19000, productType: 'Shoes', sizeKind: 'shoe', tags: ['running', 'cushioned'], seed: 'runner' },
  { handle: 'pulse-rise', title: 'Pulse Rise', description: 'A lightweight tempo shoe for fast days — a breathable upper, a propulsive plate, and a grippy outsole for the road.', category: 'running', collections: ['new-arrivals'], priceCents: 14000, productType: 'Shoes', sizeKind: 'shoe', tags: ['running', 'tempo'], seed: 'runner' },
  { handle: 'trail-storm', title: 'Trail Storm', description: 'A rugged trail runner with a weather-ready upper and aggressive lugs — engineered to hold the line on any terrain.', category: 'running', priceCents: 16000, productType: 'Shoes', sizeKind: 'shoe', tags: ['trail', 'outdoor'], seed: 'trail' },
  // ── Soccer ───────────────────────────────────────────────────────────────────────
  { handle: 'strike-elite-fg', title: 'Strike Elite FG', description: 'The firm-ground boot the pros wear — a second-skin upper, a precision soleplate, and a strike zone tuned for power.', category: 'soccer', collections: ['best-sellers'], priceCents: 28000, productType: 'Cleats', sizeKind: 'shoe', tags: ['soccer', 'firm-ground'], seed: 'cleat' },
  { handle: 'strike-pro-tf', title: 'Strike Pro TF', description: 'A turf trainer built for the cage — a durable coated upper and a multi-stud outsole for grip on hard ground.', category: 'soccer', collections: ['new-arrivals'], priceCents: 12000, compareCents: 15000, productType: 'Cleats', sizeKind: 'shoe', tags: ['soccer', 'turf', 'sale'], seed: 'cleat' },
  { handle: 'match-ball-pro', title: 'Match Ball Pro', description: 'A thermally-bonded match ball with a seamless surface for a true, predictable flight — official size and weight.', category: 'soccer', priceCents: 4000, productType: 'Equipment', sizeKind: 'one', tags: ['soccer', 'equipment'], seed: 'ball' },
  // ── Lifestyle (apparel + accessories) ──────────────────────────────────────────
  { handle: 'club-jersey', title: 'Club Jersey', description: 'A moisture-wicking match jersey with a relaxed fit and a heat-pressed crest — built for the stands or the pitch.', category: 'lifestyle', collections: ['new-arrivals'], priceCents: 9000, productType: 'Apparel', sizeKind: 'apparel', tags: ['jersey', 'apparel'], seed: 'jersey' },
  { handle: 'terrace-tee', title: 'Terrace Tee', description: 'A heavyweight cotton tee with the motion-mark on the chest — the everyday staple, cut a little boxy.', category: 'lifestyle', collections: ['best-sellers'], priceCents: 3500, productType: 'Apparel', sizeKind: 'apparel', tags: ['tee', 'apparel'], seed: 'tee' },
  { handle: 'field-track-jacket', title: 'Field Track Jacket', description: 'The original three-zone track jacket — a slim fit, ribbed cuffs, and a stand collar that never goes out of style.', category: 'lifestyle', priceCents: 11000, productType: 'Apparel', sizeKind: 'apparel', tags: ['jacket', 'apparel'], seed: 'jacket' },
];

const SIZES: Record<SizeKind, string[]> = {
  shoe: ['8', '9', '10', '11'],
  apparel: ['S', 'M', 'L', 'XL'],
  one: [],
};

/** A short, unique, uppercase SKU stem from a handle (drop dashes, cap length). */
const skuStem = (handle: string): string => handle.toUpperCase().replace(/-/g, '').slice(0, 10);

export const assets = PRODUCTS.map((p) => ({
  id: `img-${p.handle}`,
  url: productSvg(p.seed),
  alt: p.title,
}));

export const commerce = {
  categories: [
    { handle: 'originals', name: 'Originals', description: 'Heritage and lifestyle sneakers — the icons, in their original cut.', featured: true, position: 0 },
    { handle: 'running', name: 'Running', description: 'Daily trainers, tempo shoes and trail runners engineered to move.', featured: true, position: 1 },
    { handle: 'soccer', name: 'Soccer', description: 'Boots, turf trainers and match equipment built for the pitch.', featured: true, position: 2 },
    { handle: 'lifestyle', name: 'Lifestyle', description: 'Jerseys, tees and track tops — terrace style for every day.', featured: true, position: 3 },
  ],
  collections: [
    {
      handle: 'best-sellers',
      name: 'Best Sellers',
      description: 'The styles our customers reach for first — restocked and ready.',
      type: 'manual' as const,
      featured: true,
      productHandles: ['vega-og', 'glide-boost', 'halt-lo', 'strike-elite-fg', 'terrace-tee'],
    },
    {
      handle: 'new-arrivals',
      name: 'New & Trending',
      description: 'Fresh drops and the styles climbing the charts this week.',
      type: 'manual' as const,
      featured: true,
      productHandles: ['vega-og', 'field-bold', 'pulse-rise', 'strike-pro-tf', 'club-jersey'],
    },
  ],
  products: PRODUCTS.map((p) => {
    const sizes = SIZES[p.sizeKind];
    const stem = skuStem(p.handle);
    const options =
      sizes.length > 0
        ? [{ name: 'Size', displayType: 'segmented' as const, values: sizes.map((v, i) => ({ value: v, position: i })) }]
        : [];
    const defaultIdx = p.sizeKind === 'shoe' ? 2 : 1; // US 10 / size L sit mid-run
    const variants =
      sizes.length > 0
        ? sizes.map((size, i) => ({
            sku: `${stem}-${size}`,
            priceCents: p.priceCents,
            ...(p.compareCents ? { compareAtPriceCents: p.compareCents } : {}),
            optionValues: { Size: size },
            // Always purchasable — no inventory is seeded, so without `continue` every
            // card would read "Sold out" (the Farm Fresh footgun).
            inventoryPolicy: 'continue' as const,
            isDefault: i === defaultIdx,
            position: i,
          }))
        : [
            {
              sku: stem,
              priceCents: p.priceCents,
              ...(p.compareCents ? { compareAtPriceCents: p.compareCents } : {}),
              inventoryPolicy: 'continue' as const,
              isDefault: true,
            },
          ];
    return {
      handle: p.handle,
      title: p.title,
      description: p.description,
      status: 'draft' as const,
      productType: p.productType,
      vendor: 'Tempo',
      tags: p.tags,
      categoryHandles: [p.category],
      ...(p.collections ? { collectionHandles: p.collections } : {}),
      options,
      variants,
      images: [{ assetId: `img-${p.handle}`, isPrimary: true }],
    };
  }),
};
