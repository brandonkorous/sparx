// Farm Fresh — commerce catalog (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.

export default {
  categories: [
    {
      handle: 'acai-bowls',
      name: 'Açaí & Smoothie Bowls',
      description: 'Blended-to-order bowls topped with fruit, granola and seeds.',
      featured: true,
      position: 0,
    },
    {
      handle: 'smoothies',
      name: 'Cold-Pressed Smoothies',
      description: 'Fresh-pressed smoothies, never from concentrate.',
      position: 1,
    },
    {
      handle: 'salads-grains',
      name: 'Salads & Grain Bowls',
      description: 'Hearty, balanced salads and grain bowls.',
      position: 2,
    },
  ],
  collections: [
    {
      handle: 'signature-bowls',
      name: 'Signature Bowls',
      description: 'Our most-loved açaí and smoothie bowls.',
      type: 'manual',
      featured: true,
      productHandles: ['midnight-acai', 'strawberry-fields', 'green-machine'],
    },
  ],
  products: [
    {
      handle: 'midnight-acai',
      title: 'Midnight Açaí',
      description:
        'Pure açaí blended with banana & almond milk, topped with granola, blueberries, coconut and a drizzle of raw honey.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['vegan', 'antioxidant'],
      categoryHandles: ['acai-bowls'],
      collectionHandles: ['signature-bowls'],
      variants: [
        {
          sku: 'MIDNIGHTACAI',
          priceCents: 1150,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-midnight-acai',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'strawberry-fields',
      title: 'Strawberry Fields',
      description:
        'Local strawberries & dragon fruit over a creamy banana base, finished with hemp hearts, fresh berries and mint.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['gluten-free', 'local'],
      categoryHandles: ['acai-bowls'],
      collectionHandles: ['signature-bowls'],
      variants: [
        {
          sku: 'STRAWBERRYFI',
          priceCents: 1075,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-strawberry-fields',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'green-machine',
      title: 'Green Machine',
      description:
        'Spinach, kale, kiwi and pineapple blended smooth, topped with kiwi, chia, toasted coconut and house granola.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['detox', 'vegan'],
      categoryHandles: ['acai-bowls'],
      collectionHandles: ['signature-bowls'],
      variants: [
        {
          sku: 'GREENMACHINE',
          priceCents: 1195,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-green-machine',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'mango-sunrise',
      title: 'Mango Sunrise',
      description: 'Mango, orange, carrot & turmeric with a ginger kick.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['vegan'],
      categoryHandles: ['smoothies'],
      variants: [
        {
          sku: 'MANGOSUNRISE',
          priceCents: 825,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-mango-sunrise',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'blue-recovery',
      title: 'Blue Recovery',
      description: 'Wild blueberry, banana, oat milk & plant protein.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['protein'],
      categoryHandles: ['smoothies'],
      variants: [
        {
          sku: 'BLUERECOVERY',
          priceCents: 875,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-blue-recovery',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'citrus-glow',
      title: 'Citrus Glow',
      description: 'Orange, pineapple, lemon & a hint of cayenne.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['immunity'],
      categoryHandles: ['smoothies'],
      variants: [
        {
          sku: 'CITRUSGLOW',
          priceCents: 795,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-citrus-glow',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'coco-almond',
      title: 'Coco Almond',
      description: 'Coconut, almond butter, dates, banana & cinnamon.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['vegan'],
      categoryHandles: ['smoothies'],
      variants: [
        {
          sku: 'COCOALMOND',
          priceCents: 850,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-coco-almond',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'harvest-kale',
      title: 'Harvest Kale',
      description: 'Massaged kale, roasted squash, quinoa, pomegranate & tahini-lemon dressing.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['high-protein', 'seasonal'],
      categoryHandles: ['salads-grains'],
      variants: [
        {
          sku: 'HARVESTKALE',
          priceCents: 1250,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-harvest-kale',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'avocado-power',
      title: 'Avocado Power',
      description: 'Brown rice, avocado, edamame, cucumber, pickled carrot & sesame-ginger.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['vegan', 'filling'],
      categoryHandles: ['salads-grains'],
      variants: [
        {
          sku: 'AVOCADOPOWER',
          priceCents: 1325,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-avocado-power',
          isPrimary: true,
        },
      ],
    },
    {
      handle: 'southwest-grain',
      title: 'Southwest Grain',
      description: 'Farro, black beans, roasted corn, peppers, cilantro & chipotle-lime crema.',
      status: 'draft',
      productType: 'Bowl',
      vendor: 'Farm Fresh',
      tags: ['hearty', 'local'],
      categoryHandles: ['salads-grains'],
      variants: [
        {
          sku: 'SOUTHWESTGRA',
          priceCents: 1295,
          isDefault: true,
        },
      ],
      images: [
        {
          assetId: 'img-southwest-grain',
          isPrimary: true,
        },
      ],
    },
  ],
};
