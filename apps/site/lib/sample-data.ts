// Code-defined sample storefront data for the Site Builder preview (doc 36 §9).
//
// A merchant can't design a product / collection layout before the store has
// data — and the storefront only serves `status:'active'` items, so even a draft
// product 404s. These fixed SAMPLE_* fixtures are fed into SectionContext when a
// preview asks for sample data, so the bound sections render against believable
// data regardless of the real catalog.
//
// Gated: honored ONLY in preview (a `sparxSitePreview` token present) AND when
// `sparxSampleData=1` — the public storefront never sees it. The renderer needs
// nothing special; bound sections resolve purely from SectionContext, so this is
// just an alternate data source for the same render path.

import type {
  PublicCollection,
  PublicFitmentDimension,
  PublicFitmentDomain,
  PublicProduct,
  PublicProductListItem,
  PublicQuestion,
  PublicReviewList,
} from '@/lib/commerce';

const SAMPLE_AT = '2026-01-02T00:00:00.000Z';

// The sample Compatibility domain's shape: Series → Size (the level tree),
// narrowed by Capacity (a range axis). Shared by the sample product's fitment
// rows and the sample domain map so the PDP fitment table renders generically —
// deliberately a neutral consumer-goods domain, not a vehicle tree, since the
// same table serves every vertical (pets, apparel, homeware…).
const SAMPLE_COMPAT_DIMENSIONS: PublicFitmentDimension[] = [
  { key: 'series', label: 'Series', kind: 'level' },
  { key: 'size', label: 'Size', kind: 'level' },
  { key: 'capacity', label: 'Capacity', kind: 'range', unit: 'oz' },
];

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/** True when the request is a preview AND explicitly asks for sample data. The
 *  token gate keeps this off the public storefront entirely. */
export function isSampleRequested(sp: Record<string, string | string[] | undefined>): boolean {
  return first(sp.sparxSampleData) === '1' && Boolean(first(sp.sparxSitePreview));
}

// A reusable list-card fixture (the related rail + the collection grid).
function sampleListItem(i: number): PublicProductListItem {
  const base = 2400 + i * 350;
  return {
    id: `sample-item-${i}`,
    title: `Sample Product ${i}`,
    handle: `sample-product-${i}`,
    description: 'Sample product so you can see how cards lay out before real data exists.',
    vendor: 'sparx Sample Co.',
    productType: 'Sample',
    tags: ['sample'],
    priceMinCents: base,
    priceMaxCents: base,
    compareAtCents: i % 2 === 0 ? base + 800 : null,
    yourPriceCents: null,
    inStock: true,
    averageRating: 4 + (i % 10) / 10,
    reviewCount: 12 + i * 7,
    primaryImageId: null,
    // Sample data has no real variants — an add-to-cart must never fire from it.
    defaultVariantId: null,
    seoTitle: null,
    seoDescription: null,
    updatedAt: SAMPLE_AT,
  };
}

