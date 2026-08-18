// Inventory schemas — warehouses, levels, adjustments, reservations, lots,
// serials. Hazmat surfaces here (and on Product); the shipping provider
// reads it to decide ground/air/freight routing.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

import { AddressSnapshot, HazmatClass } from './common';

// ─── Warehouse ───────────────────────────────────────────────────────

export const WarehouseType = z.enum(['owned', '3pl', 'dropship', 'virtual']);
export type WarehouseType = z.infer<typeof WarehouseType>;

export const CreateWarehouseInput = z.object({
  name: z.string().min(1).max(127),
  code: z
    .string()
    .min(1)
    .max(15)
    .regex(/^[A-Z0-9_-]+$/),
  type: WarehouseType.default('owned'),
  address: AddressSnapshot,
  // Per-channel default — when an order on `channel` has no explicit
  // warehouse, the picker uses this as a fallback. JSONB on the column.
  defaultForChannel: z
    .array(z.enum(['storefront', 'b2b_portal', 'admin', 'subscription']))
    .default([]),
  hoursOfOperation: z
    .array(
      z.object({
        day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
        openMinutes: z.number().int().min(0).max(1439),
        closeMinutes: z.number().int().min(0).max(1439),
      })
    )
    .max(7)
    .optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().default(true),
});
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseInput>;

// Defaults survive `.partial()` (see UpdateProductInput / UpdateCategoryInput),
// and the service writes every key that isn't undefined — so renaming a
// warehouse REACTIVATED a deactivated one (isActive → true), cleared its
// per-channel fallback assignments, and reset its type to 'owned'. Re-declared
// as plain optional. Keep in sync with every `.default()` in
// CreateWarehouseInput.
export const UpdateWarehouseInput = CreateWarehouseInput.partial().extend({
  type: WarehouseType.optional(),
  defaultForChannel: z
    .array(z.enum(['storefront', 'b2b_portal', 'admin', 'subscription']))
    .optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseInput>;

// ─── Inventory levels + adjustments ──────────────────────────────────

export const InventoryAdjustReason = z.enum([
  'sale',
  'return',
  'cancel', // restock reversing a cancelled order's sale movements (docs/100 P2)
  'recount',
  'loss',
  'damage',
  'transfer_in',
  'transfer_out',
  'receive',
  'reserve',
  'release',
  'manual',
  'sync', // corrective delta from an authoritative external source (ERP/WMS)
  // Stock going BACK to the supplier with a credit expected (docs/146 Phase
  // 8.7). Its own reason rather than a `loss`: the units are not lost, they are
  // somebody else's problem now and money is owed for them, and a report that
  // folded them into shrinkage would libel the warehouse.
  'return_to_supplier',
]);
export type InventoryAdjustReason = z.infer<typeof InventoryAdjustReason>;

// Who moved the stock — every movement is attributed to one of these so the
// ledger answers "who, when, why, how much" (docs/100 §2.5). Defaults are
// derived from the request context (a signed-in user → 'user', else 'system');
// MCP/AI callers pass 'ai' and integration sync passes 'integration' + a source.
export const InventoryActorType = z.enum(['user', 'ai', 'system', 'integration']);
export type InventoryActorType = z.infer<typeof InventoryActorType>;

export const AdjustInventoryInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid,
  delta: z.number().int(), // signed
  reason: InventoryAdjustReason,
  referenceType: z.string().max(63).optional(), // 'order', 'return', 'transfer'
  referenceId: Uuid.optional(),
  note: z.string().max(2000).optional(),
  unitCostCents: z.number().int().nonnegative().optional(),
  /** Which shelf the units land on or come off (docs/146 Phase 2). Omitted, the
   *  ledger's mirror picks the location's default. Named, it decides — which is
   *  what lets a returns disposition put quarantined goods somewhere a picker
   *  will never walk (docs/146 Phase 9.7). Ignored on a location without bins. */
  binId: Uuid.optional(),
  // Attribution + idempotency overrides (all optional; the service fills actor
  // from context when omitted). `idempotencyKey` makes a retried/redelivered
  // write apply exactly once.
  actorType: InventoryActorType.optional(),
  actorId: z.string().max(127).optional(),
  source: z.string().max(63).optional(),
  idempotencyKey: z.string().max(127).optional(),
});
export type AdjustInventoryInput = z.infer<typeof AdjustInventoryInput>;

export const SetReorderPolicyInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid,
  reorderPoint: z.number().int().nonnegative(),
  reorderQuantity: z.number().int().positive(),
  leadTimeDays: z.number().int().nonnegative().max(365).optional(),
});
export type SetReorderPolicyInput = z.infer<typeof SetReorderPolicyInput>;

export const TransferInventoryInput = z.object({
  variantId: Uuid,
  fromWarehouseId: Uuid,
  toWarehouseId: Uuid,
  quantity: z.number().int().positive(),
  note: z.string().max(2000).optional(),
});
export type TransferInventoryInput = z.infer<typeof TransferInventoryInput>;

// ─── Documented public API (docs/06 §7) ──────────────────────────────
//
// The headless contract surface external integrators code against, distinct
// from the dashboard-shaped routes. A count update names a single level
// (variant × warehouse) and EITHER sets an absolute on-hand OR applies a signed
// delta — never both (a corrective `setOnHand` reconciles under the row lock so
// it can't race a concurrent sale; a delta is an ordinary signed movement).

