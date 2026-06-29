// Collection presets (kind 'collections') — installable merchandising surfaces:
// a hand-curated manual list or a rule-driven smart collection (membership
// re-projected by the commerce indexer). Marker is the collection handle.

import type { CreateCollectionInput } from '@sparx/commerce-schemas';

import { collectionService } from '../services';

import { commercePreset } from './_kit';

function collectionPreset(spec: {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  chip: string;
  // handle made required (it keys the install marker), though optional on the schema.
  input: Omit<CreateCollectionInput, 'handle'> & { handle: string };
}) {
  const handle = spec.input.handle;
  return commercePreset({
    slug: spec.slug,
    kind: 'collections',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['collections', ...spec.tags],
    summary: [
      { label: spec.input.type === 'rules' ? 'Smart (rule-driven)' : 'Manual', tone: 'neutral' },
      { label: spec.chip, tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.productCollection
        .findFirst({ where: { tenantId, handle, deletedAt: null }, select: { id: true } })
        .then(Boolean),
    build: async (sx) => {
      const { id } = await collectionService.create(sx, spec.input);
      return { id };
    },
  });
}

export const collectionPresets = [
  collectionPreset({
    slug: 'collection-featured',
    name: 'Featured products',
    description:
      'A hand-curated collection for your bestsellers and staff picks — add products to it manually and surface it on your home page.',
    iconKey: 'star',
    tags: ['featured', 'manual', 'curated'],
    chip: 'Hand-picked',
    input: {
      name: 'Featured products',
      handle: 'featured',
      type: 'manual',
      description: 'Our bestsellers and staff picks.',
      featured: true,
    },
  }),
  collectionPreset({
    slug: 'collection-new-arrivals',
    name: 'New arrivals',
    description:
      'A smart collection that automatically gathers anything tagged “new”, “just-in”, or “featured” — keeps a fresh-products surface current with no manual upkeep.',
    iconKey: 'sparkles',
    tags: ['new', 'smart', 'tags'],
    chip: 'Tagged new / just-in',
    input: {
      name: 'New arrivals',
      handle: 'new-arrivals',
      type: 'rules',
      featured: true,
      ruleSet: {
        match: 'any',
        predicates: [{ field: 'tag', op: 'any_of', value: ['new', 'just-in', 'featured'] }],
      },
    },
  }),
  collectionPreset({
    slug: 'collection-budget-under-25',
    name: 'Under $25',
    description:
      'A smart collection of every product priced $25 or less — a built-in value/budget surface that refreshes itself as prices change.',
    iconKey: 'piggy-bank',
    tags: ['budget', 'smart', 'price'],
    chip: 'Price ≤ $25',
    input: {
      name: 'Under $25',
      handle: 'under-25',
      type: 'rules',
      featured: false,
      ruleSet: {
        match: 'all',
        predicates: [{ field: 'price', op: 'lte', value: 2500 }],
      },
    },
  }),
];
