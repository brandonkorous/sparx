// Receiving — book goods against a submitted PO (docs/100 P3c). A GoodsReceipt is
// posted atomically: each line writes a `receive` movement through the ledger
// (delta +qty, the landed unit cost feeding the moving-average basis), bumps the
// PO line's received count, and optionally mints/extends a LotBatch. The PO then
// advances to `partial` or `received`. There is no editable draft receipt — a
// correction is a later adjustment/count (P4). Standalone-usable.
//
// Damaged-on-arrival units (a line's optional `quantityDamaged`) are booked as a
// PAIR of ledger movements on the same atomic post: a `receive` (+qty at the same
// landed cost, so arrival and cost basis are truthfully recorded) immediately
// followed by a `damage` (−qty) write-off. Net on-hand for the damaged units is 0,
// but both facts and the valued loss live in the ledger. Damaged units are NOT
// credited against the PO line (the supplier still owes them, so a partly-damaged
// delivery keeps the PO open for the shortfall) and never join a lot.

import { CreateGoodsReceiptInput } from '@sparx/commerce-schemas';
import { Prisma, withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

import { consumeAdvanceShipNoticeOnTx } from './advance-ship-notices';
import {
  allocateBackordersOnTx,
  emitBackorderAllocations,
  type BackorderFilled,
} from './backorders';
import { resolvePutAwayBin, systemBinFor } from './bin-routing';
import { loadPolicy } from './costing-policy';
import { reallocateOrderCharges } from './landed-cost';
import { resolveLineUom, toBaseUnitCost, toBaseUnits } from './units-of-measure';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import type { MovementResult } from './ledger';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface GoodsReceiptLineRow {
  id: string;
  purchaseOrderLineId: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantityReceived: number;
  unitCostCents: number;
  lotNumber: string | null;
  movementId: string | null;
  /** Landed cost (docs/146 Phase 5.2) — the invoice cost converted into base
   *  currency, this line's share of the freight, and the two added together.
   *  Null on deliveries booked before landed cost existed. */
  baseUnitCostCents: number | null;
  allocatedChargeCents: number;
  landedUnitCostCents: number | null;
  /** What the receiver counted in (docs/146 Phase 6.2). `quantityReceived` above
   *  is always base units; this is how it was entered. */
  uomCode: string | null;
  unitsPerUom: number;
}

/** One charge on a delivery, as the receipt surface shows it. */
export interface GoodsReceiptChargeRow {
  id: string;
  kind: string;
  description: string | null;
  amountCents: number;
  allocationBasis: string;
}

export interface GoodsReceiptRow {
  id: string;
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  reference: string | null;
  note: string | null;
  receivedAt: string;
  createdAt: string;
  lineCount: number;
  quantityReceived: number;
  /** What the supplier billed in, what the cost ledger is kept in, and the rate
   *  between them on the day the goods landed (docs/146 Phase 5.7). */
  currency: string;
  baseCurrency: string;
  fxRate: number;
}

export interface GoodsReceiptDetail extends GoodsReceiptRow {
  lines: GoodsReceiptLineRow[];
  charges: GoodsReceiptChargeRow[];
  /** Goods + charges, base currency — the three numbers the breakdown adds up. */
  goodsValueCents: number;
  chargeTotalCents: number;
  landedTotalCents: number;
}

const PARTY = { select: { name: true, code: true } };

const LIST_INCLUDE = {
  warehouse: PARTY,
  purchaseOrder: { select: { number: true } },
  lines: { select: { quantityReceived: true } },
} satisfies Prisma.GoodsReceiptInclude;

const DETAIL_INCLUDE = {
  warehouse: PARTY,
  purchaseOrder: { select: { number: true } },
  lines: {
    orderBy: { createdAt: 'asc' },
    include: { variant: { select: { sku: true, product: { select: { title: true } } } } },
  },
  charges: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.GoodsReceiptInclude;

type ReceiptWithQty = Prisma.GoodsReceiptGetPayload<{ include: typeof LIST_INCLUDE }>;
type ReceiptWithLines = Prisma.GoodsReceiptGetPayload<{ include: typeof DETAIL_INCLUDE }>;

// ─── Queries ───────────────────────────────────────────────────────────────────

export async function listGoodsReceipts(
  ctx: ServiceContext,
  filter: { q?: string; purchaseOrderId?: string; take?: number; skip?: number } = {}
): Promise<{ items: GoodsReceiptRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.GoodsReceiptWhereInput = {
      ...(filter.purchaseOrderId ? { purchaseOrderId: filter.purchaseOrderId } : {}),
      ...(filter.q
        ? {
            OR: [
              { number: { contains: filter.q, mode: 'insensitive' } },
              { reference: { contains: filter.q, mode: 'insensitive' } },
              { purchaseOrder: { number: { contains: filter.q, mode: 'insensitive' } } },
              { warehouse: { name: { contains: filter.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.goodsReceipt.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
        include: LIST_INCLUDE,
      }),
      tx.goodsReceipt.count({ where }),
    ]);
    return { items: rows.map(serializeRow), total };
  });
}

export async function getGoodsReceipt(
  ctx: ServiceContext,
  id: string
): Promise<GoodsReceiptDetail> {
  return withTenant(ctx, (tx) => loadDetail(tx, id));
}

// ─── Create (post a receipt) ─────────────────────────────────────────────────

export async function createGoodsReceipt(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<GoodsReceiptDetail> {
  const input = CreateGoodsReceiptInput.parse(rawInput);
  assertNoDuplicateLines(input.lines.map((l) => l.purchaseOrderLineId));

  // The receipt number is allocated count+1; a lost race trips the unique
  // constraint and poisons the pg tx, so the WHOLE attempt retries.
  let created: { receiptId: string; events: ReceiptEvent[]; filled: BackorderFilled[] } | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      created = await createOnce(ctx, input);
      break;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 4) continue;
      throw err;
    }
  }
  if (!created) throw new InventoryValidationError('Could not allocate a goods-receipt number');

  // Threshold events (inStock / low / depleted) fire post-commit, per movement —
  // each carries its own reason (`receive` for good + damaged arrivals, `damage`
  // for the write-off), so the event stream mirrors the ledger truthfully.
  for (const e of created.events) {
    await emitStockEvents(ctx, e.variantId, e.warehouseId, e.result, e.delta, e.reason);
  }

  // Tell whoever was waiting, but only now — after the transaction committed and
  // the units are genuinely on the shelf. An email that says "your part is here"
  // sent from inside a transaction that then rolls back is the one failure mode
  // a backorder queue must never have (docs/146 Phase 9.2).
  await emitBackorderAllocations(ctx, created.filled);

  return getGoodsReceipt(ctx, created.receiptId);
}

interface ReceiptEvent {
  variantId: string;
  warehouseId: string;
  result: MovementResult;
  delta: number;
  reason: string;
}

async function createOnce(
  ctx: ServiceContext,
  input: CreateGoodsReceiptInput
): Promise<{ receiptId: string; events: ReceiptEvent[]; filled: BackorderFilled[] }> {
  return withTenant(ctx, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId },
      select: { id: true, number: true, status: true, warehouseId: true, currency: true },
    });
    if (!po) throw new InventoryNotFoundError('PurchaseOrder', input.purchaseOrderId);
    if (po.status !== 'submitted' && po.status !== 'partial') {
      throw new InventoryConflictError(
        `Cannot receive against purchase order ${po.number} while ${po.status}`,
        'status'
      );
    }

    const poLines = await tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: po.id, id: { in: input.lines.map((l) => l.purchaseOrderLineId) } },
      select: { id: true, variantId: true, unitCostCents: true, uomCode: true, unitsPerUom: true },
    });
    const byId = new Map(poLines.map((l) => [l.id, l]));
    for (const l of input.lines) {
      if (!byId.has(l.purchaseOrderLineId)) {
        throw new InventoryValidationError(`Line is not on purchase order ${po.number}`, [
          { field: 'lines', message: `unknown purchase-order line ${l.purchaseOrderLineId}` },
        ]);
      }
    }

    const number = await nextGoodsReceiptNumber(tx, ctx.tenantId);
    const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
    const policy = await loadPolicy(tx, ctx.tenantId);
    const receipt = await tx.goodsReceipt.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        reference: input.reference ?? null,
        note: input.note ?? null,
        receivedAt,
        // FX captured at the moment the goods landed (docs/146 Phase 5.7). The
        // supplier bills in the order's currency; the cost ledger is kept in the
        // tenant's. A domestic delivery records both as the same code and a rate
        // of 1, which is true rather than merely convenient — a business that
        // starts importing later gets a continuous history rather than a cliff.
        currency: po.currency,
        baseCurrency: policy.baseCurrency,
        fxRate: input.fxRate ?? '1',
      },
      select: { id: true, number: true },
    });

    for (const charge of input.charges ?? []) {
      await tx.goodsReceiptCharge.create({
        data: {
          tenantId: ctx.tenantId,
          goodsReceiptId: receipt.id,
          kind: charge.kind,
          description: charge.description ?? null,
          amountCents: charge.amountCents,
          allocationBasis: charge.allocationBasis ?? policy.defaultAllocationBasis,
        },
      });
    }

    // ── Three passes, and the order is the point ─────────────────────────────
    //
    // 1. Write the receipt LINES and credit the order, so the delivery exists on
    //    paper before anything is costed. Crediting first also means the
    //    allocator can tell whether this delivery closes the order, which is
    //    what decides who takes the rounding remainder on the freight.
    // 2. Allocate the charges across those lines, giving every line its landed
    //    unit cost. This has to happen with ALL the lines present: a charge is
    //    spread by each line's share of the delivery, and a delivery you are
    //    still halfway through writing has no shares to speak of.
    // 3. Only then move the stock — at the LANDED cost, so the moving average
    //    and the cost layer both carry what the goods really cost rather than
    //    what the supplier's invoice said before the freight was added.
    const drafts: LineDraft[] = [];
    for (const lineInput of input.lines) {
      const poLine = byId.get(lineInput.purchaseOrderLineId)!;
      drafts.push(
        await writeReceiptLine(tx, ctx, {
          receiptId: receipt.id,
          warehouseId: po.warehouseId,
          poLine,
          input: lineInput,
        })
      );
    }

    await reallocateOrderCharges(tx, ctx, po.id);

    const landed = await tx.goodsReceiptLine.findMany({
      where: { goodsReceiptId: receipt.id },
      select: { id: true, landedUnitCostCents: true },
    });
    const landedById = new Map(landed.map((l) => [l.id, l.landedUnitCostCents]));

    const events: ReceiptEvent[] = [];
    for (const draft of drafts) {
      events.push(
        ...(await applyReceiptLine(tx, ctx, {
          receiptId: receipt.id,
          warehouseId: po.warehouseId,
          receivedAt,
          draft,
          // Falls back to the invoice cost when the allocation could not run —
          // a receipt with no charges lands exactly where it always did.
          landedUnitCostCents: landedById.get(draft.lineId) ?? draft.unitCostCents,
        }))
      );
    }

    // ── Pass 4: hand the arrival to whoever has been waiting for it ─────────
    //
    // Deliberately AFTER the stock has moved and after the PO is credited, and
    // deliberately inside the same transaction: two deliveries of the same item
    // landing at once must not both promise the same units to the same customer.
    // The queue is locked, so the second one waits and sees the first one's work.
    //
    // Only the GOOD units are offered. Damaged units arrived and were written off
    // in the same breath — promising a customer a unit that is already on the
    // damaged shelf is worse than saying nothing.
    const filled: BackorderFilled[] = [];
    for (const draft of drafts) {
      if (draft.good <= 0) continue;
      const allocation = await allocateBackordersOnTx(tx, ctx, {
        variantId: draft.poLine.variantId,
        warehouseId: po.warehouseId,
        unitsArrived: draft.good,
        sourceType: 'goods_receipt',
        sourceId: receipt.id,
      });
      filled.push(...allocation.filled);
    }

    await advancePurchaseOrderStatus(tx, po.id, po.status);

    // Settle the supplier's advance notice, if the receiver booked against one
    // (docs/146 Phase 8.6). Deliberately AFTER the stock has moved and
    // deliberately without comparing quantities: the discrepancy between what
    // they said and what arrived is now recorded on both documents and is
    // reported, never used to refuse a delivery that is physically on the floor.
    if (input.advanceShipNoticeId) {
      await consumeAdvanceShipNoticeOnTx(tx, {
        advanceShipNoticeId: input.advanceShipNoticeId,
        goodsReceiptId: receipt.id,
        receivedAt,
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.goods_receipt.created',
      entityType: 'GoodsReceipt',
      entityId: receipt.id,
      diff: {
        after: { number: receipt.number, purchaseOrderId: po.id, lineCount: input.lines.length },
      },
    });

    return { receiptId: receipt.id, events, filled };
  });
}