export const UpdateInventoryCountInput = z
  .object({
    warehouseId: Uuid,
    onHand: z.number().int().nonnegative().optional(),
    delta: z.number().int().optional(),
    reason: InventoryAdjustReason.default('manual'),
    note: z.string().max(2000).optional(),
    // Makes a retried PATCH apply exactly once on a delta update.
    idempotencyKey: z.string().max(127).optional(),
  })
  .refine((v) => (v.onHand === undefined) !== (v.delta === undefined), {
    message: 'Provide exactly one of `onHand` (absolute) or `delta` (signed).',
    path: ['onHand'],
  });
export type UpdateInventoryCountInput = z.infer<typeof UpdateInventoryCountInput>;

// One row of a bulk adjustment (JSON array or a parsed CSV line). Resolves the
// variant by `sku` (the natural key in a spreadsheet export) OR `variantId`.
export const BulkAdjustmentRow = z
  .object({
    sku: z.string().min(1).max(255).optional(),
    variantId: Uuid.optional(),
    warehouseId: Uuid,
    onHand: z.number().int().nonnegative().optional(),
    delta: z.number().int().optional(),
    reason: InventoryAdjustReason.default('manual'),
    note: z.string().max(2000).optional(),
  })
  .refine((v) => (v.sku === undefined) !== (v.variantId === undefined), {
    message: 'Provide exactly one of `sku` or `variantId`.',
    path: ['sku'],
  })
  .refine((v) => (v.onHand === undefined) !== (v.delta === undefined), {
    message: 'Provide exactly one of `onHand` (absolute) or `delta` (signed).',
    path: ['onHand'],
  });
export type BulkAdjustmentRow = z.infer<typeof BulkAdjustmentRow>;

export const BulkAdjustmentInput = z.object({
  adjustments: z.array(BulkAdjustmentRow).min(1).max(1000),
});
export type BulkAdjustmentInput = z.infer<typeof BulkAdjustmentInput>;

// ─── B2B inventory consumer (docs/100 P6d) ────────────────────────────
//
// B2B as a consumer of the master (docs/99 §4.0): a fleet / work-order hold
// reserves stock for an account's job before the order exists, and account-scoped
// availability surfaces what the account can see + reserve + its purchasing limits.

export const CreateFleetHoldInput = z.object({
  accountId: Uuid,
  variantId: Uuid,
  warehouseId: Uuid.optional(),
  quantity: z.number().int().positive(),
  workOrderRef: z.string().min(1).max(127),
  note: z.string().max(2000).optional(),
  heldByCustomerId: Uuid.optional(),
});
export type CreateFleetHoldInput = z.infer<typeof CreateFleetHoldInput>;

export const AccountAvailabilityInput = z.object({
  accountId: Uuid,
  variantIds: z.array(Uuid).min(1).max(200),
  warehouseId: Uuid.optional(),
});
export type AccountAvailabilityInput = z.infer<typeof AccountAvailabilityInput>;

// ─── Reservations ─────────────────────────────────────────────────────
//
// Cart reservations are soft (30-minute TTL); order reservations are hard
// (released only by fulfillment, cancellation, or refund). Both flow
// through `inventoryService.reserve()` — only entry point.

export const ReserveInventoryInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid.optional(), // service picks warehouse if absent
  quantity: z.number().int().positive(),
  holderType: z.enum(['cart', 'order', 'subscription', 'work_order']),
  holderId: Uuid,
  ttlSeconds: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 30)
    .optional(),
});
export type ReserveInventoryInput = z.infer<typeof ReserveInventoryInput>;

// ─── Lot batches + serial units ───────────────────────────────────────

export const CreateLotBatchInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid,
  lotNumber: z.string().min(1).max(63),
  manufacturedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  quantity: z.number().int().nonnegative(),
  hazmatClass: HazmatClass.default('none'),
  supplierBatchRef: z.string().max(127).optional(),
  certificateOfAnalysisMediaId: Uuid.optional(),
});
export type CreateLotBatchInput = z.infer<typeof CreateLotBatchInput>;

export const SerialUnitStatus = z.enum([
  'in_stock',
  'reserved',
  'sold',
  'returned',
  'scrapped',
  'lost',
]);
export type SerialUnitStatus = z.infer<typeof SerialUnitStatus>;

export const CreateSerialUnitInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid,
  serial: z.string().min(1).max(127),
  lotBatchId: Uuid.optional(),
  status: SerialUnitStatus.default('in_stock'),
});
export type CreateSerialUnitInput = z.infer<typeof CreateSerialUnitInput>;

// Change a serial unit's lifecycle status (in_stock → reserved/sold/returned/
// scrapped/lost). Pure traceability metadata — authoritative on-hand stays on the
// (variant, warehouse) level, moved only through the ledger.
export const UpdateSerialStatusInput = z.object({
  status: SerialUnitStatus,
});
export type UpdateSerialStatusInput = z.infer<typeof UpdateSerialStatusInput>;

// Recall — flips matching sold units to a `recall_pending` state and
// generates a customer notification list. The actual workflow is a
// separate worker but its input is this.
export const InitiateRecallInput = z.object({
  lotBatchIds: z.array(Uuid).min(1).max(100),
  reason: z.string().min(1).max(2000),
  notifyCustomers: z.boolean().default(true),
});
export type InitiateRecallInput = z.infer<typeof InitiateRecallInput>;

// ─── Suppliers + per-variant purchasing detail (P3a) ──────────────────
//
// The inbound side: who stock is purchased FROM. A supplier carries contact +
// default purchasing terms; per-variant detail (the supplier's SKU, cost, MOQ)
// is upserted via `SupplierVariant` links. Purchase orders / receiving (P3b/P3c)
// build on these.

