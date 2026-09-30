// Bundles + Configurator (option matrix + rules + add-ons).
//
// Drives play structures, beauty gift sets, auto-parts kits, custom
// dogfood crates — all through one engine. Output is a ResolvedConfiguration
// the cart can store on CartItem.configurationPayload.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

import { MoneyCents, SignedMoneyCents } from './common';

// ─── Bundles ──────────────────────────────────────────────────────────

export const BundlePricingMode = z.enum(['sum_of_components', 'fixed', 'percent_off_sum']);
export type BundlePricingMode = z.infer<typeof BundlePricingMode>;

export const BundleInventoryMode = z.enum(['decrement_components', 'decrement_bundle_sku']);
export type BundleInventoryMode = z.infer<typeof BundleInventoryMode>;

export const BundleComponentInput = z.object({
  variantId: Uuid,
  defaultQuantity: z.number().int().positive().default(1),
  isRequired: z.boolean().default(true),
  isSwappable: z.boolean().default(false),
  // When isSwappable, storefront can replace this variant with any
  // variant of the linked product. Null = exact-variant only.
  swappableProductId: Uuid.optional(),
  position: z.number().int().nonnegative().default(0),
});
export type BundleComponentInput = z.infer<typeof BundleComponentInput>;

export const CreateBundleInput = z.object({
  bundleProductId: Uuid, // the wrapping product the bundle is sold as
  pricingMode: BundlePricingMode.default('sum_of_components'),
  fixedPriceCents: MoneyCents.nullish(), // required for fixed mode
  percentOffSum: z.number().min(0).max(100).nullish(), // for percent_off_sum
  inventoryMode: BundleInventoryMode.default('decrement_components'),
  components: z.array(BundleComponentInput).min(1).max(50),
});
export type CreateBundleInput = z.infer<typeof CreateBundleInput>;

export const UpdateBundleInput = z.object({
  pricingMode: BundlePricingMode.optional(),
  fixedPriceCents: MoneyCents.nullable().optional(),
  percentOffSum: z.number().min(0).max(100).nullable().optional(),
  inventoryMode: BundleInventoryMode.optional(),
  components: z.array(BundleComponentInput).min(1).max(50).optional(),
});
export type UpdateBundleInput = z.infer<typeof UpdateBundleInput>;

// ─── Configurator templates ───────────────────────────────────────────

export const ConfigurationOptionType = z.enum([
  'single_choice',
  'multi_choice',
  'toggle',
  'quantity',
  'text',
  'color_swatch',
  'image_picker',
]);
export type ConfigurationOptionType = z.infer<typeof ConfigurationOptionType>;

// Each choice resolves to either swapping in a specific variant ("base
// structure", "swing pack add-on") or carrying free-form metadata
// (engraving text, gift message) that downstream fulfillment reads.
export const ConfigurationChoiceInput = z.object({
  key: z.string().min(1).max(63),
  label: z.string().min(1).max(127),
  variantId: Uuid.optional(),
  addOnVariantId: Uuid.optional(),
  priceDeltaCents: SignedMoneyCents.optional(),
  metadataPayload: z.record(z.string(), z.unknown()).optional(),
  swatchHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  imageMediaId: Uuid.optional(),
  position: z.number().int().nonnegative().default(0),
});
export type ConfigurationChoiceInput = z.infer<typeof ConfigurationChoiceInput>;

export const ConfigurationOptionInput = z.object({
  key: z.string().min(1).max(63),
  label: z.string().min(1).max(127),
  helpText: z.string().max(2000).optional(),
  type: ConfigurationOptionType,
  required: z.boolean().default(false),
  minSelections: z.number().int().nonnegative().optional(), // multi_choice
  maxSelections: z.number().int().nonnegative().optional(),
  defaultChoiceKeys: z.array(z.string().min(1).max(63)).max(50).default([]),
  groupHeader: z.string().max(127).optional(),
  position: z.number().int().nonnegative().default(0),
  choices: z.array(ConfigurationChoiceInput).max(250).default([]),
});
export type ConfigurationOptionInput = z.infer<typeof ConfigurationOptionInput>;

