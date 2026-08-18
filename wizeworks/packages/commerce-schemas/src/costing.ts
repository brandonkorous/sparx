// True-cost schemas (docs/146 Phase 5).
//
// The write contracts for what a delivery ACTUALLY cost — the freight, the duty,
// the broker's fee — how those spread across the lines that arrived with them,
// and how the business wants its stock valued.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/**
 * What the money was spent on.
 *
 * A closed list rather than free text, because the landed-cost breakdown groups
 * on it and "Freight" / "freight " / "FREIGHT" would be three rows in that
 * breakdown claiming to be three different things. `other` plus a description
 * is the escape hatch that keeps the rest of the list meaningful.
 */
export const ChargeKind = z.enum([
  // Getting it here. Almost always the biggest of these, and the one most often
  // left out of the cost basis entirely.
  'freight',
  // Paid at the border, on value.
  'duty',
  // Cover on the shipment itself.
  'insurance',
  // The customs broker's fee for clearing it.
  'broker',
  // Unloading, palletising, storage in transit.
  'handling',
  'other',
]);
export type ChargeKind = z.infer<typeof ChargeKind>;

/**
 * How one charge spreads across the lines it landed with.
 *
 *   value     by each line's share of the delivery's goods value. The default,
 *             and right for duty and insurance, which genuinely scale with value.
 *   quantity  by units. A per-carton handling fee spread by value would put most
 *             of it on the expensive small thing.
 *   weight    by weight. What freight actually charges on, so it is the honest
 *             basis whenever a delivery mixes dense and bulky goods.
 *   manual    typed per line. For the case no formula covers — the crate charge
 *             that exists because of ONE item on the pallet.
 */
export const AllocationBasis = z.enum(['value', 'quantity', 'weight', 'manual']);
export type AllocationBasis = z.infer<typeof AllocationBasis>;

/**
 * A purchase-order charge cannot be `manual`: it is apportioned across
 * deliveries that do not exist yet, so there are no lines to name amounts
 * against. Split out rather than validated with a refinement so the API's error
 * says "expected value | quantity | weight" instead of a sentence about why.
 */
export const PurchaseOrderAllocationBasis = z.enum(['value', 'quantity', 'weight']);
export type PurchaseOrderAllocationBasis = z.infer<typeof PurchaseOrderAllocationBasis>;

/**
 * How the business values its stock.
 *
 *   moving_average  the running average of everything bought. The default and
 *                   right for most: nothing to explain, price swings smooth out.
 *   fifo            oldest units cost first. What an accountant asks for by name,
 *                   and required where stock is perishable or prices have moved.
 *   standard        every unit costs the planned figure, and the difference from
 *                   what was paid is reported as a variance rather than buried
 *                   in the basis. For anyone doing real cost control.
 */
export const CostingMethod = z.enum(['moving_average', 'fifo', 'standard']);
export type CostingMethod = z.infer<typeof CostingMethod>;

// ─── Charges ─────────────────────────────────────────────────────────────────

const chargeAmount = z
  .number()
  .int('Enter the amount in whole pence')
  .min(0, 'A charge cannot be negative')
  // A ten-million-pound freight bill on one delivery is a typo, and catching it
  // here is cheaper than catching it in a valuation report next quarter.
  .max(1_000_000_000, 'That is larger than any single charge we can record');

export const CreatePurchaseOrderChargeInput = z.object({
  purchaseOrderId: Uuid,
  kind: ChargeKind,
  description: z.string().trim().max(255).optional(),
  amountCents: chargeAmount,
  allocationBasis: PurchaseOrderAllocationBasis.optional(),
});
export type CreatePurchaseOrderChargeInput = z.infer<typeof CreatePurchaseOrderChargeInput>;

export const UpdatePurchaseOrderChargeInput = z.object({
  kind: ChargeKind.optional(),
  description: z.string().trim().max(255).nullable().optional(),
  amountCents: chargeAmount.optional(),
  allocationBasis: PurchaseOrderAllocationBasis.optional(),
});
export type UpdatePurchaseOrderChargeInput = z.infer<typeof UpdatePurchaseOrderChargeInput>;