export const CreateSupplierInput = z.object({
  name: z.string().min(1).max(160),
  code: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code may contain letters, numbers, hyphen, underscore'),
  contactName: z.string().max(160).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  website: z.string().max(255).optional(),
  line1: z.string().max(255).optional(),
  line2: z.string().max(255).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  postalCode: z.string().max(32).optional(),
  country: z.string().length(2).optional(),
  // net-N / cod / prepaid — free-form within the column width, mirrors billing.
  paymentTerms: z.string().max(20).optional(),
  leadTimeDays: z.number().int().nonnegative().max(3650).optional(),
  currency: z.string().length(3).default('USD'),
  notes: z.string().max(5000).optional(),
  isActive: z.boolean().default(true),
});
export type CreateSupplierInput = z.infer<typeof CreateSupplierInput>;

// Same defaults-survive-`.partial()` trap as UpdateWarehouseInput above:
// editing a supplier's contact details REACTIVATED a supplier that had been
// switched off and forced its currency back to USD — silently repricing every
// cost quoted in another currency. Keep in sync with every `.default()` in
// CreateSupplierInput.
export const UpdateSupplierInput = CreateSupplierInput.partial().extend({
  currency: z.string().length(3).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierInput>;

// Upsert a (supplier, variant) purchasing link. One row per pair; re-upserting
// updates the detail. `unitCostCents` is the purchase cost (PO line default +
// the moving-average basis on receipt).
export const UpsertSupplierVariantInput = z.object({
  variantId: Uuid,
  supplierSku: z.string().max(127).optional(),
  unitCostCents: z.number().int().nonnegative().optional(),
  minOrderQty: z.number().int().positive().optional(),
  leadTimeDays: z.number().int().nonnegative().max(3650).optional(),
  isPreferred: z.boolean().optional(),
});
export type UpsertSupplierVariantInput = z.infer<typeof UpsertSupplierVariantInput>;

// ─── Purchase orders (P3b) ────────────────────────────────────────────────────
//
// The inbound order: a commitment to buy stock from a supplier, received into a
// warehouse (receiving is P3c). Lifecycle: draft (editable) → submitted (ordered)
// → partial/received (driven by receiving) → closed/cancelled (terminal). Lines
// carry the ordered qty + agreed unit cost (defaulted from the supplier link or
// the variant cost when omitted).

export const PurchaseOrderStatus = z.enum([
  'draft',
  // Held awaiting sign-off (docs/146 Phase 8.5). Deliberately its own state: a
  // held order is not a draft (it has been sent for approval and left the
  // buyer's hands) and it is not submitted (nothing may be received against it).
  'pending_approval',
  'submitted',
  'partial',
  'received',
  'closed',
  'cancelled',
]);
export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatus>;

// A line on a create/add request. `unitCostCents` is optional — the service
// defaults it from the (supplier, variant) link, then the variant cost, then 0.
export const PurchaseOrderLineInput = z.object({
  variantId: Uuid,
  quantity: z.number().int().positive(),
  unitCostCents: z.number().int().nonnegative().optional(),
  supplierSku: z.string().max(127).optional(),
  description: z.string().max(255).optional(),
  // Order in a pack unit (docs/146 Phase 6.2). When present, `quantity` and
  // `unitCostCents` are read AS THAT UNIT — 4 cases at £48 — and the service
  // converts both to base units before storing, using the variant's own factor
  // for that code. Absent, both are base units, which is every line written
  // before units existed and most written after.
  uomCode: z.string().trim().min(1).max(12).optional(),
});
export type PurchaseOrderLineInput = z.infer<typeof PurchaseOrderLineInput>;

export const CreatePurchaseOrderInput = z.object({
  supplierId: Uuid,
  warehouseId: Uuid,
  currency: z.string().length(3).default('USD'),
  paymentTerms: z.string().max(20).optional(),
  reference: z.string().max(120).optional(),
  expectedArrivalAt: z.string().datetime().optional(),
  shippingCents: z.number().int().nonnegative().default(0),
  notes: z.string().max(5000).optional(),
  lines: z.array(PurchaseOrderLineInput).max(500).default([]),
});
export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderInput>;

// Header-only edits, draft POs only. Nullable fields clear when explicitly null;
// omitted fields are left untouched. Supplier is fixed at creation (the line
// cost/SKU snapshots are taken against it).
export const UpdatePurchaseOrderInput = z.object({
  warehouseId: Uuid.optional(),
  currency: z.string().length(3).optional(),
  paymentTerms: z.string().max(20).nullable().optional(),
  reference: z.string().max(120).nullable().optional(),
  expectedArrivalAt: z.string().datetime().nullable().optional(),
  shippingCents: z.number().int().nonnegative().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type UpdatePurchaseOrderInput = z.infer<typeof UpdatePurchaseOrderInput>;

export const UpdatePurchaseOrderLineInput = z.object({
  quantity: z.number().int().positive().optional(),
  unitCostCents: z.number().int().nonnegative().optional(),
  supplierSku: z.string().max(127).nullable().optional(),
  description: z.string().max(255).nullable().optional(),
  /** Re-read the quantity and cost in this pack unit — see the create input. */
  uomCode: z.string().trim().min(1).max(12).optional(),
});
export type UpdatePurchaseOrderLineInput = z.infer<typeof UpdatePurchaseOrderLineInput>;

// Submit transitions a draft to `submitted`; the optional expected-arrival
// override wins over the lead-time-derived default.
export const SubmitPurchaseOrderInput = z.object({
  expectedArrivalAt: z.string().datetime().optional(),
});
export type SubmitPurchaseOrderInput = z.infer<typeof SubmitPurchaseOrderInput>;

// ─── Goods receipts (P3c) ─────────────────────────────────────────────────────
//
// Booking goods against a submitted PO. A receipt is posted atomically — each
// line writes a `receive` movement (the moving-average basis = the landed unit
// cost, defaulted from the PO line) and bumps that PO line's received count,
// advancing the PO to partial/received. A `lotNumber` mints/extends a LotBatch.

export const ReceiveLineInput = z
  .object({
    purchaseOrderLineId: Uuid,
    // GOOD units received on this delivery — what becomes sellable stock. May be
    // 0 on a fully-damaged (total-loss) line, where every unit arrived broken; a
    // zero-good line still has to record SOME arrival through `quantityDamaged`
    // (see the object-level refine below), so it is never an empty no-op.
    quantity: z.number().int().nonnegative(),
    // Damaged-on-arrival units. Booked as two ledger facts on the same receipt —
    // a `receive` (+) at the same landed cost, then a `damage` (−) write-off — so
    // the arrival and the valued loss are both recorded, while net on-hand stays 0.
    // Damaged units are NEVER added to sellable stock and NEVER credited against
    // the PO line (the supplier still owes them). Defaults to 0.
    quantityDamaged: z.number().int().min(0).optional(),
    // Actual landed cost — defaults to the PO line's agreed cost when omitted.
    unitCostCents: z.number().int().nonnegative().optional(),
    lotNumber: z.string().min(1).max(63).optional(),
    // Which shelf the GOOD units went on (docs/146 Phase 2). Optional even on a
    // bin-enabled location: the receiver may be booking a delivery from a desk
    // with the pallet still on the dock, and refusing the receipt until someone
    // walks the aisle is how deliveries stop being booked at all. Omitted, the
    // put-away suggester picks — home shelf, then a shelf already holding it,
    // then the default. Damaged units ignore this entirely and go to DAMAGED.
    binId: Uuid.optional(),
    // Count the delivery in cartons rather than in units (docs/146 Phase 6.2).
    // When present, `quantity`, `quantityDamaged` and `unitCostCents` are read
    // AS THAT UNIT and converted before anything is written — the receiver
    // enters 3 for three cartons and the ledger moves 36. Absent, everything is
    // base units. Defaults to the purchase-order line's unit when that line was
    // ordered in one, because a delivery against a case order arrives in cases.
    uomCode: z.string().trim().min(1).max(12).optional(),
  })
  // A receipt line must record SOME arrival — good units, damaged units, or both.
  // A line with zero of each is a no-op that books nothing and must be rejected.
  .refine((line) => line.quantity + (line.quantityDamaged ?? 0) >= 1, {
    message: 'A receipt line must record at least one unit received or damaged',
    path: ['quantity'],
  });
export type ReceiveLineInput = z.infer<typeof ReceiveLineInput>;

export const CreateGoodsReceiptInput = z.object({
  purchaseOrderId: Uuid,
  // The supplier's advance ship notice this delivery satisfies (docs/146 Phase
  // 8.6). Optional — most deliveries arrive with no notice at all. When given,
  // the notice is marked received and its stated quantities become comparable
  // against what actually turned up. The receipt is NOT validated against it:
  // the pallet is on the floor, and refusing to book it because the paperwork
  // disagrees is how a discrepancy becomes an unrecorded one.
  advanceShipNoticeId: Uuid.optional(),
  receivedAt: z.string().datetime().optional(),
  reference: z.string().max(120).optional(), // packing slip / carrier ref
  note: z.string().max(2000).optional(),
  lines: z.array(ReceiveLineInput).min(1).max(500),

  // FX captured AT RECEIPT (docs/146 Phase 5.7). The rate on the day the goods
  // landed is the one that decides what they cost, so it belongs here rather
  // than being inherited from a quote weeks old. Omitted on a domestic delivery,
  // where the receipt takes the order's currency and a rate of 1.
  fxRate: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,8})?$/, 'Enter a rate like 1.0842, with up to eight decimal places')
    .refine((v) => Number(v) > 0, 'A rate has to be greater than zero')
    .optional(),

  // Money spent on THIS delivery — the freight invoice that came with the pallet
  // (docs/146 Phase 5.1). Booked with the receipt so the landed cost is right
  // the first time; a bill that turns up later is added to the posted receipt
  // and revalues what is still on the shelf.
  charges: z
    .array(
      z.object({
        kind: z.enum(['freight', 'duty', 'insurance', 'broker', 'handling', 'other']),
        description: z.string().trim().max(255).optional(),
        amountCents: z.number().int().min(0).max(1_000_000_000),
        allocationBasis: z.enum(['value', 'quantity', 'weight', 'manual']).optional(),
      })
    )
    .max(20)
    .optional(),
});
export type CreateGoodsReceiptInput = z.infer<typeof CreateGoodsReceiptInput>;

// ─── Reorder engine (P3d) ─────────────────────────────────────────────────────
//
// Items at/below their reorder point become reorder suggestions; the buyer picks
// the lines to act on and the engine drafts one purchase order per (supplier,
// warehouse) group — line cost defaults from the (supplier, variant) link. Each
// line carries the explicit supplier the suggestion resolved to (the preferred
// link) so the draft is deterministic; `quantity` is the buyer-confirmed order qty.

export const DraftReorderLineInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid,
  supplierId: Uuid,
  quantity: z.number().int().positive(),
});
export type DraftReorderLineInput = z.infer<typeof DraftReorderLineInput>;

