// Purchase-order shared toolkit (docs/100 P3b) — row/line serializers, the
// query include shapes, and the helpers the CRUD, line, lifecycle, and document
// modules all lean on (number allocation, totals recompute, status guards,
// line-data resolution, detail load). Kept in one place so every PO path agrees
// on shape + invariants. Depends only on @sparx/db + the module vocabulary, so it
// never cycles with the higher-level PO files that import it.

import type { PurchaseOrderLineInput } from '@sparx/commerce-schemas';
import type { Prisma, TxClient } from '@sparx/db';

import { InventoryConflictError, InventoryNotFoundError } from '../errors';

// ─── Row shapes (serialized, API-facing) ──────────────────────────────────────

export interface PurchaseOrderLineRow {
  id: string;
  variantId: string;
  description: string | null;
  supplierSku: string | null;
  variantSku: string | null;
  productTitle: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCostCents: number;
  lineTotalCents: number;
}

export interface PurchaseOrderRow {
  id: string;
  number: string;
  status: string;
  supplierId: string;
  supplierName: string | null;
  supplierCode: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  currency: string;
  paymentTerms: string | null;
  reference: string | null;
  orderedAt: string | null;
  expectedArrivalAt: string | null;
  receivedAt: string | null;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  lineCount: number;
  quantityOrdered: number;
  quantityReceived: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderDetail extends PurchaseOrderRow {
  lines: PurchaseOrderLineRow[];
}

// ─── Prisma include shapes ─────────────────────────────────────────────────────

const PARTY_SELECT = { select: { name: true, code: true } };

/** List rows: supplier/warehouse labels + just the line quantities for the
 *  ordered/received roll-up (no variant join — keeps the list query light). */
export const LIST_INCLUDE = {
  supplier: PARTY_SELECT,
  warehouse: PARTY_SELECT,
  lines: { select: { quantityOrdered: true, quantityReceived: true } },
} satisfies Prisma.PurchaseOrderInclude;

/** Detail: full lines with the variant SKU / product title for display. */
export const DETAIL_INCLUDE = {
  supplier: PARTY_SELECT,
  warehouse: PARTY_SELECT,
  lines: {
    orderBy: { createdAt: 'asc' },
    include: { variant: { select: { sku: true, product: { select: { title: true } } } } },
  },
} satisfies Prisma.PurchaseOrderInclude;

type PoWithLineQty = Prisma.PurchaseOrderGetPayload<{ include: typeof LIST_INCLUDE }>;
type PoWithLines = Prisma.PurchaseOrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;
type PoLineFull = PoWithLines['lines'][number];

// ─── Serializers ───────────────────────────────────────────────────────────────

export function serializePurchaseOrderRow(po: PoWithLineQty): PurchaseOrderRow {
  const quantityOrdered = po.lines.reduce((s, l) => s + l.quantityOrdered, 0);
  const quantityReceived = po.lines.reduce((s, l) => s + l.quantityReceived, 0);
  return {
    id: po.id,
    number: po.number,
    status: po.status,
    supplierId: po.supplierId,
    supplierName: po.supplier?.name ?? null,
    supplierCode: po.supplier?.code ?? null,
    warehouseId: po.warehouseId,
    warehouseName: po.warehouse?.name ?? null,
    warehouseCode: po.warehouse?.code ?? null,
    currency: po.currency,
    paymentTerms: po.paymentTerms,
    reference: po.reference,
    orderedAt: po.orderedAt?.toISOString() ?? null,
    expectedArrivalAt: po.expectedArrivalAt?.toISOString() ?? null,
    receivedAt: po.receivedAt?.toISOString() ?? null,
    subtotalCents: po.subtotalCents,
    shippingCents: po.shippingCents,
    totalCents: po.totalCents,
    lineCount: po.lines.length,
    quantityOrdered,
    quantityReceived,
    notes: po.notes,
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
  };
}

export function serializePurchaseOrderLine(line: PoLineFull): PurchaseOrderLineRow {
  return {
    id: line.id,
    variantId: line.variantId,
    description: line.description,
    supplierSku: line.supplierSku,
    variantSku: line.variant?.sku ?? null,
    productTitle: line.variant?.product?.title ?? null,
    quantityOrdered: line.quantityOrdered,
    quantityReceived: line.quantityReceived,
    unitCostCents: line.unitCostCents,
    lineTotalCents: line.quantityOrdered * line.unitCostCents,
  };
}

export function serializePurchaseOrderDetail(po: PoWithLines): PurchaseOrderDetail {
  return { ...serializePurchaseOrderRow(po), lines: po.lines.map(serializePurchaseOrderLine) };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const PO_PREFIX = 'PO-';
const PO_PAD = 6;

/** Next per-tenant PO number (count + 1, padded). Monotonic, gap-prone on
 *  deletes; the (tenant_id, number) unique constraint is the collision backstop,
 *  so `createPurchaseOrder` retries on a lost race. */
export async function nextPurchaseOrderNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.purchaseOrder.count({ where: { tenantId } });
  return `${PO_PREFIX}${(count + 1).toString().padStart(PO_PAD, '0')}`;
}

export interface PurchaseOrderHeaderLite {
  id: string;
  number: string;
  status: string;
  supplierId: string;
  warehouseId: string;
}

export async function ensurePurchaseOrder(
  tx: TxClient,
  id: string
): Promise<PurchaseOrderHeaderLite> {
  const po = await tx.purchaseOrder.findFirst({
    where: { id },
    select: { id: true, number: true, status: true, supplierId: true, warehouseId: true },
  });
  if (!po) throw new InventoryNotFoundError('PurchaseOrder', id);
  return po;
}

/** Guard a state transition: throw a 409 when the PO is not in an allowed status
 *  for `action` (e.g. editing a submitted PO). */
export function assertStatus(
  po: { number: string; status: string },
  allowed: readonly string[],
  action: string
): void {
  if (!allowed.includes(po.status)) {
    throw new InventoryConflictError(
      `Purchase order ${po.number} cannot be ${action} while ${po.status}`,
      'status'
    );
  }
}

/** Recompute the denormalized subtotal/total from the current lines + shipping.
 *  Call after any line or shipping mutation. */
export async function recomputeTotals(tx: TxClient, purchaseOrderId: string): Promise<void> {
  const [lines, po] = await Promise.all([
    tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId },
      select: { quantityOrdered: true, unitCostCents: true },
    }),
    tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { shippingCents: true },
    }),
  ]);
  const subtotal = lines.reduce((s, l) => s + l.quantityOrdered * l.unitCostCents, 0);
  const shipping = po?.shippingCents ?? 0;
  await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { subtotalCents: subtotal, totalCents: subtotal + shipping },
  });
}