interface PoLineLite {
  id: string;
  variantId: string;
  unitCostCents: number;
  /** What the order was placed in (docs/146 Phase 6.2) — the default unit for a
   *  delivery against it, because a case order arrives in cases. */
  uomCode: string | null;
  unitsPerUom: number;
}

/** A receipt line written but not yet costed or moved — the output of pass 1. */
interface LineDraft {
  lineId: string;
  poLine: PoLineLite;
  /** What the supplier billed, in the delivery's currency. */
  unitCostCents: number;
  good: number;
  damaged: number;
  lotNumber: string | null;
  binId: string | null;
}

/**
 * Pass 1 — write the receipt line and credit the order.
 *
 * No stock moves here and nothing is costed: the landed cost cannot be known
 * until every line on the delivery exists, because a charge is spread by each
 * line's share of the whole. What this pass DOES settle is which shelf the units
 * went on and how much the order has now had, both of which the costing pass
 * needs.
 */
async function writeReceiptLine(
  tx: TxClient,
  ctx: ServiceContext,
  params: {
    receiptId: string;
    warehouseId: string;
    poLine: PoLineLite;
    input: {
      purchaseOrderLineId: string;
      quantity: number;
      quantityDamaged?: number;
      unitCostCents?: number;
      lotNumber?: string;
      /** Which shelf the good units went on (docs/146 Phase 2). Optional even on
       *  a bin-enabled location — the put-away suggester resolves it when the
       *  receiver is booking from a desk with the pallet still on the dock. */
      binId?: string;
      /** Count the delivery in cartons rather than units (docs/146 Phase 6.2). */
      uomCode?: string;
    };
  }
): Promise<LineDraft> {
  const { receiptId, warehouseId, poLine, input } = params;

  // The unit this delivery was COUNTED in. An explicit code wins; otherwise the
  // order's own unit, because a delivery against a case order arrives in cases
  // and making the receiver re-state that is how a 12× error gets typed.
  // Everything below this line is in BASE units.
  const uom =
    input.uomCode !== undefined
      ? await resolveLineUom(tx, { variantId: poLine.variantId, uomCode: input.uomCode })
      : { uomCode: poLine.uomCode, unitsPerUom: poLine.unitsPerUom };

  const unitCostCents =
    input.unitCostCents !== undefined
      ? toBaseUnitCost(input.unitCostCents, uom.unitsPerUom)
      : poLine.unitCostCents;
  const good = toBaseUnits(input.quantity, uom.unitsPerUom);
  const damaged = toBaseUnits(input.quantityDamaged ?? 0, uom.unitsPerUom);

  // A line must record SOME arrival. The schema already rejects a good=0 &&
  // damaged=0 line; this is the defensive backstop so a bad caller can never
  // write an empty receipt line or a zero-delta movement.
  if (good <= 0 && damaged <= 0) {
    throw new InventoryValidationError(
      'A receipt line must record at least one unit received or damaged',
      [{ field: 'lines', message: `line ${poLine.id} records no units` }]
    );
  }

  // A lot traces SELLABLE stock, so it only belongs on a line with good units.
  // On a fully-damaged (zero-good) line there is nothing to trace, so any lot
  // code is dropped rather than minting an empty batch.
  const lotNumber = good > 0 ? (input.lotNumber ?? null) : null;

  // The receipt line records the GOOD units only — `quantityReceived` is what
  // became sellable stock (0 on a total-loss line). Damaged units are ledger-only
  // (no receipt-line column). The row always exists so the receipt shows the line
  // and the damaged movements below have a stable id to key their idempotency on.
  // Which shelf the GOOD units go on (docs/146 Phase 2). Resolved HERE rather
  // than left to the ledger's mirror so the receipt line RECORDS it — "we put it
  // on A-01" is a fact about this delivery that someone will want back in six
  // months, and a mirror that decided it silently leaves no trace. Null on a
  // location that does not use bins.
  const binId = await resolvePutAwayBin(tx, ctx, {
    warehouseId,
    variantId: poLine.variantId,
    requested: input.binId ?? null,
    quantity: good,
  });

  const line = await tx.goodsReceiptLine.create({
    data: {
      tenantId: ctx.tenantId,
      goodsReceiptId: receiptId,
      purchaseOrderLineId: poLine.id,
      variantId: poLine.variantId,
      quantityReceived: good,
      unitCostCents,
      lotNumber,
      binId,
      uomCode: uom.uomCode,
      unitsPerUom: uom.unitsPerUom,
    },
    select: { id: true },
  });

  // Only GOOD units are credited against the PO line — damaged units leave the
  // supplier owing the shortfall, so the PO stays open for them.
  if (good > 0) {
    await tx.purchaseOrderLine.update({
      where: { id: poLine.id },
      data: { quantityReceived: { increment: good } },
    });
  }

  return { lineId: line.id, poLine, unitCostCents, good, damaged, lotNumber, binId };
}