// Rules — "when option A in [...] then option B required / hidden / price ±N".
// DSL is intentionally narrow so the editor UI can stay visual.
export const ConfigurationRuleCondition = z.object({
  optionKey: z.string().min(1).max(63),
  // For single/toggle, `in` checks the chosen key.
  // For multi_choice, `in` is "any-of"; use `not_in` for "none-of".
  op: z.enum(['in', 'not_in', 'gt', 'lt', 'eq']),
  value: z.union([z.string(), z.number(), z.array(z.string()).max(50)]),
});
export type ConfigurationRuleCondition = z.infer<typeof ConfigurationRuleCondition>;

export const ConfigurationRuleAction = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('require'), optionKey: z.string().min(1).max(63) }),
  z.object({ kind: z.literal('hide'), optionKey: z.string().min(1).max(63) }),
  z.object({
    kind: z.literal('show_only_choices'),
    optionKey: z.string().min(1).max(63),
    choiceKeys: z.array(z.string().min(1).max(63)).min(1).max(50),
  }),
  z.object({
    kind: z.literal('price_adjust'),
    deltaCents: SignedMoneyCents,
    label: z.string().max(127).optional(),
  }),
  z.object({
    kind: z.literal('add_addon'),
    variantId: Uuid,
    quantity: z.number().int().positive().default(1),
  }),
  z.object({
    kind: z.literal('error'),
    message: z.string().min(1).max(255),
  }),
]);
export type ConfigurationRuleAction = z.infer<typeof ConfigurationRuleAction>;

export const ConfigurationRuleInput = z.object({
  name: z.string().min(1).max(127),
  match: z.enum(['all', 'any']).default('all'),
  conditions: z.array(ConfigurationRuleCondition).min(1).max(20),
  actions: z.array(ConfigurationRuleAction).min(1).max(20),
  priority: z.number().int().nonnegative().default(0),
});
export type ConfigurationRuleInput = z.infer<typeof ConfigurationRuleInput>;

export const ConfigurationAddOnInput = z.object({
  variantId: Uuid,
  defaultIncluded: z.boolean().default(false),
  priceOverrideCents: MoneyCents.optional(),
});
export type ConfigurationAddOnInput = z.infer<typeof ConfigurationAddOnInput>;

export const CreateConfigurationTemplateInput = z.object({
  productId: Uuid,
  name: z.string().min(1).max(127),
  description: z.string().max(2000).nullish(),
  // Layout payload — step order, headers, visual hints. Free-form JSONB
  // so the dashboard editor can evolve without schema changes.
  layout: z
    .object({
      steps: z
        .array(
          z.object({
            key: z.string().min(1).max(63),
            label: z.string().min(1).max(127),
            optionKeys: z.array(z.string().min(1).max(63)),
          })
        )
        .max(30)
        .optional(),
      visualHints: z.record(z.string(), z.unknown()).optional(),
    })
    .default({}),
  options: z.array(ConfigurationOptionInput).min(1).max(50),
  rules: z.array(ConfigurationRuleInput).max(100).default([]),
  addOns: z.array(ConfigurationAddOnInput).max(100).default([]),
});
export type CreateConfigurationTemplateInput = z.infer<typeof CreateConfigurationTemplateInput>;

export const UpdateConfigurationTemplateInput = z.object({
  name: z.string().min(1).max(127).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  // `.unwrap()` strips the create-side `.default({})`. Without it Zod fabricates
  // `layout: {}` for a body that never mentioned layout, and the service writes
  // every non-undefined key — so renaming a configurator ERASED its layout
  // (step grouping and visual hints) and left the buyer a flat option dump.
  layout: CreateConfigurationTemplateInput.shape.layout.unwrap().optional(),
  options: z.array(ConfigurationOptionInput).min(1).max(50).optional(),
  rules: z.array(ConfigurationRuleInput).max(100).optional(),
  addOns: z.array(ConfigurationAddOnInput).max(100).optional(),
});
export type UpdateConfigurationTemplateInput = z.infer<typeof UpdateConfigurationTemplateInput>;