export interface ResolvedLineData {
  variantId: string;
  quantityOrdered: number;
  unitCostCents: number;
  supplierSku: string | null;
  description: string | null;
}

/** Resolve a PO line's stored fields from input + defaults: cost falls back from
 *  the explicit override → the (supplier, variant) link cost → the variant cost →
 *  0; SKU + description snapshot from the link / catalog when omitted. */
export async function resolveLineData(
  tx: TxClient,
  supplierId: string,
  input: PurchaseOrderLineInput
): Promise<ResolvedLineData> {
  const variant = await tx.productVariant.findFirst({
    where: { id: input.variantId, deletedAt: null },
    select: { id: true, title: true, costCents: true, product: { select: { title: true } } },
  });
  if (!variant) throw new InventoryNotFoundError('Variant', input.variantId);

  const link = await tx.supplierVariant.findUnique({
    where: { supplierId_variantId: { supplierId, variantId: input.variantId } },
    select: { unitCostCents: true, supplierSku: true },
  });

  return {
    variantId: input.variantId,
    quantityOrdered: input.quantity,
    unitCostCents: input.unitCostCents ?? link?.unitCostCents ?? variant.costCents ?? 0,
    supplierSku: input.supplierSku ?? link?.supplierSku ?? null,
    description: input.description ?? variant.title ?? variant.product?.title ?? null,
  };
}

/** Load a PO + its lines, serialized. Throws NOT_FOUND when missing. */
export async function loadPurchaseOrderDetail(
  tx: TxClient,
  id: string
): Promise<PurchaseOrderDetail> {
  const po = await tx.purchaseOrder.findFirst({ where: { id }, include: DETAIL_INCLUDE });
  if (!po) throw new InventoryNotFoundError('PurchaseOrder', id);
  return serializePurchaseOrderDetail(po);
}
