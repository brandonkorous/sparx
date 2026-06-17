// Inventory schemas — warehouses, levels, adjustments, reservations, lots,
// serials. Hazmat surfaces here (and on Product); the shipping provider
// reads it to decide ground/air/freight routing.

import { z } from 'zod';

import { Uuid } from '@sparx/crm-schemas';

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

export const UpdateWarehouseInput = CreateWarehouseInput.partial();
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

// ─── Reservations ─────────────────────────────────────────────────────
//
// Cart reservations are soft (30-minute TTL); order reservations are hard
// (released only by fulfillment, cancellation, or refund). Both flow
// through `inventoryService.reserve()` — only entry point.

export const ReserveInventoryInput = z.object({
  variantId: Uuid,
  warehouseId: Uuid.optional(), // service picks warehouse if absent
  quantity: z.number().int().positive(),
  holderType: z.enum(['cart', 'order', 'subscription']),
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

export const UpdateSupplierInput = CreateSupplierInput.partial();
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

export const ReceiveLineInput = z.object({
  purchaseOrderLineId: Uuid,
  quantity: z.number().int().positive(),
  // Actual landed cost — defaults to the PO line's agreed cost when omitted.
  unitCostCents: z.number().int().nonnegative().optional(),
  lotNumber: z.string().min(1).max(63).optional(),
});
export type ReceiveLineInput = z.infer<typeof ReceiveLineInput>;

export const CreateGoodsReceiptInput = z.object({
  purchaseOrderId: Uuid,
  receivedAt: z.string().datetime().optional(),
  reference: z.string().max(120).optional(), // packing slip / carrier ref
  note: z.string().max(2000).optional(),
  lines: z.array(ReceiveLineInput).min(1).max(500),
});
export type CreateGoodsReceiptInput = z.infer<typeof CreateGoodsReceiptInput>;