/** Pass 3 — move the stock, at the LANDED cost.
 *
 *  For any GOOD units, a ledger `receive` movement (which sets the moving
 *  average and opens a cost layer) and an optional lot; for any damaged-on-
 *  arrival units, the receive/damage write-off pair. A total-loss line
 *  (good = 0, damaged > 0) writes only the damaged pair, so nothing joins
 *  sellable stock. Returns the post-commit event(s): one for the good arrival
 *  (when good > 0), and (when damaged > 0) two more for the damaged pair. */
async function applyReceiptLine(
  tx: TxClient,
  ctx: ServiceContext,
  params: {
    receiptId: string;
    warehouseId: string;
    receivedAt: Date;
    draft: LineDraft;
    /** Goods + this line's share of the freight, in the tenant's base currency. */
    landedUnitCostCents: number;
  }
): Promise<ReceiptEvent[]> {
  const { receiptId, warehouseId, draft, landedUnitCostCents } = params;
  const { poLine, good, damaged, lotNumber, binId } = draft;
  const actorType = resolveActorType(ctx);

  const events: ReceiptEvent[] = [];

  // GOOD units — only when some arrived. A total-loss line writes NO good
  // `receive` movement (so the moving-average is untouched — nothing costed came
  // in as sellable) and attaches no lot.
  if (good > 0) {
    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: poLine.variantId,
      warehouseId,
      delta: good,
      reason: 'receive',
      referenceType: 'GoodsReceipt',
      referenceId: receiptId,
      // The LANDED cost, not the invoice cost: what the units are worth on the
      // shelf includes what it cost to get them there (docs/146 Phase 5.2).
      unitCostCents: landedUnitCostCents,
      goodsUnitCostCents: draft.unitCostCents,
      actorType,
      actorId: ctx.userId ?? null,
      idempotencyKey: `goods-receipt:${draft.lineId}`,
      binId,
      // The cost layer points at the receipt LINE, so a freight invoice that
      // turns up a fortnight later can find the exact layer to revalue.
      layerSource: 'receipt',
      layerSourceId: draft.lineId,
      // FIFO orders by when the goods ARRIVED, which a back-dated receipt makes
      // different from when someone typed it in.
      acquiredAt: params.receivedAt,
    });
    if (result.movementId) {
      await tx.goodsReceiptLine.update({
        where: { id: draft.lineId },
        data: { movementId: result.movementId },
      });
    }

    if (lotNumber) {
      await upsertLot(tx, ctx.tenantId, poLine.variantId, warehouseId, lotNumber, good);
    }

    events.push({
      variantId: poLine.variantId,
      warehouseId,
      result,
      delta: good,
      reason: 'receive',
    });
  }

  // Damaged-on-arrival: two ledger facts in the same transaction. First the units
  // truthfully arrive (`receive` + at the same landed cost, so the moving-average
  // basis is recorded), then they are immediately written off (`damage` −). Net
  // on-hand change is 0; the valued loss (qty × landed cost) lives on the damage
  // row. Neither movement touches the PO line's received count or a lot.
  if (damaged > 0) {
    // Both halves go to the DAMAGED shelf, never the pick face (docs/146 Phase 2).
    // Net on-hand is zero either way, but the shelf matters: broken units that
    // arrive and are written off in the same breath are still physically sitting
    // somewhere until someone bins them, and recording them on the pick shelf
    // would send a picker to a box of scrap. Null on a non-bin location.
    const damagedBinId = await systemBinFor(tx, warehouseId, 'damaged');

    const damagedIn = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: poLine.variantId,
      warehouseId,
      delta: damaged,
      reason: 'receive',
      referenceType: 'GoodsReceipt',
      referenceId: receiptId,
      unitCostCents: landedUnitCostCents,
      goodsUnitCostCents: draft.unitCostCents,
      actorType,
      actorId: ctx.userId ?? null,
      idempotencyKey: `goods-receipt:${draft.lineId}:damaged-in`,
      binId: damagedBinId,
      layerSource: 'receipt',
      layerSourceId: draft.lineId,
      acquiredAt: params.receivedAt,
    });
    const writeOff = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: poLine.variantId,
      warehouseId,
      delta: -damaged,
      reason: 'damage',
      referenceType: 'GoodsReceipt',
      referenceId: receiptId,
      unitCostCents: landedUnitCostCents,
      actorType,
      actorId: ctx.userId ?? null,
      idempotencyKey: `goods-receipt:${draft.lineId}:damaged-writeoff`,
      binId: damagedBinId,
    });
    events.push(
      {
        variantId: poLine.variantId,
        warehouseId,
        result: damagedIn,
        delta: damaged,
        reason: 'receive',
      },
      {
        variantId: poLine.variantId,
        warehouseId,
        result: writeOff,
        delta: -damaged,
        reason: 'damage',
      }
    );
  }

  return events;
}

