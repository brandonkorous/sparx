// Categories (nested tree) + Collections (manual list or rule-driven).
//
// Distinct concepts: categories are the *organizational tree* (Auto Parts >
// Engine > Fuel Injection); a product lives in one canonical category but
// can appear in many collections. Collections are the *merchandising
// surface* — "Featured", "New for Spring", "Diesel Service Specials" —
// either hand-curated or driven by a rule set evaluated at render time.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

import { Handle, MoneyCents } from './common';
import { SeoFields } from './products';

// ─── Category (nested tree, ltree-backed) ─────────────────────────────

export const CreateCategoryInput = z.object({
  name: z.string().min(1).max(127),
  handle: Handle.optional(),
  description: z.string().max(10_000).nullable().optional(),
  parentId: Uuid.nullable().optional(),
  position: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
  iconMediaId: Uuid.nullable().optional(),
  heroMediaId: Uuid.nullable().optional(),
  // Model B per-site scoping (docs/49 §3): the web PROPERTIES this category is
  // visible on. EMPTY = visible on ALL sites (the default). Update sends the full
  // replacement set; UpdateCategoryInput inherits it as optional via .partial().
  propertyIds: z.array(Uuid).max(50).default([]),
  ...SeoFields.shape,
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInput>;

// `.partial()` makes every field optional but — in this Zod version — does NOT strip
// the `.default()`s, so a partial update that OMITS a defaulted field comes back with
// the create default re-applied (position:0, featured:false, propertyIds:[]). Every
// update service guards on `input.X !== undefined`, so those re-applied defaults
// silently CLOBBER on a partial edit: a plain rename would reset priority to 0 and
// WIPE the site-scope links. Override the defaulted fields as plain-optional so
// "omitted = untouched" holds — mirroring how UpdateProductInput is built separately.
export const UpdateCategoryInput = CreateCategoryInput.partial().extend({
  position: z.number().int().nonnegative().optional(),
  featured: z.boolean().optional(),
  propertyIds: z.array(Uuid).max(50).optional(),
});
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInput>;

export const ReparentCategoryInput = z.object({
  categoryId: Uuid,
  newParentId: Uuid.nullable(),
  newPosition: z.number().int().nonnegative(),
});
export type ReparentCategoryInput = z.infer<typeof ReparentCategoryInput>;

// ─── Collection rule set ──────────────────────────────────────────────
//
// Rules are evaluated at index time (Typesense reindex) — not at every
// page load — so changing a rule re-projects the membership async via the
// commerce-indexer worker. Match modes mirror Shopify's vocabulary.

export const CollectionPredicate = z.discriminatedUnion('field', [
  z.object({
    field: z.literal('title'),
    op: z.enum(['contains', 'equals', 'starts_with', 'ends_with']),
    value: z.string().min(1).max(255),
  }),
  z.object({
    field: z.literal('vendor'),
    op: z.enum(['equals', 'in']),
    value: z.union([z.string().min(1).max(127), z.array(z.string()).max(50)]),
  }),
  z.object({
    field: z.literal('product_type'),
    op: z.enum(['equals', 'in']),
    value: z.union([z.string().min(1).max(127), z.array(z.string()).max(50)]),
  }),
  z.object({
    field: z.literal('tag'),
    op: z.enum(['equals', 'any_of', 'all_of', 'none_of']),
    value: z.union([z.string().min(1).max(63), z.array(z.string()).max(50)]),
  }),
  z.object({
    field: z.literal('price'),
    op: z.enum(['lt', 'lte', 'gt', 'gte', 'between']),
    value: z.union([MoneyCents, z.tuple([MoneyCents, MoneyCents])]),
  }),
  z.object({
    field: z.literal('inventory'),
    op: z.enum(['in_stock', 'out_of_stock', 'low_stock']),
    value: z.boolean().default(true),
  }),
  z.object({
    field: z.literal('fitment'),
    op: z.literal('matches'),
    value: z.object({
      domainId: Uuid.optional(),
      categoryId: Uuid.optional(),
      itemId: Uuid.optional(),
      variantId: Uuid.optional(),
      rangeValue: z.number().optional(),
    }),
  }),
]);
export type CollectionPredicate = z.infer<typeof CollectionPredicate>;

export const CollectionRuleSet = z.object({
  match: z.enum(['all', 'any']).default('all'),
  predicates: z.array(CollectionPredicate).min(1).max(20),
});
export type CollectionRuleSet = z.infer<typeof CollectionRuleSet>;

// ─── Collection ───────────────────────────────────────────────────────

export const CollectionType = z.enum(['manual', 'rules']);
export type CollectionType = z.infer<typeof CollectionType>;

export const CreateCollectionInput = z.object({
  name: z.string().min(1).max(127),
  handle: Handle.optional(),
  description: z.string().max(10_000).nullable().optional(),
  type: CollectionType.default('manual'),
  ruleSet: CollectionRuleSet.optional(), // required when type=rules
  heroMediaId: Uuid.nullable().optional(),
  featured: z.boolean().default(false),
  // Model B per-site scoping (docs/49 §3): the web PROPERTIES this collection is
  // visible on. EMPTY = visible on ALL sites (the default). Update sends the full
  // replacement set; UpdateCollectionInput inherits it as optional via .partial().
  propertyIds: z.array(Uuid).max(50).default([]),
  ...SeoFields.shape,
});
export type CreateCollectionInput = z.infer<typeof CreateCollectionInput>;

// See UpdateCategoryInput: `.partial()` keeps the create `.default()`s, so a partial
// edit that omits these would re-apply them and clobber via the service's
// `!== undefined` guards. Worse for `type` — a metadata rename of a RULES collection
// omits `type`, the re-applied `manual` default trips the type-flip guard, and the
// save THROWS. Strip the defaults so omitted fields stay truly absent.
export const UpdateCollectionInput = CreateCollectionInput.partial().extend({
  type: CollectionType.optional(),
  featured: z.boolean().optional(),
  propertyIds: z.array(Uuid).max(50).optional(),
});
export type UpdateCollectionInput = z.infer<typeof UpdateCollectionInput>;

export const SetCollectionProductsInput = z.object({
  collectionId: Uuid,
  productIds: z.array(Uuid).max(5000),
});
export type SetCollectionProductsInput = z.infer<typeof SetCollectionProductsInput>;