/**
 * Per-line amounts under the `manual` basis: line id → pence. Validated as a
 * record rather than an array of pairs because that is what a form produces and
 * what the allocator reads, and a shape that has to be converted twice is a
 * shape that will be converted wrongly once.
 */
export const ManualAllocation = z.record(Uuid, z.number().int().min(0));
export type ManualAllocation = z.infer<typeof ManualAllocation>;

export const CreateGoodsReceiptChargeInput = z.object({
  goodsReceiptId: Uuid,
  kind: ChargeKind,
  description: z.string().trim().max(255).optional(),
  amountCents: chargeAmount,
  allocationBasis: AllocationBasis.optional(),
  manualAllocation: ManualAllocation.optional(),
});
export type CreateGoodsReceiptChargeInput = z.infer<typeof CreateGoodsReceiptChargeInput>;

export const UpdateGoodsReceiptChargeInput = z.object({
  kind: ChargeKind.optional(),
  description: z.string().trim().max(255).nullable().optional(),
  amountCents: chargeAmount.optional(),
  allocationBasis: AllocationBasis.optional(),
  manualAllocation: ManualAllocation.optional(),
});
export type UpdateGoodsReceiptChargeInput = z.infer<typeof UpdateGoodsReceiptChargeInput>;

/**
 * Charges entered as part of booking the delivery in — the freight invoice that
 * arrived with the pallet. Same shape as the standalone create without the
 * receipt id, because the receipt does not exist yet when this is sent.
 */
export const InlineGoodsReceiptChargeInput = z.object({
  kind: ChargeKind,
  description: z.string().trim().max(255).optional(),
  amountCents: chargeAmount,
  allocationBasis: AllocationBasis.optional(),
  manualAllocation: ManualAllocation.optional(),
});
export type InlineGoodsReceiptChargeInput = z.infer<typeof InlineGoodsReceiptChargeInput>;

// ─── FX ──────────────────────────────────────────────────────────────────────

/**
 * The rate that converts the delivery's currency into the tenant's base
 * currency. A positive number, sent as a string so a rate like 0.00000123 (a
 * currency with a lot of minor units) survives the round trip without a float
 * quietly rounding it — the column is DECIMAL(18,8) for the same reason.
 */
export const FxRate = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,8})?$/, 'Enter a rate like 1.0842, with up to eight decimal places')
  .refine((v) => Number(v) > 0, 'A rate has to be greater than zero');

export const CurrencyCode = z
  .string()
  .trim()
  .length(3, 'A currency code is three letters')
  .transform((v) => v.toUpperCase());

// ─── Costing policy ──────────────────────────────────────────────────────────

export const UpdateCostingPolicyInput = z.object({
  method: CostingMethod.optional(),
  defaultAllocationBasis: AllocationBasis.optional(),
  baseCurrency: CurrencyCode.optional(),
});
export type UpdateCostingPolicyInput = z.infer<typeof UpdateCostingPolicyInput>;

/** Per-variant override. `null` clears it back to following the tenant policy. */
export const SetVariantCostingMethodInput = z.object({
  variantId: Uuid,
  method: CostingMethod.nullable(),
});
export type SetVariantCostingMethodInput = z.infer<typeof SetVariantCostingMethodInput>;

// ─── Reports ─────────────────────────────────────────────────────────────────

/**
 * Value the ledger as it stood at a moment in the past.
 *
 * `asOf` is an instant, not a date, because "the 31st" is a different number at
 * 09:00 and at 18:00 and a stock take happens at one of them. The caller sends
 * the instant it means.
 */
export const AsOfValuationQuery = z.object({
  asOf: z.string().datetime(),
  warehouseId: Uuid.optional(),
});
export type AsOfValuationQuery = z.infer<typeof AsOfValuationQuery>;

/** Standard cost vs what was actually paid, over a window. */
export const PriceVarianceQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  warehouseId: Uuid.optional(),
  supplierId: Uuid.optional(),
  take: z.number().int().min(1).max(250).optional(),
});
export type PriceVarianceQuery = z.infer<typeof PriceVarianceQuery>;
