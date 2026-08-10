// Pricing — price lists, contract prices (B2B), bulk tiers.
// Discounts and gift cards are siblings in ./discounts.ts.
//
// Resolution order is locked: contract price (B2B) → price list →
// bulk tier → variant base price. Discounts apply on top (./discounts.ts).

import { z } from 'zod';

import { Uuid } from '@sparx/crm-schemas';

import { Channel, Currency, MoneyCents } from './common';

// ─── Price lists ─────────────────────────────────────────────────────

export const PriceListStatus = z.enum(['draft', 'active', 'archived']);
export type PriceListStatus = z.infer<typeof PriceListStatus>;

export const CreatePriceListInput = z.object({
  name: z.string().min(1).max(127),
  description: z.string().max(2000).optional(),
  currency: Currency,
  // null = applies on all channels. Nullable (not merely optional) so an update
  // can CLEAR a channel back to "everywhere" — the service already maps null
  // through to the column.
  channel: Channel.nullable().optional(),
  // Targeting — at most one of these is set; both null means "default
  // for the channel".
  customerSegmentId: Uuid.nullable().optional(),
  companyId: Uuid.nullable().optional(),
  priority: z.number().int().nonnegative().default(0),
  // Nullable so an update can clear a previously-set go-live window. The service
  // treats a falsy value as "no date" (writes null).
  validFrom: z.string().datetime().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
  status: PriceListStatus.default('draft'),
});
export type CreatePriceListInput = z.infer<typeof CreatePriceListInput>;

// Defaults survive `.partial()` (see UpdateProductInput / UpdateCategoryInput),
// and the service writes every key that isn't undefined — so editing a price
// list's NAME silently reverted it to `draft`, unpublishing live pricing, and
// reset its priority to 0, changing which list wins. Re-declared as plain
// optional. Keep in sync with every `.default()` in CreatePriceListInput.
export const UpdatePriceListInput = CreatePriceListInput.partial().extend({
  priority: z.number().int().nonnegative().optional(),
  status: PriceListStatus.optional(),
});
export type UpdatePriceListInput = z.infer<typeof UpdatePriceListInput>;

// Entry: either a fixed price OR a percent-off-list, never both.
export const PriceListEntryInput = z
  .object({
    priceListId: Uuid,
    variantId: Uuid,
    fixedPriceCents: MoneyCents.nullable().optional(),
    percentOffList: z.number().min(0).max(100).nullable().optional(),
    minQuantity: z.number().int().positive().default(1),
    maxQuantity: z.number().int().positive().optional(),
  })
  .refine((entry) => (entry.fixedPriceCents == null) !== (entry.percentOffList == null), {
    message: 'Set exactly one of fixedPriceCents or percentOffList',
  });
export type PriceListEntryInput = z.infer<typeof PriceListEntryInput>;

export const BulkSetPriceListEntriesInput = z.object({
  priceListId: Uuid,
  entries: z
    .array(
      z.object({
        variantId: Uuid,
        fixedPriceCents: MoneyCents.nullable().optional(),
        percentOffList: z.number().min(0).max(100).nullable().optional(),
        minQuantity: z.number().int().positive().default(1),
        maxQuantity: z.number().int().positive().optional(),
      })
    )
    .max(10_000),
});
export type BulkSetPriceListEntriesInput = z.infer<typeof BulkSetPriceListEntriesInput>;

// ─── Bulk price tiers ─────────────────────────────────────────────────
//
// "10+ at $5 off each" without writing a discount. Lives either on a
// variant (storefront) or a price list (B2B-specific tiering).

export const CreateBulkPriceTierInput = z
  .object({
    variantId: Uuid.nullable().optional(),
    priceListId: Uuid.nullable().optional(),
    minQuantity: z.number().int().positive(),
    unitPriceCents: MoneyCents,
  })
  .refine((t) => (t.variantId == null) !== (t.priceListId == null), {
    message: 'Set exactly one of variantId or priceListId',
  });
export type CreateBulkPriceTierInput = z.infer<typeof CreateBulkPriceTierInput>;

// ─── Contract prices (B2B-specific, signed agreement) ─────────────────

export const CreateContractPriceInput = z.object({
  companyId: Uuid,
  variantId: Uuid,
  priceCents: MoneyCents,
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().optional(),
  signedAgreementMediaId: Uuid.optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateContractPriceInput = z.infer<typeof CreateContractPriceInput>;

// ─── Price resolution input (used by storefront + cart pricing) ───────
//
// The pricing service consumes this and emits a PricedLine. The trace
// payload is persisted on CartItem.unitPriceTrace so the storefront can
// answer "why is this the price?" without recomputing.

export const PriceResolutionRequest = z.object({
  variantId: Uuid,
  quantity: z.number().int().positive(),
  channel: Channel,
  currency: Currency,
  customerId: Uuid.optional(),
  companyId: Uuid.optional(),
  customerSegmentIds: z.array(Uuid).default([]),
  // The site this price is for (docs/131 §4). A price list applies on a site when it
  // has no site links (all sites) OR is linked to this one; absent = no site filter
  // (admin/preview contexts see every list). Charge-critical: omitting it on a
  // storefront read would let a sibling business's price list set the price.
  propertyId: Uuid.optional(),
  asOf: z.string().datetime().optional(),
});
export type PriceResolutionRequest = z.infer<typeof PriceResolutionRequest>;

export const PriceTraceStep = z.object({
  source: z.enum([
    'variant_base',
    'price_list',
    'bulk_tier',
    'contract_price',
    'b2b_pricing_tier',
    'subscribe_and_save',
    'discount',
    'gift_card',
    'account_credit',
    // legacy alias of 'account_credit' (store→site rename); tolerated on read.
    'store_credit',
  ]),
  sourceId: Uuid.optional(),
  deltaCents: z.number().int(),
  resultingUnitPriceCents: MoneyCents,
  note: z.string().max(255).optional(),
});
export type PriceTraceStep = z.infer<typeof PriceTraceStep>;

export const PricedLine = z.object({
  variantId: Uuid,
  quantity: z.number().int().positive(),
  currency: Currency,
  unitPriceCents: MoneyCents,
  subtotalCents: MoneyCents,
  trace: z.array(PriceTraceStep),
});
export type PricedLine = z.infer<typeof PricedLine>;