/** Mint a new lot or add to an existing one (lots accumulate across receipts). */
async function upsertLot(
  tx: TxClient,
  tenantId: string,
  variantId: string,
  warehouseId: string,
  lotNumber: string,
  quantity: number
): Promise<void> {
  const existing = await tx.lotBatch.findFirst({
    where: { variantId, lotNumber },
    select: { id: true, quantity: true },
  });
  if (existing) {
    await tx.lotBatch.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    await tx.lotBatch.create({
      data: { tenantId, variantId, warehouseId, lotNumber, quantity, hazmatClass: 'none' },
    });
  }
}

/** Advance the PO: `received` when every line is fully received, else `partial`. */
async function advancePurchaseOrderStatus(
  tx: TxClient,
  purchaseOrderId: string,
  currentStatus: string
): Promise<void> {
  const lines = await tx.purchaseOrderLine.findMany({
    where: { purchaseOrderId },
    select: { quantityOrdered: true, quantityReceived: true },
  });
  const allReceived =
    lines.length > 0 && lines.every((l) => l.quantityReceived >= l.quantityOrdered);
  const anyReceived = lines.some((l) => l.quantityReceived > 0);
  const status = allReceived ? 'received' : anyReceived ? 'partial' : currentStatus;
  await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status, ...(allReceived ? { receivedAt: new Date() } : {}) },
  });
}

