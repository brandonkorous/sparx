// Category taxonomy presets (kind 'categories') — installable nested category
// trees (the organizational spine a product lives in). Industry-varied; each
// stamps a multi-level tree via categoryService.create (which auto-uniquifies
// handles, so child handles never hard-fail). Marker is the root handle.

import type { TenantContext } from '@sparx/db';

import { categoryService } from '../services';

import { commercePreset } from './_kit';

interface CatNode {
  name: string;
  handle: string;
  featured?: boolean;
  children?: CatNode[];
}

async function createTree(
  sx: TenantContext,
  nodes: CatNode[],
  parentId: string | null
): Promise<string> {
  let firstId = '';
  let position = 0;
  for (const node of nodes) {
    const { id } = await categoryService.create(sx, {
      name: node.name,
      handle: node.handle,
      parentId: parentId ?? undefined,
      position: position++,
      featured: node.featured ?? false,
    });
    if (!firstId) firstId = id;
    if (node.children?.length) await createTree(sx, node.children, id);
  }
  return firstId;
}

function taxonomyPreset(spec: {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  topLabels: string;
  root: CatNode;
}) {
  return commercePreset({
    slug: spec.slug,
    kind: 'categories',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['categories', ...spec.tags],
    summary: [
      { label: spec.topLabels, tone: 'neutral' },
      { label: 'Nested tree', tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.productCategory
        .findFirst({
          where: { tenantId, handle: spec.root.handle, deletedAt: null },
          select: { id: true },
        })
        .then(Boolean),
    build: async (sx) => ({ id: await createTree(sx, [spec.root], null) }),
  });
}

export const categoryPresets = [
  taxonomyPreset({
    slug: 'categories-apparel',
    name: 'Apparel taxonomy',
    description:
      'A clothing, footwear, and accessories tree with Men / Women / Kids splits — a ready spine for a fashion or apparel catalog.',
    iconKey: 'shirt',
    tags: ['apparel', 'clothing', 'fashion'],
    topLabels: 'Clothing · Footwear · Accessories',
    root: {
      name: 'Apparel',
      handle: 'apparel',
      featured: true,
      children: [
        {
          name: 'Clothing',
          handle: 'clothing',
          children: [
            { name: 'Men', handle: 'mens' },
            { name: 'Women', handle: 'womens' },
            { name: 'Kids', handle: 'kids' },
          ],
        },
        {
          name: 'Footwear',
          handle: 'footwear',
          children: [
            { name: 'Sneakers', handle: 'sneakers' },
            { name: 'Boots', handle: 'boots' },
            { name: 'Sandals', handle: 'sandals' },
          ],
        },
        {
          name: 'Accessories',
          handle: 'accessories',
          children: [
            { name: 'Bags', handle: 'bags' },
            { name: 'Hats', handle: 'hats' },
            { name: 'Belts', handle: 'belts' },
          ],
        },
      ],
    },
  }),
  taxonomyPreset({
    slug: 'categories-food-beverage',
    name: 'Food & beverage taxonomy',
    description:
      'A grocery-style tree across produce, pantry, beverages, and specialty — a base for a food, grocery, or specialty-foods catalog.',
    iconKey: 'apple',
    tags: ['food', 'beverage', 'grocery'],
    topLabels: 'Produce · Pantry · Beverages · Specialty',
    root: {
      name: 'Food & beverage',
      handle: 'food-beverage',
      featured: true,
      children: [
        {
          name: 'Produce',
          handle: 'produce',
          children: [
            { name: 'Fruit', handle: 'fruit' },
            { name: 'Vegetables', handle: 'vegetables' },
          ],
        },
        {
          name: 'Pantry',
          handle: 'pantry',
          children: [
            { name: 'Grains & pasta', handle: 'grains-pasta' },
            { name: 'Canned & jarred', handle: 'canned-jarred' },
          ],
        },
        {
          name: 'Beverages',
          handle: 'beverages',
          children: [
            { name: 'Coffee & tea', handle: 'coffee-tea' },
            { name: 'Juice & soda', handle: 'juice-soda' },
            { name: 'Wine & spirits', handle: 'wine-spirits' },
          ],
        },
        { name: 'Specialty', handle: 'specialty' },
      ],
    },
  }),
  taxonomyPreset({
    slug: 'categories-electronics',
    name: 'Electronics taxonomy',
    description:
      'A consumer-electronics tree across computers, audio, mobile, and accessories — a starting spine for a tech or gadget catalog.',
    iconKey: 'cpu',
    tags: ['electronics', 'tech', 'gadgets'],
    topLabels: 'Computers · Audio · Mobile · Accessories',
    root: {
      name: 'Electronics',
      handle: 'electronics',
      featured: true,
      children: [
        {
          name: 'Computers',
          handle: 'computers',
          children: [
            { name: 'Laptops', handle: 'laptops' },
            { name: 'Desktops', handle: 'desktops' },
            { name: 'Monitors', handle: 'monitors' },
          ],
        },
        {
          name: 'Audio',
          handle: 'audio',
          children: [
            { name: 'Headphones', handle: 'headphones' },
            { name: 'Speakers', handle: 'speakers' },
          ],
        },
        {
          name: 'Mobile',
          handle: 'mobile',
          children: [
            { name: 'Phones', handle: 'phones' },
            { name: 'Tablets', handle: 'tablets' },
            { name: 'Wearables', handle: 'wearables' },
          ],
        },
        { name: 'Accessories', handle: 'electronics-accessories' },
      ],
    },
  }),
];
