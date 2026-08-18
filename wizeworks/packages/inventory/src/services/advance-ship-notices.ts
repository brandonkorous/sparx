// Advance ship notices (docs/146 Phase 8.6) — what the supplier says they put on
// the lorry, before it gets here.
//
// The value is not the paperwork. It is that receiving stops being transcription
// — the lines are already on the screen with quantities on them, and the
// receiver's job narrows to confirming or correcting — and, more importantly,
// that a DISCREPANCY becomes visible at all. Without a notice, a short shipment
// and a short order look identical, so nobody ever notices they were billed for
// the difference.
//
// ── Discrepancies are computed, never stored ─────────────────────────────────
//
// The gap is the difference between these lines and the receipt lines, both of
// which are already recorded. A third copy is a number that goes stale the first
// time a receipt is corrected — and a stale discrepancy is worse than none,
// because somebody will chase a supplier over it.
//
// ── A notice is a CLAIM, not a fact ──────────────────────────────────────────
//
// Nothing here touches stock. An ASN moves no units, opens no cost layer and
// changes no availability, because the goods are on a lorry and the supplier's
// word is not a receipt. Every quantity on this record is what they SAID.

import { CreateAsnInput, UpdateAsnInput, type AsnLineInput } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

import { resolveLineUom, toBaseUnits } from './units-of-measure';

const ASN_PREFIX = 'ASN-';
const ASN_PAD = 6;

export interface AsnLineRow {
  id: string;
  purchaseOrderLineId: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  /** Base units, as stated by the supplier. */
  quantityShipped: number;
  uomCode: string | null;
  unitsPerUom: number;
  lotNumber: string | null;
  /** What the order asked for, for context on the same row. */
  quantityOrdered: number;
  /** What has actually arrived against that order line so far. */
  quantityReceived: number;
  /** Received minus shipped, once anything has been received against the notice.
   *  Null while the notice is still `expected` — nothing has arrived, so there
   *  is nothing to disagree with, and printing 0 here would read as "matched". */
  discrepancyUnits: number | null;
}

export interface AsnRow {
  id: string;
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string | null;
  supplierId: string;
  supplierName: string | null;
  status: string;
  reference: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  packageCount: number | null;
  shippedAt: string | null;
  expectedArrivalAt: string | null;
  receivedAt: string | null;
  goodsReceiptId: string | null;
  source: string;
  notes: string | null;
  /** Total units the supplier says are on the way, across all lines. */
  unitsShipped: number;
  /** Past its stated arrival date and still `expected`. A notice that says the
   *  lorry left and never arrived is the strongest signal in this whole phase. */
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AsnDetail extends AsnRow {
  lines: AsnLineRow[];
  /** True when ANY line disagrees with what arrived. Null while nothing has been
   *  received — see `discrepancyUnits`. */
  hasDiscrepancy: boolean | null;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListAsnFilter {
  purchaseOrderId?: string;
  supplierId?: string;
  status?: 'expected' | 'received' | 'cancelled';
  /** Only notices past their stated arrival date and still expected. */
  overdueOnly?: boolean;
  take?: number;
  skip?: number;
}

export async function listAdvanceShipNotices(
  ctx: ServiceContext,
  filter: ListAsnFilter = {}
): Promise<{ items: AsnRow[]; total: number }> {
  const take = Math.min(filter.take ?? 50, 250);
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.purchaseOrderId ? { purchaseOrderId: filter.purchaseOrderId } : {}),
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.overdueOnly ? { status: 'expected', expectedArrivalAt: { lt: new Date() } } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.advanceShipNotice.findMany({
        where,
        // Soonest expected first — an inbound pipeline is read as a queue.
        orderBy: [{ expectedArrivalAt: 'asc' }, { createdAt: 'desc' }],
        take,
        skip: filter.skip ?? 0,
        include: LIST_INCLUDE,
      }),
      tx.advanceShipNotice.count({ where }),
    ]);
    return { items: rows.map(serializeRow), total };
  });
}