export const DraftReorderInput = z.object({
  lines: z.array(DraftReorderLineInput).min(1).max(500),
});
export type DraftReorderInput = z.infer<typeof DraftReorderInput>;

// ─── Inventory counts (P4) ──────────────────────────────────────────────────────
//
// A counting session reconciles recorded stock against a physical count, scoped to
// one warehouse: a `cycle` count covers a chosen subset of variants, a `full` count
// every level in the warehouse. Each line snapshots the expected on-hand at count
// start; the counter enters the counted quantity; on post a `recount` movement
// reconciles the level to the counted value (an absolute set, immune to a mid-count
// sale). Variance VALUE over the per-count threshold gates the post behind an admin
// approval (the roles model — docs/100 P4).

/** cycle covers a chosen subset, full covers every level in the warehouse, and
 *  `opening` is the FIRST one — the count that closes setup (docs/146 Phase
 *  11.4). It behaves like a full count and is recorded as its own type because
 *  its movements post under the `opening` reason: establishing a starting point
 *  is not the same event as finding a discrepancy, and a business's first day
 *  must not read as its worst day of shrinkage. */
export const InventoryCountType = z.enum(['cycle', 'full', 'opening']);
export type InventoryCountType = z.infer<typeof InventoryCountType>;

export const InventoryCountStatus = z.enum([
  'counting',
  'review',
  'approved',
  'posted',
  'cancelled',
]);
export type InventoryCountStatus = z.infer<typeof InventoryCountStatus>;