async function nextGoodsReceiptNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.goodsReceipt.count({ where: { tenantId } });
  return `GR-${(count + 1).toString().padStart(6, '0')}`;
}

async function loadDetail(tx: TxClient, id: string): Promise<GoodsReceiptDetail> {
  const receipt = await tx.goodsReceipt.findFirst({ where: { id }, include: DETAIL_INCLUDE });
  if (!receipt) throw new InventoryNotFoundError('GoodsReceipt', id);
  return serializeDetail(receipt);
}

function assertNoDuplicateLines(ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new InventoryValidationError(
        'A purchase-order line appears more than once — combine the quantities into one receipt line',
        [{ field: 'lines', message: `duplicate line ${id}` }]
      );
    }
    seen.add(id);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// ─── Serializers ───────────────────────────────────────────────────────────────

function serializeRow(r: ReceiptWithQty): GoodsReceiptRow {
  return {
    id: r.id,
    number: r.number,
    purchaseOrderId: r.purchaseOrderId,
    purchaseOrderNumber: r.purchaseOrder?.number ?? null,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouse?.name ?? null,
    warehouseCode: r.warehouse?.code ?? null,
    reference: r.reference,
    note: r.note,
    receivedAt: r.receivedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    lineCount: r.lines.length,
    quantityReceived: r.lines.reduce((s, l) => s + l.quantityReceived, 0),
    currency: r.currency,
    baseCurrency: r.baseCurrency,
    fxRate: Number(r.fxRate),
  };
}

