// The canvas sample product (docs/builder/02 §2.2, §6 "sample-data fidelity").
//
// A merchant designs a product layout before any real product exists, and the
// storefront only serves active records — so the editor canvas can't resolve a
// real `commerce.product` binding. The live BuyBox/VariantPicker read a
// `BuilderProduct`; the canvas placeholder data isn't that shape, which is why the
// commerce atoms used to render hand-written MOCKS. Instead, the unified renderer
// feeds the commerce atoms THIS fixture in edit mode, so the canvas shows the REAL
// component with believable values.
//
// Deliberately non-trivial (the §6 risk): two options (a swatch colour + a size),
// several variants, a sale price (compare-at), and an OUT-OF-STOCK combination —
// so the picker previews disabled states, the price reflects the selected variant,
// and "Sold out" can appear. An unrealistic 1-variant/1-option sample would still
// mis-teach the layout.

import type { BuilderProduct } from './commerce-types';

export const SAMPLE_BUILDER_PRODUCT: BuilderProduct = {
  id: 'sample-product',
  handle: 'sample-product',
  title: 'Sample Product — Trailhead Insulated Jacket',
  price: 148,
  compareAtPrice: 188,
  description:
    'Sample product copy. Use it to design your product page — the buy box, the gallery, the ' +
    'details — before you have real products. Every published product renders through this layout.',
  images: [],
  sku: 'SAMPLE-JKT',
  currency: 'USD',
  priceMinCents: 14800,
  priceMaxCents: 16800,
  options: [
    {
      id: 'sample-opt-color',
      name: 'Color',
      displayType: 'swatch',
      values: [
        { id: 'sample-color-graphite', value: 'Graphite', swatchHex: '#3a3f44' },
        { id: 'sample-color-sand', value: 'Sand', swatchHex: '#cdbfa3' },
        { id: 'sample-color-forest', value: 'Forest', swatchHex: '#2f5d4f' },
      ],
    },
    {
      id: 'sample-opt-size',
      name: 'Size',
      displayType: 'pill',
      values: [
        { id: 'sample-size-s', value: 'S', swatchHex: null },
        { id: 'sample-size-m', value: 'M', swatchHex: null },
        { id: 'sample-size-l', value: 'L', swatchHex: null },
      ],
    },
  ],
  // One variant per colour × size that we care to show; the Forest/L combination
  // is intentionally out of stock so the picker previews a disabled value and the
  // CTA can read "Sold out". Prices step up for the larger size (a range product).
  variants: [
    {
      id: 'sample-var-graphite-s',
      sku: 'SAMPLE-JKT-GR-S',
      title: 'Graphite / S',
      priceCents: 14800,
      compareAtPriceCents: 18800,
      isDefault: true,
      inStock: true,
      available: 24,
      optionValueIds: ['sample-color-graphite', 'sample-size-s'],
    },
    {
      id: 'sample-var-graphite-m',
      sku: 'SAMPLE-JKT-GR-M',
      title: 'Graphite / M',
      priceCents: 14800,
      compareAtPriceCents: 18800,
      isDefault: false,
      inStock: true,
      available: 16,
      optionValueIds: ['sample-color-graphite', 'sample-size-m'],
    },
    {
      id: 'sample-var-graphite-l',
      sku: 'SAMPLE-JKT-GR-L',
      title: 'Graphite / L',
      priceCents: 16800,
      compareAtPriceCents: null,
      isDefault: false,
      inStock: true,
      available: 9,
      optionValueIds: ['sample-color-graphite', 'sample-size-l'],
    },
    {
      id: 'sample-var-sand-s',
      sku: 'SAMPLE-JKT-SD-S',
      title: 'Sand / S',
      priceCents: 14800,
      compareAtPriceCents: 18800,
      isDefault: false,
      inStock: true,
      available: 11,
      optionValueIds: ['sample-color-sand', 'sample-size-s'],
    },
    {
      id: 'sample-var-sand-m',
      sku: 'SAMPLE-JKT-SD-M',
      title: 'Sand / M',
      priceCents: 14800,
      compareAtPriceCents: 18800,
      isDefault: false,
      inStock: true,
      available: 4,
      optionValueIds: ['sample-color-sand', 'sample-size-m'],
    },
    {
      id: 'sample-var-forest-m',
      sku: 'SAMPLE-JKT-FR-M',
      title: 'Forest / M',
      priceCents: 14800,
      compareAtPriceCents: 18800,
      isDefault: false,
      inStock: true,
      available: 7,
      optionValueIds: ['sample-color-forest', 'sample-size-m'],
    },
    {
      id: 'sample-var-forest-l',
      sku: 'SAMPLE-JKT-FR-L',
      title: 'Forest / L',
      priceCents: 16800,
      compareAtPriceCents: null,
      isDefault: false,
      inStock: false,
      available: 0,
      optionValueIds: ['sample-color-forest', 'sample-size-l'],
    },
  ],
  // Typed attributes (docs/143) — an `apparel`-shaped sample so the canvas previews
  // the auto-render attribute sections + individual `attributes.<key>` binds a real
  // apparel product would carry.
  attributes: {
    fabric:
      'Sample copy — a 3-layer insulated shell with a recycled ripstop face and a brushed inner. Replace this with the real fabric story per product.',
    fit: 'Regular fit, true to size, with room to layer.',
    care: 'Machine wash cold, tumble dry low. Do not iron the membrane.',
    materials: 'Face — 100%, Insulation — 80%',
    origin: 'Vietnam',
  },
  attributeSections: [
    {
      key: 'fabric',
      label: 'Fabric & construction',
      kind: 'long_text',
      value:
        'Sample copy — a 3-layer insulated shell with a recycled ripstop face and a brushed inner. Replace this with the real fabric story per product.',
      items: [],
    },
    {
      key: 'fit',
      label: 'Fit',
      kind: 'long_text',
      value: 'Regular fit, true to size, with room to layer.',
      items: [],
    },
    {
      key: 'care',
      label: 'Care',
      kind: 'long_text',
      value: 'Machine wash cold, tumble dry low. Do not iron the membrane.',
      items: [],
    },
    {
      key: 'materials',
      label: 'Materials',
      // Repeater section: value is empty so the auto-render sub-repeats `items`.
      kind: 'repeater',
      value: '',
      items: [
        { label: 'Recycled ripstop face', value: '100%' },
        { label: 'Recycled insulation', value: '80%' },
      ],
    },
    { key: 'origin', label: 'Made in', kind: 'text', value: 'Vietnam', items: [] },
  ],
};