// Create a count. For `full`, `variantIds` is ignored — every level in the
// warehouse is snapshotted. For `cycle`, the listed variants seed the lines (more
// can be added while counting). `approvalThresholdCents` overrides the default
// ($50) above which the post needs an admin sign-off.
/** What a stock count COVERS (docs/146 Phase 2). `location` is the pre-bins
 *  behaviour exactly, so an existing caller is unaffected.
 *
 *  Declared here rather than with the other bin schemas below because a const
 *  enum must exist before the object that references it — and the counts section
 *  comes first in this file. */
export const CountScope = z.enum(['location', 'zone', 'bin']);
export type CountScope = z.infer<typeof CountScope>;

export const CreateInventoryCountInput = z
  .object({
    warehouseId: Uuid,
    type: InventoryCountType,
    variantIds: z.array(Uuid).max(5000).optional(),
    approvalThresholdCents: z.number().int().nonnegative().optional(),
    note: z.string().max(2000).optional(),
    // ── Scope (docs/146 Phase 2) ──
    // Defaults to `location`, which is the pre-bins behaviour exactly, so an
    // existing caller is unaffected.
    scope: CountScope.default('location'),
    binId: Uuid.optional(),
    zoneName: z.string().trim().max(60).optional(),
    /** Hide the expected quantity from whoever is counting, so what they write
     *  down is what they SEE. The cheapest accuracy control in the category. */
    isBlind: z.boolean().optional(),
  })
  .refine((v) => v.scope !== 'bin' || v.binId !== undefined, {
    message: 'Choose the shelf this count covers',
    path: ['binId'],
  })
  .refine((v) => v.scope !== 'zone' || (v.zoneName ?? '') !== '', {
    message: 'Choose the zone this count covers',
    path: ['zoneName'],
  })
  // A scope carrying the WRONG target is the dangerous case: a count that thinks
  // it covers the whole location applies zero to every variant absent from the
  // sheet. Refusing the mismatch is cheaper than the cleanup.
  .refine((v) => v.scope === 'bin' || v.binId === undefined, {
    message: 'A shelf can only be given when the count covers one shelf',
    path: ['binId'],
  });
export type CreateInventoryCountInput = z.infer<typeof CreateInventoryCountInput>;

// Add one more variant to a counting session (snapshots its expected on-hand).
export const AddCountLineInput = z.object({
  variantId: Uuid,
  /** Which shelf this line counts. Required on a bin- or zone-scoped count, where
   *  the same variant may legitimately appear on several lines. */
  binId: Uuid.optional(),
  /** Count this line in cartons rather than units (docs/146 Phase 6.2). Set on
   *  the LINE rather than on each entry, because a shelf of sealed boxes is
   *  counted in boxes for the whole count — and asking the counter to restate it
   *  every time they type a number is how a 12× error gets in. */
  uomCode: z.string().trim().min(1).max(12).optional(),
});
export type AddCountLineInput = z.infer<typeof AddCountLineInput>;

// Record counted quantities for one or more lines (editable while `counting`).
export const CountEntryInput = z.object({
  lineId: Uuid,
  countedQuantity: z.number().int().nonnegative(),
  note: z.string().max(2000).optional(),
});
export type CountEntryInput = z.infer<typeof CountEntryInput>;

export const EnterCountsInput = z.object({
  entries: z.array(CountEntryInput).min(1).max(5000),
});
export type EnterCountsInput = z.infer<typeof EnterCountsInput>;

// ─── Inventory transfers (P4) ─────────────────────────────────────────────────────
//
// Move stock between two warehouses through an in-transit holding location. A
// transfer is composed as a `draft` (one or more variant lines), `shipped` (each
// line leaves the source and lands in the system in-transit warehouse — so total
// stock is conserved while in motion), then `received` (in-transit → destination).
// Cancelling an in-transit transfer returns the goods to source. The single-shot
// `TransferInventoryInput` above stays the programmatic instant-move path; this is
// the document-driven two-phase flow.

export const InventoryTransferStatus = z.enum(['draft', 'in_transit', 'received', 'cancelled']);
export type InventoryTransferStatus = z.infer<typeof InventoryTransferStatus>;

