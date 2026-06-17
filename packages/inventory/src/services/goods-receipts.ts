// Receiving — book goods against a submitted PO (docs/100 P3c). A GoodsReceipt is
// posted atomically: each line writes a `receive` movement through the ledger
// (delta +qty, the landed unit cost feeding the moving-average basis), bumps the
// PO line's received count, and optionally mints/extends a LotBatch. The PO then
// advances to `partial` or `received`. There is no editable draft receipt — a
// correction is a later adjustment/count (P4). Standalone-usable.

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
}

export interface GoodsReceiptDetail extends GoodsReceiptRow {
  lines: GoodsReceiptLineRow[];
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
} satisfies Prisma.GoodsReceiptInclude;

type ReceiptWithQty = Prisma.GoodsReceiptGetPayload<{ include: typeof LIST_INCLUDE }>;
type ReceiptWithLines = Prisma.GoodsReceiptGetPayload<{ include: typeof DETAIL_INCLUDE }>;

// ─── Queries ───────────────────────────────────────────────────────────────────

export async function listGoodsReceipts(
  ctx: ServiceContext,
  filter: { purchaseOrderId?: string; take?: number; skip?: number } = {}
): Promise<{ items: GoodsReceiptRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.GoodsReceiptWhereInput = filter.purchaseOrderId
      ? { purchaseOrderId: filter.purchaseOrderId }
      : {};
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
  let created: { receiptId: string; events: ReceiptEvent[] } | undefined;
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

  // Threshold events (inStock / low / depleted) fire post-commit, per movement.
  for (const e of created.events) {
    await emitStockEvents(ctx, e.variantId, e.warehouseId, e.result, e.delta, 'receive');
  }
  return getGoodsReceipt(ctx, created.receiptId);
}

interface ReceiptEvent {
  variantId: string;
  warehouseId: string;
  result: MovementResult;
  delta: number;
}

async function createOnce(
  ctx: ServiceContext,
  input: CreateGoodsReceiptInput
): Promise<{ receiptId: string; events: ReceiptEvent[] }> {
  return withTenant(ctx, async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId },
      select: { id: true, number: true, status: true, warehouseId: true },
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
      select: { id: true, variantId: true, unitCostCents: true },
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
    const receipt = await tx.goodsReceipt.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        reference: input.reference ?? null,
        note: input.note ?? null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
      },
      select: { id: true, number: true },
    });

    const events: ReceiptEvent[] = [];
    for (const lineInput of input.lines) {
      const poLine = byId.get(lineInput.purchaseOrderLineId)!;
      events.push(
        await applyReceiptLine(tx, ctx, {
          receiptId: receipt.id,
          warehouseId: po.warehouseId,
          poLine,
          input: lineInput,
        })
      );
    }

    await advancePurchaseOrderStatus(tx, po.id, po.status);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.goods_receipt.created',
      entityType: 'GoodsReceipt',
      entityId: receipt.id,
      diff: { after: { number: receipt.number, purchaseOrderId: po.id, lineCount: events.length } },
    });

    return { receiptId: receipt.id, events };
  });
}

interface PoLineLite {
  id: string;
  variantId: string;
  unitCostCents: number;
}

/** Post one received line: ledger movement (moving-average), receipt-line row,
 *  PO-line received bump, optional lot. Returns the post-commit event tuple. */
async function applyReceiptLine(
  tx: TxClient,
  ctx: ServiceContext,
  params: {
    receiptId: string;
    warehouseId: string;
    poLine: PoLineLite;
    input: {
      purchaseOrderLineId: string;
      quantity: number;
      unitCostCents?: number;
      lotNumber?: string;
    };
  }
): Promise<ReceiptEvent> {
  const { receiptId, warehouseId, poLine, input } = params;
  const unitCostCents = input.unitCostCents ?? poLine.unitCostCents;

  const line = await tx.goodsReceiptLine.create({
    data: {
      tenantId: ctx.tenantId,
      goodsReceiptId: receiptId,
      purchaseOrderLineId: poLine.id,
      variantId: poLine.variantId,
      quantityReceived: input.quantity,
      unitCostCents,
      lotNumber: input.lotNumber ?? null,
    },
    select: { id: true },
  });

  const result = await applyMovement(tx, {
    tenantId: ctx.tenantId,
    variantId: poLine.variantId,
    warehouseId,
    delta: input.quantity,
    reason: 'receive',
    referenceType: 'GoodsReceipt',
    referenceId: receiptId,
    unitCostCents,
    actorType: resolveActorType(ctx),
    actorId: ctx.userId ?? null,
    idempotencyKey: `goods-receipt:${line.id}`,
  });
  if (result.movementId) {
    await tx.goodsReceiptLine.update({
      where: { id: line.id },
      data: { movementId: result.movementId },
    });
  }

  await tx.purchaseOrderLine.update({
    where: { id: poLine.id },
    data: { quantityReceived: { increment: input.quantity } },
  });

  if (input.lotNumber) {
    await upsertLot(
      tx,
      ctx.tenantId,
      poLine.variantId,
      warehouseId,
      input.lotNumber,
      input.quantity
    );
  }

  return { variantId: poLine.variantId, warehouseId, result, delta: input.quantity };
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
  };
}

function serializeDetail(r: ReceiptWithLines): GoodsReceiptDetail {
  const base = serializeRow(r);
  return {
    ...base,
    lines: r.lines.map((l) => ({
      id: l.id,
      purchaseOrderLineId: l.purchaseOrderLineId,
      variantId: l.variantId,
      variantSku: l.variant?.sku ?? null,
      productTitle: l.variant?.product?.title ?? null,
      quantityReceived: l.quantityReceived,
      unitCostCents: l.unitCostCents,
      lotNumber: l.lotNumber,
      movementId: l.movementId,
    })),
  };
}
