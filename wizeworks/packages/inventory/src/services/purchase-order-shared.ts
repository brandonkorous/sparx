// Purchase-order shared toolkit (docs/100 P3b) — row/line serializers, the
// query include shapes, and the helpers the CRUD, line, lifecycle, and document
// modules all lean on (number allocation, totals recompute, status guards,
// line-data resolution, detail load). Kept in one place so every PO path agrees
// on shape + invariants. Depends only on @wizeworks/db + the module vocabulary, so it
// never cycles with the higher-level PO files that import it.

import type { PurchaseOrderLineInput } from '@wizeworks/commerce-schemas';
import type { Prisma, TxClient } from '@wizeworks/db';

import { InventoryConflictError, InventoryNotFoundError } from '../errors';

import { resolveSupplierPriceOnTx } from './supplier-price-breaks';
import { resolveLineUom, toBaseUnitCost, toBaseUnits } from './units-of-measure';

// ─── Row shapes (serialized, API-facing) ──────────────────────────────────────

export interface PurchaseOrderLineRow {
  id: string;
  variantId: string;
  description: string | null;
  supplierSku: string | null;
  variantSku: string | null;
  productTitle: string | null;
  /** Base units, always (docs/146 Phase 6.2). The pair below says what the
   *  buyer ordered in, so the screen can read "4 cases (48 each)". */
  quantityOrdered: number;
  quantityReceived: number;
  /** Per base unit. Multiply by `unitsPerUom` for the price of a pack. */
  unitCostCents: number;
  lineTotalCents: number;
  uomCode: string | null;
  unitsPerUom: number;
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
  /** When the nightly pass announced this order as late, or null if it never
   *  has. NOT the same as "on time": an order that went past its date this
   *  afternoon has not been through a nightly pass yet. The order's own pane
   *  used to state flatly that it had been flagged, with nothing to read it
   *  from — this is that field. Cleared again whenever a new date is accepted,
   *  so it always refers to the date currently on the order. */
  lateAlertedAt: string | null;
  subtotalCents: number;
  freightCents: number;
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
  /** Freight booked in WITH the goods, which `freightCents` never hears about.
   *  Separate because one is what was agreed and the other is what turned up,
   *  and checking an invoice needs both. See `receiptFreightCents`. */
  receiptFreightCents: number;
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
  // Freight can arrive AFTER the order is raised, booked in against a delivery
  // rather than agreed up front, and the order's own `freightCents` never hears
  // about it. Without this the Freight field reads $0.00 over a real charge —
  // see `receiptFreightCents` (issue 552).
  receipts: { select: { charges: { select: { kind: true, amountCents: true } } } },
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
    lateAlertedAt: po.lateAlertedAt?.toISOString() ?? null,
    subtotalCents: po.subtotalCents,
    freightCents: po.freightCents,
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
    uomCode: line.uomCode,
    unitsPerUom: line.unitsPerUom,
  };
}

export function serializePurchaseOrderDetail(po: PoWithLines): PurchaseOrderDetail {
  return {
    ...serializePurchaseOrderRow(po),
    lines: po.lines.map(serializePurchaseOrderLine),
    receiptFreightCents: receiptFreightCents(po),
  };
}

/**
 * Freight booked in WITH the goods, rather than agreed when the order was
 * raised.
 *
 * `PurchaseOrder.freightCents` is the second one: it is written when the order
 * is created or edited, and it is what the order screen shows. A charge added
 * during receiving lands on `GoodsReceiptCharge` instead, and nothing carries
 * it back — so the screen said "Freight $0.00" over a delivery that had cost
 * $14.00 to get there, while every figure downstream had it: the stock was
 * valued at $3.84 a unit against a $3.60 goods cost, and the supplier's invoice
 * came in at $222.72 against an order total of $216.00. She had no way to see
 * where the $6.72 came from (issue 552).
 *
 * Reported separately rather than added into `freightCents`, because they are
 * different facts. One is what she agreed to pay; the other is what turned up.
 * Merging them would lose which is which, and she needs both to check an
 * invoice.
 */
function receiptFreightCents(po: PoWithLines): number {
  return po.receipts.reduce(
    (total, receipt) =>
      total +
      receipt.charges
        .filter((charge) => charge.kind === 'freight')
        .reduce((sum, charge) => sum + charge.amountCents, 0),
    0
  );
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

/** Recompute the denormalized subtotal/total from the current lines + freight.
 *  Call after any line or freight mutation. */
export async function recomputeTotals(tx: TxClient, purchaseOrderId: string): Promise<void> {
  const [lines, po] = await Promise.all([
    tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId },
      select: { quantityOrdered: true, unitCostCents: true },
    }),
    tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { tenantId: true, freightCents: true },
    }),
  ]);
  const subtotal = lines.reduce((s, l) => s + l.quantityOrdered * l.unitCostCents, 0);
  const freight = po?.freightCents ?? 0;
  await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { subtotalCents: subtotal, totalCents: subtotal + freight },
  });
  if (po) await syncOrderFreightCharge(tx, po.tenantId, purchaseOrderId, freight);
}