// One line on a transfer: a variant + the quantity to move.
export const TransferLineInput = z.object({
  variantId: Uuid,
  quantity: z.number().int().positive(),
  /** Move whole pallets rather than units (docs/146 Phase 6.2). When present,
   *  `quantity` is read AS THAT UNIT and converted before storage; the ledger
   *  moves base units either way. */
  uomCode: z.string().trim().min(1).max(12).optional(),
});
export type TransferLineInput = z.infer<typeof TransferLineInput>;

export const CreateInventoryTransferInput = z.object({
  fromWarehouseId: Uuid,
  toWarehouseId: Uuid,
  note: z.string().max(2000).optional(),
  lines: z.array(TransferLineInput).max(500).default([]),
});
export type CreateInventoryTransferInput = z.infer<typeof CreateInventoryTransferInput>;

// Add a line to a draft transfer (one variant; re-adding the same variant is a
// conflict — edit the existing line's quantity instead).
export const AddTransferLineInput = TransferLineInput;
export type AddTransferLineInput = z.infer<typeof AddTransferLineInput>;

export const UpdateTransferLineInput = z.object({
  quantity: z.number().int().positive(),
  /** Omitted, the line keeps the unit it was written with — so editing only the
   *  quantity on a line entered in pallets still means pallets. */
  uomCode: z.string().trim().min(1).max(12).optional(),
});
export type UpdateTransferLineInput = z.infer<typeof UpdateTransferLineInput>;

// Receive an in-transit transfer. Lines are optional per-line overrides — any line
// not listed receives its full shipped quantity; a `receivedQuantity` short of the
// shipped amount writes the shortfall off the in-transit level as a `loss`.
export const ReceiveTransferLineInput = z.object({
  lineId: Uuid,
  receivedQuantity: z.number().int().nonnegative(),
});
export type ReceiveTransferLineInput = z.infer<typeof ReceiveTransferLineInput>;

export const ReceiveTransferInput = z.object({
  lines: z.array(ReceiveTransferLineInput).max(500).optional(),
});
export type ReceiveTransferInput = z.infer<typeof ReceiveTransferInput>;

// ─── External sync (P5 Tier C) ──────────────────────────────────────────────────
//
// A source feed reports absolute on-hand per external SKU; the ingest funnel
// resolves each row to an InventorySourceLink and reconciles the master level
// through a corrective `sync` movement. Rows that resolve to no link land in the
// unmapped-SKU review queue. `how` the run was initiated drives the sync-health
// trigger badge; mapping an unmapped SKU mints a link to a (variant, warehouse).

export const SyncTrigger = z.enum(['manual', 'scheduled', 'push', 'api']);
export type SyncTrigger = z.infer<typeof SyncTrigger>;

// Per-mapping sync controls (P5b conflict resolution + oversell guards), all
// optional — defaults are 1:1 UoM and no buffer:
//   • externalUom / unitsPerExternal — the feed may report a pack UoM (a case of
//     12) while the catalog sells "each"; the feed quantity is multiplied by
//     unitsPerExternal before it reconciles the level.
//   • safetyBuffer — units withheld from the SELLABLE available for the mapped
//     (variant, warehouse) so the source→sync lag can't oversell. Stored on the
//     level (the enforcement home).
const externalUomField = z.string().max(30).nullable().optional();
const unitsPerExternalField = z.number().int().positive().max(100_000).optional();
const safetyBufferField = z.number().int().nonnegative().max(1_000_000).optional();

// Create a source mapping (link). One source per variant is enforced server-side.
export const CreateSourceLinkInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid,
  externalSku: z.string().min(1).max(255),
  externalLocation: z.string().max(255).nullable().default(null),
  externalUom: externalUomField,
  unitsPerExternal: unitsPerExternalField,
  safetyBuffer: safetyBufferField,
});
export type CreateSourceLinkInput = z.infer<typeof CreateSourceLinkInput>;

// Resolve one unmapped external SKU by binding it to a (variant, warehouse): this
// creates an InventorySourceLink (so the next sync matches it) and clears the row.
export const MapUnmappedSkuInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid,
  externalUom: externalUomField,
  unitsPerExternal: unitsPerExternalField,
  safetyBuffer: safetyBufferField,
});
export type MapUnmappedSkuInput = z.infer<typeof MapUnmappedSkuInput>;

// Set the oversell safety buffer for one (variant, warehouse) level directly.
export const SetSafetyBufferInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid,
  safetyBuffer: z.number().int().nonnegative().max(1_000_000),
});
export type SetSafetyBufferInput = z.infer<typeof SetSafetyBufferInput>;

// ─── Per-channel safety buffers (docs/146 Phase 1) ───────────────────────────
//
// `SetSafetyBufferInput` above withholds N units from EVERY channel equally.
// That is the wrong shape the moment a tenant sells in more than one place: a
// storefront reads the level live and needs no cushion, while a marketplace we
// push to every fifteen minutes needs slack to survive the window between a sale
// here and the push landing there.
//
// A row with no variant/warehouse is the CHANNEL DEFAULT; a row with both is a
// surgical override for one level. The half-specified forms are rejected — "this
// variant at every warehouse" is a different feature with a different resolution
// order, and silently accepting it would make the resolved number unexplainable.

/** Sales channels the buffer system recognises. Free-form beyond the built-ins
 *  so a channel adapter's slug (amazon, ebay, walmart, …) is valid without a
 *  schema change every time one is added. */
export const InventoryChannel = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Channel must be a lowercase slug');
export type InventoryChannel = z.infer<typeof InventoryChannel>;