export const SAMPLE_PRODUCT: PublicProduct = {
  id: 'sample-product',
  title: 'Sample Product — Stoneware Pour-Over Dripper',
  handle: 'sample-product',
  description:
    'This is sample product copy. Use it to design your product page layout — the sections, ' +
    'their order, and how everything looks — before you have real products. Every published ' +
    'product renders through this same layout.',
  vendor: 'sparx Sample Co.',
  productType: 'Coffee & Tea',
  tags: ['sample', 'featured'],
  priceMinCents: 2499,
  priceMaxCents: 3499,
  compareAtCents: 3999,
  yourPriceCents: null,
  inStock: true,
  averageRating: 4.6,
  reviewCount: 128,
  primaryImageId: null,
  // Sample data has no real variants — an add-to-cart must never fire from it.
  defaultVariantId: null,
  seoTitle: null,
  seoDescription: null,
  updatedAt: SAMPLE_AT,
  fulfillmentType: 'physical',
  weightGrams: 450,
  dimensions: { lengthMm: 120, widthMm: 120, heightMm: 95 },
  options: [
    {
      id: 'sample-opt-finish',
      name: 'Finish',
      displayType: 'swatch',
      position: 0,
      values: [
        { id: 'sample-val-white', value: 'Matte White', swatchHex: '#F3F1EC', position: 0 },
        { id: 'sample-val-charcoal', value: 'Charcoal', swatchHex: '#3A3A3A', position: 1 },
      ],
    },
  ],
  variants: [
    {
      id: 'sample-var-white',
      sku: 'SAMPLE-WHITE',
      title: 'Matte White',
      priceCents: 2499,
      compareAtPriceCents: 3999,
      yourPriceCents: null,
      isDefault: true,
      inventoryPolicy: 'deny',
      optionValueIds: ['sample-val-white'],
      available: 42,
      inStock: true,
      preorder: null,
      expectedBackAt: null,
    },
    {
      id: 'sample-var-charcoal',
      sku: 'SAMPLE-CHARCOAL',
      title: 'Charcoal',
      priceCents: 3499,
      compareAtPriceCents: null,
      yourPriceCents: null,
      isDefault: false,
      inventoryPolicy: 'deny',
      optionValueIds: ['sample-val-charcoal'],
      available: 8,
      inStock: true,
      preorder: null,
      expectedBackAt: null,
    },
  ],
  images: [],
  fitments: [
    {
      id: 'sample-fit-1',
      domainSlug: 'compatibility',
      domainLabel: 'Compatibility',
      dimensions: SAMPLE_COMPAT_DIMENSIONS,
      nodeName: 'Everyday Two-Cup',
      nodePath: ['Everyday', 'Two-Cup'],
      ranges: [{ dimensionKey: 'capacity', min: 12, max: 20 }],
      notes: null,
    },
    {
      id: 'sample-fit-2',
      domainSlug: 'compatibility',
      domainLabel: 'Compatibility',
      dimensions: SAMPLE_COMPAT_DIMENSIONS,
      nodeName: 'Everyday Four-Cup',
      nodePath: ['Everyday', 'Four-Cup'],
      ranges: [{ dimensionKey: 'capacity', min: 24, max: 34 }],
      notes: null,
    },
  ],
  // Typed attributes (docs/143) — a `home_goods` sample so the preview PDP also shows the
  // auto-render attribute sections a real product carries.
  productTypeKey: 'home_goods',
  attributes: {
    materials:
      'High-fired stoneware with a food-safe reactive glaze; a cork base ring so it sits quiet on the counter.',
    dimensions: 'Ø 12 cm × H 9.5 cm — brews one to four cups.',
    care: 'Dishwasher-safe; hand-wash to keep the glaze bright. Let it come to room temperature before brewing to avoid thermal shock.',
    origin: 'Portugal',
  },
  attributeSections: [
    {
      key: 'materials',
      label: 'Materials',
      kind: 'long_text',
      value:
        'High-fired stoneware with a food-safe reactive glaze; a cork base ring so it sits quiet on the counter.',
      items: [],
    },
    {
      key: 'dimensions',
      label: 'Dimensions',
      kind: 'text',
      value: 'Ø 12 cm × H 9.5 cm — brews one to four cups.',
      items: [],
    },
    {
      key: 'care',
      label: 'Care',
      kind: 'long_text',
      value:
        'Dishwasher-safe; hand-wash to keep the glaze bright. Let it come to room temperature before brewing to avoid thermal shock.',
      items: [],
    },
    { key: 'origin', label: 'Made in', kind: 'text', value: 'Portugal', items: [] },
  ],
  lowStock: false,
};

export const SAMPLE_PRODUCT_EXTRAS: {
  related: PublicProductListItem[];
  questions: PublicQuestion[];
  reviews: PublicReviewList;
  fitmentDomainsBySlug: Record<string, PublicFitmentDomain>;
} = {
  related: [1, 2, 3, 4].map((i) => sampleListItem(i)),
  reviews: {
    summary: { averageRating: 4.5, total: 2 },
    items: [
      {
        id: 'sample-review-1',
        rating: 5,
        title: 'Exactly as described',
        body: 'Great quality and fast shipping. Brews a clean, even cup and looks even better in person.',
        author: 'Alex P.',
        verifiedPurchase: true,
        helpfulCount: 4,
        response: 'Thanks Alex — glad it worked out! Let us know if you need anything else.',
        respondedAt: SAMPLE_AT,
        createdAt: SAMPLE_AT,
      },
      {
        id: 'sample-review-2',
        rating: 4,
        title: '',
        body: 'Solid product for the price. Took a couple days to arrive but worth the wait.',
        author: 'Riley T.',
        verifiedPurchase: false,
        helpfulCount: 1,
        response: null,
        respondedAt: null,
        createdAt: SAMPLE_AT,
      },
    ],
  },
  questions: [
    {
      id: 'sample-q-1',
      displayName: 'Jordan M.',
      body: 'Will this work with my two-cup press? Want to be sure before I order.',
      createdAt: SAMPLE_AT,
      helpfulCount: 6,
      answers: [
        {
          id: 'sample-a-1',
          body: 'Yes — it fits the Everyday two-cup and four-cup sizes. The Matte White finish is our most popular.',
          isOfficial: true,
          createdAt: SAMPLE_AT,
        },
      ],
    },
    {
      id: 'sample-q-2',
      displayName: 'Sam R.',
      body: 'Is it dishwasher safe?',
      createdAt: SAMPLE_AT,
      helpfulCount: 2,
      answers: [],
    },
  ],
  fitmentDomainsBySlug: {
    compatibility: {
      id: 'sample-domain-compatibility',
      slug: 'compatibility',
      displayName: 'Compatibility',
      description: null,
      iconKey: null,
      dimensions: SAMPLE_COMPAT_DIMENSIONS,
    },
  },
};

export const SAMPLE_COLLECTION: PublicCollection = {
  id: 'sample-collection',
  name: 'Sample Collection',
  handle: 'sample-collection',
  description:
    'A sample collection so you can design your collection page layout — the header and the ' +
    'product grid — before you have real collections.',
  heroMediaId: null,
  featured: true,
  seoTitle: null,
  seoDescription: null,
  ogImageId: null,
};

export const SAMPLE_COLLECTION_PRODUCTS: PublicProductListItem[] = Array.from(
  { length: 8 },
  (_, idx) => sampleListItem(idx + 1)
);