// ─── Resolution (cart side) ───────────────────────────────────────────

// What the storefront submits when the user clicks "Add to cart" on a
// configurable product.
export const ConfigurationSelection = z.object({
  templateId: Uuid,
  selections: z.record(
    z.string().min(1).max(63),
    z.union([z.string(), z.array(z.string()).max(50), z.number(), z.boolean()])
  ),
});
export type ConfigurationSelection = z.infer<typeof ConfigurationSelection>;

// What the configurator service returns. Pricing pipeline consumes these
// as if they were ordinary cart lines.
export const ResolvedConfiguration = z.object({
  templateId: Uuid,
  resolvedVariantId: Uuid.nullable(),
  resolvedSku: z.string().min(1).max(127),
  resolvedComponentVariantIds: z.array(Uuid).default([]),
  addOnLines: z
    .array(
      z.object({
        variantId: Uuid,
        quantity: z.number().int().positive(),
        unitPriceCents: MoneyCents,
        label: z.string().max(127).optional(),
      })
    )
    .default([]),
  basePriceCents: MoneyCents,
  totalAdjustmentCents: SignedMoneyCents,
  errors: z.array(z.string().max(255)).default([]),
  selectionsEcho: ConfigurationSelection.shape.selections,
});
export type ResolvedConfiguration = z.infer<typeof ResolvedConfiguration>;

/* ── What a set costs ───────────────────────────────────────────────────── */

/** One part of a set, priced. */
export interface BundlePart {
  priceCents: number;
  quantity: number;
}

/**
 * What the parts come to at their own prices.
 *
 * EVERY part, required or not. "Optional" here means the storefront may swap
 * or drop it at pick time, and there is nowhere for a shopper to say they did,
 * so pricing as though they had would undercharge every real sale. The day a
 * cart line can carry "this set, without the scarf" is the day this takes a
 * selection argument.
 */
export function bundlePartsTotalCents(parts: readonly BundlePart[]): number {
  return parts.reduce(
    (sum, part) => sum + Math.max(0, part.priceCents) * Math.max(0, part.quantity),
    0
  );
}

export interface BundlePriceInput {
  /** A `BundlePricingMode`, typed loosely because every caller reads it off a
   *  database row where it is a `VarChar(20)`. An unrecognized value falls back
   *  to the parts' total rather than throwing: this is priced on a live
   *  storefront, and a set whose mode string was renamed under it should cost
   *  what its parts cost, not nothing. */
  pricingMode: string;
  partsTotalCents: number;
  fixedPriceCents?: number | null;
  percentOffSum?: number | null;
}

/**
 * What a shopper pays for a set, from the rule its owner chose.
 *
 * ONE function, called by the pricing pipeline that charges the shopper AND by
 * the console form that promises her a number. Two copies of this arithmetic
 * would be two answers to "what does the set cost", and the one she reads while
 * setting it up is the one she would never think to doubt.
 *
 * A mode that needs a number it has not got falls back to the parts' total
 * rather than to zero. `assertBundlePricingCoherent` rejects that combination
 * on the way in, so it should be unreachable — but "unreachable" and "free" are
 * different, and a set that silently costs nothing is the worse of the two
 * outcomes by a distance.
 */
export function bundleSetPriceCents(input: BundlePriceInput): number {
  const parts = Math.max(0, Math.round(input.partsTotalCents));
  if (input.pricingMode === 'fixed') {
    return input.fixedPriceCents == null ? parts : Math.max(0, Math.round(input.fixedPriceCents));
  }
  if (input.pricingMode === 'percent_off_sum') {
    if (input.percentOffSum == null) return parts;
    const off = Math.min(100, Math.max(0, input.percentOffSum));
    return Math.max(0, Math.round((parts * (100 - off)) / 100));
  }
  return parts;
}