export async function getAdvanceShipNotice(ctx: ServiceContext, id: string): Promise<AsnDetail> {
  return withTenant(ctx, (tx) => loadDetail(tx, id));
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Record a notice against an order.
 *
 * Allowed only on an order that has actually been placed. A notice against a
 * draft is nonsense — the supplier cannot have shipped something nobody ordered
 * — and against a `pending_approval` order it would be worse than nonsense,
 * because it would suggest the spend went ahead while the approval was still
 * outstanding.
 */
export async function createAdvanceShipNotice(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<AsnDetail> {
  const input = CreateAsnInput.parse(rawInput);

  const id = await withTenant(ctx, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId },
      select: { id: true, number: true, status: true, supplierId: true },
    });
    if (!po) throw new InventoryNotFoundError('PurchaseOrder', input.purchaseOrderId);
    if (po.status !== 'submitted' && po.status !== 'partial') {
      throw new InventoryConflictError(
        `Purchase order ${po.number} is ${po.status}, so nothing can have shipped against it`,
        'status'
      );
    }

    const lines = await resolveLines(tx, po.id, input.lines);

    const asn = await tx.advanceShipNotice.create({
      data: {
        tenantId: ctx.tenantId,
        number: await nextAsnNumber(tx, ctx.tenantId),
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        status: 'expected',
        reference: input.reference ?? null,
        carrier: input.carrier ?? null,
        trackingNumber: input.trackingNumber ?? null,
        packageCount: input.packageCount ?? null,
        shippedAt: input.shippedAt ? new Date(input.shippedAt) : null,
        expectedArrivalAt: input.expectedArrivalAt ? new Date(input.expectedArrivalAt) : null,
        source: input.source,
        notes: input.notes ?? null,
        lines: {
          create: lines.map((line) => ({
            tenantId: ctx.tenantId,
            purchaseOrderLineId: line.purchaseOrderLineId,
            variantId: line.variantId,
            quantityShipped: line.quantityShipped,
            uomCode: line.uomCode,
            unitsPerUom: line.unitsPerUom,
            lotNumber: line.lotNumber,
          })),
        },
      },
      select: { id: true, number: true },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.advance_ship_notice.created',
      entityType: 'AdvanceShipNotice',
      entityId: asn.id,
      diff: { after: { number: asn.number, purchaseOrder: po.number, lines: lines.length } },
    });

    return asn.id;
  });

  return getAdvanceShipNotice(ctx, id);
}

/** Header edits. Lines are not editable: a notice is the supplier's statement,
 *  and quietly rewriting what they said would destroy the only thing it is for. */