export const SetChannelBufferInput = z
  .object({
    channel: InventoryChannel,
    /** Both omitted = the channel-wide default. Both set = a level override. */
    variantId: Uuid.optional(),
    warehouseId: Uuid.optional(),
    buffer: z.number().int().nonnegative().max(1_000_000),
    note: z.string().max(2000).optional(),
  })
  .refine((v) => (v.variantId === undefined) === (v.warehouseId === undefined), {
    message: 'Give both variantId and warehouseId for a level override, or neither for the default',
    path: ['variantId'],
  });
export type SetChannelBufferInput = z.infer<typeof SetChannelBufferInput>;

// ─── Feed freshness SLO (docs/146 Phase 1) ───────────────────────────────────
//
// `syncIntervalSec` says how often we INTEND to pull; this says when the number
// stops being trustworthy, and what to do about it. They are different questions
// — a nightly feed is healthy at 23 hours old and alarming at 30.

export const StalenessPolicy = z.enum([
  // Flag the source and banner every surface reading it. Loud, reversible.
  'warn',
  // Additionally withhold `stalenessBuffer` extra units from every channel this
  // source feeds, so the lag eats the cushion instead of a customer's order.
  'buffer_up',
  // Additionally stop selling this source's stock on external channels until a
  // sync lands. The right answer where an oversell costs marketplace account
  // health rather than one apology.
  'pause_channel',
]);
export type StalenessPolicy = z.infer<typeof StalenessPolicy>;

export const SetSourceFreshnessInput = z.object({
  /** Age past which this source's stock is suspect. 0 = no SLO (exempt). */
  expectedIntervalSec: z
    .number()
    .int()
    .nonnegative()
    .max(60 * 60 * 24 * 30),
  stalenessPolicy: StalenessPolicy.optional(),
  stalenessBuffer: z.number().int().nonnegative().max(1_000_000).optional(),
});
export type SetSourceFreshnessInput = z.infer<typeof SetSourceFreshnessInput>;

// ─── Integrity: reconciliation + oversell (docs/146 Phase 1) ─────────────────

export const ReconciliationScope = z.enum(['full', 'sample', 'variant']);
export type ReconciliationScope = z.infer<typeof ReconciliationScope>;

export const ReconciliationStatus = z.enum(['running', 'ok', 'drift', 'error']);
export type ReconciliationStatus = z.infer<typeof ReconciliationStatus>;

export const RunReconciliationInput = z.object({
  scope: ReconciliationScope.default('full'),
  /** Required when scope = 'variant' — check one item on demand. */
  variantId: Uuid.optional(),
  /** Cap for scope = 'sample': the N most recently touched levels. */
  sampleSize: z.number().int().min(1).max(10_000).default(1000),
});
export type RunReconciliationInput = z.infer<typeof RunReconciliationInput>;

// ─── Bins (docs/146 Phase 2) ─────────────────────────────────────────────────
//
// Where INSIDE a location a thing is. Opt-in per warehouse — see
// `Warehouse.usesBins`; with it off none of this is ever asked for.

export const BinType = z.enum([
  // The shelf a picker walks to. The default and the overwhelming majority.
  'pick',
  // Overstock. Feeds the pick face rather than being picked from directly.
  'bulk',
  // Where a delivery lands before it is put away.
  'receiving',
  // Picked goods waiting to be packed or shipped.
  'staging',
  // Arrived or returned but not yet passed. NOT sellable.
  'quarantine',
  // Written off but physically still here. NOT sellable.
  'damaged',
  // Awaiting work before it can be sold again. NOT sellable, and deliberately
  // not `damaged`: the two piles have opposite futures. Damaged stock is a
  // write-off looking for a bin; repair stock is an asset with a job queued
  // against it, and a refurbisher whose repair queue is reported as shrinkage is
  // being told its best margin is a loss (docs/146 Phase 9.7).
  'repair',
]);
export type BinType = z.infer<typeof BinType>;

/** How a picker is routed through a location's shelves (docs/146 Phase 4).
 *  Stored on the warehouse now because put-away suggests using the same
 *  preference, so it earns its place before picking ships. */
export const AllocationStrategy = z.enum(['fifo', 'fefo', 'nearest_bin', 'single_bin']);
export type AllocationStrategy = z.infer<typeof AllocationStrategy>;

/** A shelf label. Uppercased and trimmed so `a-01-01` and `A-01-01` are the same
 *  shelf — people type these on a phone, at speed, next to the rack. */
export const BinCode = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((v) => v.toUpperCase());