/**
 * Keep the order's freight charge in step with the freight typed on the order.
 *
 * FREIGHT IS INBOUND — what it costs to get these goods from the supplier to
 * you — so it is part of what the stock cost and has to reach the value of what
 * arrives. SHIPPING is the outbound word, what a customer pays to have an order
 * sent to them, and it is a selling expense that never touches stock value.
 * Both were called shipping, and the inbound one behaved like the outbound one
 * as a result: a line on the order total and nothing more. A dressmaker typed
 * $25 of carriage on a $720 order, paid $745, and the 38 metres that arrived
 * were valued at $684 (persona issue 496).
 *
 * It is written as a real PurchaseOrderCharge rather than read straight off the
 * order, because that is what already apportions a cost across part-deliveries:
 * `allocatedCents` is what stops four shipments each claiming the whole $25,
 * and there is nowhere to record that against a number living on the order.
 *
 * `isOrderFreight` marks the one charge this function owns. A freight charge
 * somebody added themselves is untouched — they are different facts (the
 * supplier's carriage line versus the forwarder's own invoice) and a person who
 * recorded both meant both.
 *
 * This function itself never re-costs anything — it only keeps the charge in
 * step with the typed freight, and never trims it below what deliveries have
 * already taken.
 *
 * The ORDER does get replayed, though, and it is worth knowing which. Posting a
 * delivery calls `reallocateOrderCharges`, which zeroes every charge on the
 * order and re-runs all of its deliveries in the sequence they arrived. So
 * raising freight after some stock has landed DOES reach what landed earlier,
 * on the next posting. That is deliberate and it is what makes the total
 * honest: when the last 2 metres of a 40-metre order were booked in, the first
 * 38 picked up their $23.75 share and all forty settled at $18.63 against the
 * $745 actually paid. Without the replay that $23.75 would simply have
 * evaporated, which is the defect this whole change exists to close (496).
 *
 * What is NOT rewritten is a sale. The replay moves the value of what is still
 * on hand; units already sold were sold at the cost recorded at the time.
 */
async function syncOrderFreightCharge(
  tx: TxClient,
  tenantId: string,
  purchaseOrderId: string,
  freightCents: number
): Promise<void> {
  const existing = await tx.purchaseOrderCharge.findFirst({
    where: { tenantId, purchaseOrderId, isOrderFreight: true },
    select: { id: true, amountCents: true, allocatedCents: true },
  });

  if (freightCents <= 0) {
    // Cleared. What has already been apportioned to a posted delivery stays
    // apportioned, so the row only goes when it never reached anything.
    if (existing?.allocatedCents === 0) {
      await tx.purchaseOrderCharge.delete({ where: { id: existing.id } });
    } else if (existing) {
      await tx.purchaseOrderCharge.update({
        where: { id: existing.id },
        data: { amountCents: existing.allocatedCents },
      });
    }
    return;
  }

  if (!existing) {
    await tx.purchaseOrderCharge.create({
      data: {
        tenantId,
        purchaseOrderId,
        kind: 'freight',
        description: 'Freight on the order',
        amountCents: freightCents,
        allocationBasis: 'value',
        isOrderFreight: true,
      },
    });
    return;
  }

  if (existing.amountCents === freightCents) return;
  // Never below what deliveries have already taken, or the running total of
  // what has been apportioned would exceed the charge it came from.
  await tx.purchaseOrderCharge.update({
    where: { id: existing.id },
    data: { amountCents: Math.max(freightCents, existing.allocatedCents) },
  });
}

export interface ResolvedLineData {
  variantId: string;
  /** Base units, always — whatever the buyer typed it in. */
  quantityOrdered: number;
  /** Per base unit, likewise. */
  unitCostCents: number;
  supplierSku: string | null;
  description: string | null;
  /** What the buyer ordered in, snapshot onto the line (docs/146 Phase 6.2). */
  uomCode: string | null;
  unitsPerUom: number;
}

/** Resolve a PO line's stored fields from input + defaults: cost falls back from
 *  the explicit override → the (supplier, variant) link cost → the variant cost →
 *  0; SKU + description snapshot from the link / catalog when omitted.
 *
 *  Units of measure (docs/146 Phase 6.2): when the buyer names a pack unit, the
 *  quantity and the cost they typed are IN that unit — "4 cases at £48" — and
 *  both are converted here, once, before anything is stored. What lands in
 *  `quantityOrdered` and `unitCostCents` is always base units and per-base-unit
 *  cost, so every existing sum, receipt, reorder suggestion and report keeps
 *  working on one unit and needs to know nothing about cases. The code and the
 *  factor are snapshot alongside so the printed order can still read "4 cases".
 *
 *  With no unit named, the item's usual PURCHASE unit is used when it has one —
 *  a business that buys everything by the case should not have to say so on
 *  every line. Nothing set anywhere means base units, which is most items. */
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

  const uom = await resolveLineUom(tx, {
    variantId: input.variantId,
    ...(input.uomCode !== undefined ? { uomCode: input.uomCode } : {}),
    purpose: 'purchase',
  });

  const quantityOrdered = toBaseUnits(input.quantity, uom.unitsPerUom);

  // Quantity price breaks (docs/146 Phase 8.4). Resolved against the BASE-unit
  // quantity, because a ladder written as "fifty units" must not be dodged by
  // ordering five cases of ten. Only consulted when the buyer did not type a
  // cost — an explicit figure is a negotiated one and always wins.
  const ladderPrice =
    input.unitCostCents === undefined
      ? await resolveSupplierPriceOnTx(tx, {
          supplierId,
          variantId: input.variantId,
          quantity: quantityOrdered,
        })
      : null;

  // The fallback costs (the supplier link, the catalogue) are already per base
  // unit — only a cost the buyer TYPED alongside a pack unit is per pack.
  const typedCost = input.unitCostCents;
  const baseUnitCost =
    typedCost !== undefined
      ? toBaseUnitCost(typedCost, uom.unitsPerUom)
      : (ladderPrice?.unitCostCents ?? link?.unitCostCents ?? variant.costCents ?? 0);

  return {
    variantId: input.variantId,
    quantityOrdered,
    unitCostCents: baseUnitCost,
    supplierSku: input.supplierSku ?? link?.supplierSku ?? null,
    description: input.description ?? variant.title ?? variant.product?.title ?? null,
    uomCode: uom.uomCode,
    unitsPerUom: uom.unitsPerUom,
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