export async function updateAdvanceShipNotice(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<AsnDetail> {
  const input = UpdateAsnInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const asn = await tx.advanceShipNotice.findFirst({
      where: { id },
      select: { id: true, number: true, status: true },
    });
    if (!asn) throw new InventoryNotFoundError('AdvanceShipNotice', id);
    if (asn.status !== 'expected') {
      throw new InventoryConflictError(
        `Notice ${asn.number} has already been ${asn.status}`,
        'status'
      );
    }

    await tx.advanceShipNotice.update({
      where: { id },
      data: {
        ...(input.reference !== undefined ? { reference: input.reference } : {}),
        ...(input.carrier !== undefined ? { carrier: input.carrier } : {}),
        ...(input.trackingNumber !== undefined ? { trackingNumber: input.trackingNumber } : {}),
        ...(input.packageCount !== undefined ? { packageCount: input.packageCount } : {}),
        ...(input.shippedAt !== undefined
          ? { shippedAt: input.shippedAt ? new Date(input.shippedAt) : null }
          : {}),
        ...(input.expectedArrivalAt !== undefined
          ? {
              expectedArrivalAt: input.expectedArrivalAt ? new Date(input.expectedArrivalAt) : null,
            }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    return loadDetail(tx, id);
  });
}

/** The lorry is not coming. Keeps the record — a cancelled notice is evidence of
 *  a promise that was made. */
export async function cancelAdvanceShipNotice(ctx: ServiceContext, id: string): Promise<AsnDetail> {
  return withTenant(ctx, async (tx) => {
    const asn = await tx.advanceShipNotice.findFirst({
      where: { id },
      select: { id: true, number: true, status: true },
    });
    if (!asn) throw new InventoryNotFoundError('AdvanceShipNotice', id);
    if (asn.status === 'received') {
      throw new InventoryConflictError(
        `Notice ${asn.number} has already been received against`,
        'status'
      );
    }
    await tx.advanceShipNotice.update({ where: { id }, data: { status: 'cancelled' } });
    return loadDetail(tx, id);
  });
}

// ─── Receiving pre-fill ──────────────────────────────────────────────────────

export interface AsnPrefillLine {
  purchaseOrderLineId: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  /** What to put in the box, in base units. */
  quantity: number;
  uomCode: string | null;
  unitsPerUom: number;
  lotNumber: string | null;
  /** Still outstanding on the order line. The receiver needs both: a notice can
   *  say more than the order has left, which is itself worth showing. */
  quantityOutstanding: number;
  /** True when the notice claims more than the order still has open. */
  exceedsOutstanding: boolean;
}

export interface AsnPrefill {
  advanceShipNoticeId: string;
  number: string;
  purchaseOrderId: string;
  reference: string | null;
  lines: AsnPrefillLine[];
}

/**
 * The lines a receiver should see pre-filled when booking a delivery.
 *
 * Deliberately a READ that returns a suggestion, not a write that creates a
 * receipt. The receiver is the one who has the pallet in front of them, and the
 * entire value of the notice evaporates if the software books what the supplier
 * claimed without anyone looking. Pre-fill, then confirm.
 */
export async function prefillFromAdvanceShipNotice(
  ctx: ServiceContext,
  id: string
): Promise<AsnPrefill> {
  return withTenant(ctx, async (tx) => {
    const asn = await tx.advanceShipNotice.findFirst({
      where: { id },
      include: {
        lines: {
          include: {
            purchaseOrderLine: {
              select: { id: true, quantityOrdered: true, quantityReceived: true },
            },
            variant: { select: { sku: true, product: { select: { title: true } } } },
          },
        },
      },
    });
    if (!asn) throw new InventoryNotFoundError('AdvanceShipNotice', id);
    if (asn.status !== 'expected') {
      throw new InventoryConflictError(
        `Notice ${asn.number} has already been ${asn.status}`,
        'status'
      );
    }

    return {
      advanceShipNoticeId: asn.id,
      number: asn.number,
      purchaseOrderId: asn.purchaseOrderId,
      reference: asn.reference,
      lines: asn.lines.map((line) => {
        const outstanding = Math.max(
          0,
          line.purchaseOrderLine.quantityOrdered - line.purchaseOrderLine.quantityReceived
        );
        return {
          purchaseOrderLineId: line.purchaseOrderLineId,
          variantId: line.variantId,
          variantSku: line.variant?.sku ?? null,
          productTitle: line.variant?.product?.title ?? null,
          // The supplier's claim, NOT clamped to what is outstanding. Clamping
          // would silently hide the case the notice exists to expose.
          quantity: line.quantityShipped,
          uomCode: line.uomCode,
          unitsPerUom: line.unitsPerUom,
          lotNumber: line.lotNumber,
          quantityOutstanding: outstanding,
          exceedsOutstanding: line.quantityShipped > outstanding,
        };
      }),
    };
  });
}

/**
 * Mark a notice as satisfied by a receipt.
 *
 * Called by the receiving path when the receiver said which notice they were
 * booking against. Deliberately does not verify the quantities agree — the
 * discrepancy is a fact to be REPORTED, not a reason to refuse a delivery that
 * is physically on the floor.
 */
export async function consumeAdvanceShipNoticeOnTx(
  tx: TxClient,
  params: { advanceShipNoticeId: string; goodsReceiptId: string; receivedAt: Date }
): Promise<void> {
  const asn = await tx.advanceShipNotice.findFirst({
    where: { id: params.advanceShipNoticeId },
    select: { id: true, number: true, status: true },
  });
  if (!asn) throw new InventoryNotFoundError('AdvanceShipNotice', params.advanceShipNoticeId);
  if (asn.status === 'cancelled') {
    throw new InventoryConflictError(
      `Notice ${asn.number} was cancelled and cannot be received against`,
      'status'
    );
  }
  await tx.advanceShipNotice.update({
    where: { id: asn.id },
    data: {
      status: 'received',
      receivedAt: params.receivedAt,
      goodsReceiptId: params.goodsReceiptId,
    },
  });
}

// ─── plumbing ────────────────────────────────────────────────────────────────

const LIST_INCLUDE = {
  purchaseOrder: { select: { number: true } },
  supplier: { select: { name: true } },
  lines: { select: { quantityShipped: true } },
} as const;

interface ResolvedAsnLine {
  purchaseOrderLineId: string;
  variantId: string;
  quantityShipped: number;
  uomCode: string | null;
  unitsPerUom: number;
  lotNumber: string | null;
}

/** Validate the claimed lines against the order and convert to base units. */
async function resolveLines(
  tx: TxClient,
  purchaseOrderId: string,
  inputs: AsnLineInput[]
): Promise<ResolvedAsnLine[]> {
  const poLines = await tx.purchaseOrderLine.findMany({
    where: { purchaseOrderId },
    select: { id: true, variantId: true, uomCode: true, unitsPerUom: true },
  });
  const byId = new Map(poLines.map((l) => [l.id, l]));

  const seen = new Set<string>();
  const resolved: ResolvedAsnLine[] = [];
  for (const input of inputs) {
    const poLine = byId.get(input.purchaseOrderLineId);
    if (!poLine) {
      throw new InventoryValidationError('That order line is not on this purchase order', [
        { field: 'lines', message: `unknown line ${input.purchaseOrderLineId}` },
      ]);
    }
    // One row per order line. Two rows for the same line is a supplier splitting
    // it across pallets, which is a second NOTICE, not two rows on one.
    if (seen.has(poLine.id)) {
      throw new InventoryValidationError('That order line appears twice on this notice', [
        { field: 'lines', message: `duplicate line ${poLine.id}` },
      ]);
    }
    seen.add(poLine.id);

    // Same unit convention as a receipt: an explicit code wins, otherwise the
    // order's own unit, because a supplier shipping against a case order states
    // cases.
    const uom =
      input.uomCode !== undefined
        ? await resolveLineUom(tx, { variantId: poLine.variantId, uomCode: input.uomCode })
        : { uomCode: poLine.uomCode, unitsPerUom: poLine.unitsPerUom };

    resolved.push({
      purchaseOrderLineId: poLine.id,
      variantId: poLine.variantId,
      quantityShipped: toBaseUnits(input.quantityShipped, uom.unitsPerUom),
      uomCode: uom.uomCode,
      unitsPerUom: uom.unitsPerUom,
      lotNumber: input.lotNumber ?? null,
    });
  }
  return resolved;
}

async function nextAsnNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.advanceShipNotice.count({ where: { tenantId } });
  return `${ASN_PREFIX}${(count + 1).toString().padStart(ASN_PAD, '0')}`;
}

async function loadDetail(tx: TxClient, id: string): Promise<AsnDetail> {
  const asn = await tx.advanceShipNotice.findFirst({
    where: { id },
    include: {
      purchaseOrder: { select: { number: true } },
      supplier: { select: { name: true } },
      lines: {
        include: {
          purchaseOrderLine: { select: { quantityOrdered: true, quantityReceived: true } },
          variant: { select: { sku: true, product: { select: { title: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!asn) throw new InventoryNotFoundError('AdvanceShipNotice', id);

  // A discrepancy only exists once something has actually arrived. Before that,
  // reporting 0 would read as "the notice matched", which is a claim about a
  // delivery nobody has opened.
  const settled = asn.status === 'received';

  const lines: AsnLineRow[] = asn.lines.map((line) => ({
    id: line.id,
    purchaseOrderLineId: line.purchaseOrderLineId,
    variantId: line.variantId,
    variantSku: line.variant?.sku ?? null,
    productTitle: line.variant?.product?.title ?? null,
    quantityShipped: line.quantityShipped,
    uomCode: line.uomCode,
    unitsPerUom: line.unitsPerUom,
    lotNumber: line.lotNumber,
    quantityOrdered: line.purchaseOrderLine.quantityOrdered,
    quantityReceived: line.purchaseOrderLine.quantityReceived,
    discrepancyUnits: settled
      ? line.purchaseOrderLine.quantityReceived - line.quantityShipped
      : null,
  }));

  return {
    ...serializeRow({
      ...asn,
      lines: asn.lines.map((l) => ({ quantityShipped: l.quantityShipped })),
    }),
    lines,
    hasDiscrepancy: settled ? lines.some((l) => (l.discrepancyUnits ?? 0) !== 0) : null,
  };
}

interface AsnRecord {
  id: string;
  number: string;
  purchaseOrderId: string;
  supplierId: string;
  status: string;
  reference: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  packageCount: number | null;
  shippedAt: Date | null;
  expectedArrivalAt: Date | null;
  receivedAt: Date | null;
  goodsReceiptId: string | null;
  source: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  purchaseOrder?: { number: string } | null;
  supplier?: { name: string | null } | null;
  lines: { quantityShipped: number }[];
}

function serializeRow(row: AsnRecord): AsnRow {
  return {
    id: row.id,
    number: row.number,
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderNumber: row.purchaseOrder?.number ?? null,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    status: row.status,
    reference: row.reference,
    carrier: row.carrier,
    trackingNumber: row.trackingNumber,
    packageCount: row.packageCount,
    shippedAt: row.shippedAt?.toISOString() ?? null,
    expectedArrivalAt: row.expectedArrivalAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    goodsReceiptId: row.goodsReceiptId,
    source: row.source,
    notes: row.notes,
    unitsShipped: row.lines.reduce((sum, l) => sum + l.quantityShipped, 0),
    isOverdue:
      row.status === 'expected' &&
      row.expectedArrivalAt !== null &&
      row.expectedArrivalAt.getTime() < Date.now(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