export const CreateBinInput = z.object({
  warehouseId: Uuid,
  code: BinCode,
  name: z.string().trim().max(120).optional(),
  // All four free text: every warehouse names its geography differently, and a
  // schema insisting on ours would be fought rather than filled in.
  zone: z.string().trim().max(60).optional(),
  aisle: z.string().trim().max(60).optional(),
  rack: z.string().trim().max(60).optional(),
  shelf: z.string().trim().max(60).optional(),
  type: BinType.default('pick'),
  /** Defaults from `type` when omitted; overridable because the two come apart. */
  isSellable: z.boolean().optional(),
  pickSequence: z.number().int().min(0).max(1_000_000).optional(),
  capacityUnits: z.number().int().positive().max(10_000_000).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateBinInput = z.infer<typeof CreateBinInput>;

// `type` is re-declared WITHOUT its default, deliberately. `.partial()` makes a
// field optional but leaves `.default()` in place, so a patch of `{ name: 'A-1' }`
// would parse to `{ name: 'A-1', type: 'pick' }` and the update service — which
// writes whatever is not undefined — would silently turn a quarantine shelf into
// a pick shelf on a rename. See patch-semantics.test.ts, which caught exactly
// this and three like it.
export const UpdateBinInput = CreateBinInput.omit({ warehouseId: true })
  .partial()
  .extend({ type: BinType.optional(), isActive: z.boolean().optional() });
export type UpdateBinInput = z.infer<typeof UpdateBinInput>;

export const MoveBetweenBinsInput = z.object({
  variantId: Uuid,
  fromBinId: Uuid,
  toBinId: Uuid,
  quantity: z.number().int().positive().max(10_000_000),
  note: z.string().max(2000).optional(),
  /** Suffixed `:out` / `:in` for the two halves, so a retried move applies once. */
  idempotencyKey: z.string().max(100).optional(),
});
export type MoveBetweenBinsInput = z.infer<typeof MoveBetweenBinsInput>;

/** One line of a put-away: what arrived, and which shelf it went on. */
export const PutAwayLineInput = z.object({
  variantId: Uuid,
  binId: Uuid,
  quantity: z.number().int().positive().max(10_000_000),
});
export type PutAwayLineInput = z.infer<typeof PutAwayLineInput>;

export const PutAwayInput = z.object({
  /** The shelf the goods are currently sitting on — usually a `receiving` bin. */
  fromBinId: Uuid,
  lines: z.array(PutAwayLineInput).min(1).max(500),
  note: z.string().max(2000).optional(),
});
export type PutAwayInput = z.infer<typeof PutAwayInput>;

/** What to do with returned goods once someone has looked at them.
 *
 *  Declared here in Phase 2 alongside the shelf vocabulary and unused until
 *  Phase 9.7 gave it somewhere to be stored (`commerce_return_inspections`).
 *  The behaviour each value implies lives in `dispositionEffect` in ./demand. */
export const ReturnDisposition = z.enum([
  // Back on the shelf and sellable again.
  'restock',
  // Held pending inspection — on the quarantine shelf, not sellable.
  'quarantine',
  // Fixable, and worth fixing. On the repair shelf, not sellable, and
  // deliberately NOT `damaged`: the two piles have opposite futures, and a
  // refurbisher whose repair queue is reported as shrinkage is being told its
  // best margin is a loss (docs/146 Phase 9.7).
  'repair',
  // Broken beyond use. Never re-enters stock — see `dispositionEffect` for why
  // that means no movement at all rather than a receive/write-off pair.
  'scrap',
]);
export type ReturnDisposition = z.infer<typeof ReturnDisposition>;

export const OversellIncidentKind = z.enum([
  // A `deny` variant refused the hold. Lost revenue, correct behaviour.
  'blocked',
  // A `continue`/`preorder` variant took a hold it cannot cover today.
  'allowed',
  // A committed sale drove on-hand below zero. Goods left that we did not
  // believe existed — always worth a look.
  'negative_on_hand',
]);
export type OversellIncidentKind = z.infer<typeof OversellIncidentKind>;

// ─── External sync (P5c Tier B — generic SaaS HTTP-API pull) ──────────────────────
//
// A `type: 'api'` source pulls JSON over HTTPS and maps it onto the SAME ingest
// funnel every tier writes through. The config is fully declarative so a single
// adapter serves NetSuite, Cin7, a 3PL portal, etc. without per-vendor code:
//
//   • endpoint / auth — where to fetch + how to authenticate (bearer token or a
//     custom header). The secret is stored server-side and redacted from reads.
//   • itemsPath — dot-path to the array of stock rows in the response body
//     ('' = the body itself is the array).
//   • {sku,location,quantity,cost,syncedAt}Field — dot-paths to each value on a row.
//     `syncedAtField` is the source's own observation time → drives last-writer
//     ordering (an out-of-order older row is dropped, not applied).
//   • costUnit — whether `costField` is already in cents or in major units (dollars).
//   • pagination — page-number (`pageParam`) or cursor (`cursorPath`), capped at
//     `maxPages` so a runaway feed can't loop forever.
//
// Stored as the source's opaque `config` JSON; validated on create/update.
export const ApiSourceConfig = z
  .object({
    endpoint: z.string().url().max(2048),
    authScheme: z.enum(['none', 'bearer', 'header']).default('none'),
    // The token / key. Redacted from API responses; preserved on update when the
    // edit form leaves it blank.
    apiKey: z.string().max(4096).optional(),
    // Header name carrying the key when authScheme = 'header' (e.g. 'X-API-Key').
    headerName: z.string().max(128).optional(),
    itemsPath: z.string().max(255).default(''),
    skuField: z.string().min(1).max(128),
    locationField: z.string().max(128).optional(),
    quantityField: z.string().min(1).max(128),
    costField: z.string().max(128).optional(),
    costUnit: z.enum(['cents', 'dollars']).default('cents'),
    syncedAtField: z.string().max(128).optional(),
    pageParam: z.string().max(64).optional(),
    cursorPath: z.string().max(255).optional(),
    maxPages: z.number().int().min(1).max(100).default(1),
  })
  .refine((c) => c.authScheme === 'none' || (c.apiKey ?? '').length > 0, {
    message: 'An API key is required for the selected auth scheme',
    path: ['apiKey'],
  })
  .refine((c) => c.authScheme !== 'header' || (c.headerName ?? '').length > 0, {
    message: 'A header name is required for header auth',
    path: ['headerName'],
  });
export type ApiSourceConfig = z.infer<typeof ApiSourceConfig>;
