// Farm Fresh generator — commerce catalog: the 10 products, their media asset
// references (`assets`), and the categories/collections/products payload (`commerce`).
// Both are spread into the manifest verbatim — pure data, no node() calls — so they
// resolve before any builder tree is assembled.

import { photoSvg } from './media';

interface ProductSpec {
  handle: string;
  title: string;
  description: string;
  category: string;
  collections?: string[];
  priceCents: number;
  tags: string[];
  seed: string;
}

const PRODUCTS: ProductSpec[] = [
  // Açaí & smoothie bowls
  { handle: 'midnight-acai', title: 'Midnight Açaí', description: 'Pure açaí blended with banana & almond milk, topped with granola, blueberries, coconut and a drizzle of raw honey.', category: 'acai-bowls', collections: ['signature-bowls'], priceCents: 1150, tags: ['vegan', 'antioxidant'], seed: 'acai' },
  { handle: 'strawberry-fields', title: 'Strawberry Fields', description: 'Local strawberries & dragon fruit over a creamy banana base, finished with hemp hearts, fresh berries and mint.', category: 'acai-bowls', collections: ['signature-bowls'], priceCents: 1075, tags: ['gluten-free', 'local'], seed: 'strawberry' },
  { handle: 'green-machine', title: 'Green Machine', description: 'Spinach, kale, kiwi and pineapple blended smooth, topped with kiwi, chia, toasted coconut and house granola.', category: 'acai-bowls', collections: ['signature-bowls'], priceCents: 1195, tags: ['detox', 'vegan'], seed: 'green' },
  // Cold-pressed smoothies
  { handle: 'mango-sunrise', title: 'Mango Sunrise', description: 'Mango, orange, carrot & turmeric with a ginger kick.', category: 'smoothies', priceCents: 825, tags: ['vegan'], seed: 'mango' },
  { handle: 'blue-recovery', title: 'Blue Recovery', description: 'Wild blueberry, banana, oat milk & plant protein.', category: 'smoothies', priceCents: 875, tags: ['protein'], seed: 'blueberry' },
  { handle: 'citrus-glow', title: 'Citrus Glow', description: 'Orange, pineapple, lemon & a hint of cayenne.', category: 'smoothies', priceCents: 795, tags: ['immunity'], seed: 'citrus' },
  { handle: 'coco-almond', title: 'Coco Almond', description: 'Coconut, almond butter, dates, banana & cinnamon.', category: 'smoothies', priceCents: 850, tags: ['vegan'], seed: 'coconut' },
  // Salads & grain bowls
  { handle: 'harvest-kale', title: 'Harvest Kale', description: 'Massaged kale, roasted squash, quinoa, pomegranate & tahini-lemon dressing.', category: 'salads-grains', priceCents: 1250, tags: ['high-protein', 'seasonal'], seed: 'kale' },
  { handle: 'avocado-power', title: 'Avocado Power', description: 'Brown rice, avocado, edamame, cucumber, pickled carrot & sesame-ginger.', category: 'salads-grains', priceCents: 1325, tags: ['vegan', 'filling'], seed: 'avocado' },
  { handle: 'southwest-grain', title: 'Southwest Grain', description: 'Farro, black beans, roasted corn, peppers, cilantro & chipotle-lime crema.', category: 'salads-grains', priceCents: 1295, tags: ['hearty', 'local'], seed: 'southwest' },
];

export const assets = PRODUCTS.map((p) => ({
  id: `img-${p.handle}`,
  url: photoSvg(p.seed),
  alt: p.title,
}));

export const commerce = {
  categories: [
    { handle: 'acai-bowls', name: 'Açaí & Smoothie Bowls', description: 'Blended-to-order bowls topped with fruit, granola and seeds.', featured: true, position: 0 },
    { handle: 'smoothies', name: 'Cold-Pressed Smoothies', description: 'Fresh-pressed smoothies, never from concentrate.', position: 1 },
    { handle: 'salads-grains', name: 'Salads & Grain Bowls', description: 'Hearty, balanced salads and grain bowls.', position: 2 },
  ],
  collections: [
    {
      handle: 'signature-bowls',
      name: 'Signature Bowls',
      description: 'Our most-loved açaí and smoothie bowls.',
      type: 'manual' as const,
      featured: true,
      productHandles: ['midnight-acai', 'strawberry-fields', 'green-machine'],
    },
    {
      // A cross-category "customer favorites" set — drives the PDP "Fresh favorites"
      // cross-sell (bound by handle) and gives the /collections page a second, varied
      // collection. Spans all three menu groups so any product page recommends variety.
      handle: 'fan-favorites',
      name: 'Fan Favorites',
      description: 'The bowls, smoothies and grain bowls our regulars order on repeat.',
      type: 'manual' as const,
      featured: true,
      productHandles: [
        'strawberry-fields',
        'green-machine',
        'mango-sunrise',
        'blue-recovery',
        'harvest-kale',
        'avocado-power',
      ],
    },
  ],
  products: PRODUCTS.map((p) => ({
    handle: p.handle,
    title: p.title,
    description: p.description,
    status: 'draft' as const,
    productType: 'Bowl',
    vendor: 'Farm Fresh',
    tags: p.tags,
    categoryHandles: [p.category],
    ...(p.collections ? { collectionHandles: p.collections } : {}),
    variants: [
      {
        sku: p.handle.toUpperCase().replace(/-/g, '').slice(0, 12),
        priceCents: p.priceCents,
        isDefault: true,
        // Made-to-order bowls — always purchasable, no stock to track. Without this the
        // variant defaults to `deny` and, with no inventory seeded, every card reads
        // "Sold out". `continue` accepts the order so the demo ships shoppable.
        inventoryPolicy: 'continue' as const,
      },
    ],
    images: [{ assetId: `img-${p.handle}`, isPrimary: true }],
  })),
};