function serializeDetail(r: ReceiptWithLines): GoodsReceiptDetail {
  const base = serializeRow(r);
  const lines = r.lines.map((l) => ({
    id: l.id,
    purchaseOrderLineId: l.purchaseOrderLineId,
    variantId: l.variantId,
    variantSku: l.variant?.sku ?? null,
    productTitle: l.variant?.product?.title ?? null,
    quantityReceived: l.quantityReceived,
    unitCostCents: l.unitCostCents,
    lotNumber: l.lotNumber,
    movementId: l.movementId,
    baseUnitCostCents: l.baseUnitCostCents,
    allocatedChargeCents: l.allocatedChargeCents,
    landedUnitCostCents: l.landedUnitCostCents,
    uomCode: l.uomCode,
    unitsPerUom: l.unitsPerUom,
  }));

  // Summed from what was WRITTEN on the lines rather than re-derived from the
  // charges, so the three totals on screen always add up to each other — a
  // breakdown whose subtotal disagrees with its lines is worse than no breakdown.
  const goodsValueCents = lines.reduce(
    (s, l) => s + (l.baseUnitCostCents ?? l.unitCostCents) * l.quantityReceived,
    0
  );
  const chargeTotalCents = lines.reduce((s, l) => s + l.allocatedChargeCents, 0);

  return {
    ...base,
    lines,
    charges: r.charges.map((c) => ({
      id: c.id,
      kind: c.kind,
      description: c.description,
      amountCents: c.amountCents,
      allocationBasis: c.allocationBasis,
    })),
    goodsValueCents,
    chargeTotalCents,
    landedTotalCents: goodsValueCents + chargeTotalCents,
  };
}
