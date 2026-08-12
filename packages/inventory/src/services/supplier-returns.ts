// Returns to supplier / RTV (docs/146 Phase 8.7) — stock going back the way it
// came, with money expected in return.
//
// The reason this needs a record rather than an adjustment is the MONEY. An
// operator who writes off six broken pumps has told the ledger the truth about
// the shelf and nothing at all about the £900 the supplier owes. That credit is
// then remembered by one person, in their head, until they leave — and it is not
// a small number in aggregate: damaged and wrong-item deliveries are a routine
// share of everything a distributor ships.
//
// ── Two facts, recorded separately ───────────────────────────────────────────
//
// The expectation is written when the goods leave. The resolution is a later,
// independent act. `creditReceivedCents` is NULLABLE and stays null until
// somebody records a credit note, because zero would mean "they refused", which
// is a completely different conversation from "we are still waiting". A return
// that will never be credited is CLOSED by a person deciding so, not by a
// default.
//
// ── When stock actually moves ────────────────────────────────────────────────
//
// On SEND, not on create. A draft return is a list being assembled — the pallet
// is still in the building — and taking the units off the shelf while somebody
// is still deciding what to put on it would make the stock figure wrong in the
// most confusing possible way. `sent` writes one `return_to_supplier` movement
// per line, out of the location, at what the units cost.

import {
  CreateSupplierReturnInput,
  RecordSupplierCreditInput,
  UpdateSupplierReturnInput,
  type SupplierReturnLineInput,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
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
import { resolveLineUom, toBaseUnitCost, toBaseUnits } from './units-of-measure';

const RTV_PREFIX = 'RTV-';
const RTV_PAD = 6;

export interface SupplierReturnLineRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantity: number;
  unitCostCents: number;
  lineTotalCents: number;
  uomCode: string | null;
  unitsPerUom: number;
  lotNumber: string | null;
  note: string | null;
  movementId: string | null;
}

export interface SupplierReturnRow {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  status: string;
  reason: string;
  creditExpectedCents: number;
  /** Null until somebody records a credit note. NOT zero. */
  creditReceivedCents: number | null;
  /** Expected minus received, once a credit has been recorded. Null while none
   *  has, because "we are owed £900" and "they short-credited us by £900" are
   *  different claims and only one of them is true before they reply. */
  creditShortfallCents: number | null;
  currency: string;
  rmaNumber: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  sentAt: string | null;
  resolvedAt: string | null;
  /** Days since the goods left with no credit recorded. This is the number that
   *  turns a filing cabinet into a chase list. Null before it is sent, and null
   *  once it is resolved. */
  awaitingCreditDays: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierReturnDetail extends SupplierReturnRow {
  lines: SupplierReturnLineRow[];
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListSupplierReturnsFilter {
  supplierId?: string;
  warehouseId?: string;
  status?: 'draft' | 'sent' | 'credited' | 'closed' | 'cancelled';
  /** Sent, with no credit recorded. The chase list. */
  awaitingCreditOnly?: boolean;
  take?: number;
  skip?: number;
}

export interface SupplierReturnsReport {
  items: SupplierReturnRow[];
  total: number;
  /** What is out there unresolved, in money. The headline a finance-minded owner
   *  actually wants: "you are owed £4,310 by suppliers right now." */
  awaitingCreditCents: number;
  awaitingCreditCount: number;
}

export async function listSupplierReturns(
  ctx: ServiceContext,
  filter: ListSupplierReturnsFilter = {}
): Promise<SupplierReturnsReport> {
  const take = Math.min(filter.take ?? 50, 250);
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.awaitingCreditOnly ? { status: 'sent', creditReceivedCents: null } : {}),
    };
    const awaitingWhere = {
      tenantId: ctx.tenantId,
      status: 'sent',
      creditReceivedCents: null,
    };
    const [rows, total, awaiting] = await Promise.all([
      tx.supplierReturn.findMany({
        where,
        // Biggest unresolved credit first: this list is worked by value.
        orderBy: [{ creditExpectedCents: 'desc' }, { createdAt: 'desc' }],
        take,
        skip: filter.skip ?? 0,
        include: HEADER_INCLUDE,
      }),
      tx.supplierReturn.count({ where }),
      tx.supplierReturn.aggregate({
        where: awaitingWhere,
        _sum: { creditExpectedCents: true },
        _count: true,
      }),
    ]);
    return {
      items: rows.map(serializeRow),
      total,
      awaitingCreditCents: awaiting._sum.creditExpectedCents ?? 0,
      awaitingCreditCount: awaiting._count,
    };
  });
}

export async function getSupplierReturn(
  ctx: ServiceContext,
  id: string
): Promise<SupplierReturnDetail> {
  return withTenant(ctx, (tx) => loadDetail(tx, id));
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function createSupplierReturn(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<SupplierReturnDetail> {
  const input = CreateSupplierReturnInput.parse(rawInput);

  const id = await withTenant(ctx, async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: input.supplierId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) throw new InventoryNotFoundError('Supplier', input.supplierId);
    const warehouse = await tx.warehouse.findFirst({
      where: { id: input.warehouseId, deletedAt: null },
      select: { id: true },
    });
    if (!warehouse) throw new InventoryNotFoundError('Warehouse', input.warehouseId);
    if (input.purchaseOrderId) {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: input.purchaseOrderId },
        select: { id: true },
      });
      if (!po) throw new InventoryNotFoundError('PurchaseOrder', input.purchaseOrderId);
    }

    const lines = await resolveLines(tx, {
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      warehouseId: input.warehouseId,
      inputs: input.lines,
    });

    const row = await tx.supplierReturn.create({
      data: {
        tenantId: ctx.tenantId,
        number: await nextReturnNumber(tx, ctx.tenantId),
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        status: 'draft',
        reason: input.reason,
        creditExpectedCents: lines.reduce((sum, l) => sum + l.quantity * l.unitCostCents, 0),
        currency: input.currency,
        rmaNumber: input.rmaNumber ?? null,
        carrier: input.carrier ?? null,
        trackingNumber: input.trackingNumber ?? null,
        notes: input.notes ?? null,
        lines: {
          create: lines.map((line) => ({
            tenantId: ctx.tenantId,
            variantId: line.variantId,
            quantity: line.quantity,
            unitCostCents: line.unitCostCents,
            uomCode: line.uomCode,
            unitsPerUom: line.unitsPerUom,
            lotNumber: line.lotNumber,
            note: line.note,
          })),
        },
      },
      select: { id: true, number: true },
    });

    await audit(tx, ctx, row.id, 'created', { number: row.number, lines: lines.length });
    return row.id;
  });

  return getSupplierReturn(ctx, id);
}

/** Header edits, draft only. Once the pallet has gone, what was on it is a fact. */
export async function updateSupplierReturn(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<SupplierReturnDetail> {
  const input = UpdateSupplierReturnInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await loadHeader(tx, id);
    // The carrier, tracking number, RMA and notes stay editable after sending,
    // deliberately: a tracking number usually arrives AFTER the pallet is
    // collected, and forcing the return back to draft to record it would have to
    // unwind the ledger movements. The REASON is the one field that freezes —
    // why the stock went back is a fact about a pallet that has left.
    if (existing.status !== 'draft' && input.reason !== undefined) {
      throw new InventoryConflictError(
        `Return ${existing.number} has been sent; the reason it went back cannot be rewritten`,
        'status'
      );
    }

    await tx.supplierReturn.update({
      where: { id },
      data: {
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        ...(input.rmaNumber !== undefined ? { rmaNumber: input.rmaNumber } : {}),
        ...(input.carrier !== undefined ? { carrier: input.carrier } : {}),
        ...(input.trackingNumber !== undefined ? { trackingNumber: input.trackingNumber } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    return loadDetail(tx, id);
  });
}

/**
 * The pallet has gone. Take the stock off the shelf.
 *
 * One `return_to_supplier` movement per line, out of the return's location, at
 * what the units cost. Idempotency keys are per line, so a retried request
 * cannot double-deduct.
 */
export async function sendSupplierReturn(
  ctx: ServiceContext,
  id: string
): Promise<SupplierReturnDetail> {
  const events = await withTenant(ctx, async (tx) => {
    const ret = await tx.supplierReturn.findFirst({
      where: { id },
      include: {
        lines: { select: { id: true, variantId: true, quantity: true, unitCostCents: true } },
      },
    });
    if (!ret) throw new InventoryNotFoundError('SupplierReturn', id);
    if (ret.status !== 'draft') {
      throw new InventoryConflictError(
        `Return ${ret.number} has already been ${ret.status}`,
        'status'
      );
    }
    if (ret.lines.length === 0) {
      throw new InventoryValidationError('Cannot send a return with nothing on it');
    }

    const now = new Date();
    const actorType = resolveActorType(ctx);
    const results: { variantId: string; result: MovementResult; delta: number }[] = [];

    for (const line of ret.lines) {
      const result = await applyMovement(tx, {
        tenantId: ctx.tenantId,
        variantId: line.variantId,
        warehouseId: ret.warehouseId,
        delta: -line.quantity,
        reason: 'return_to_supplier',
        referenceType: 'SupplierReturn',
        referenceId: ret.id,
        unitCostCents: line.unitCostCents,
        actorType,
        actorId: ctx.userId ?? null,
        idempotencyKey: `supplier-return:${line.id}`,
      });
      if (result.movementId) {
        await tx.supplierReturnLine.update({
          where: { id: line.id },
          data: { movementId: result.movementId },
        });
      }
      results.push({ variantId: line.variantId, result, delta: -line.quantity });
    }

    await tx.supplierReturn.update({ where: { id }, data: { status: 'sent', sentAt: now } });
    await audit(tx, ctx, id, 'sent', { number: ret.number, lines: ret.lines.length });

    return results.map((r) => ({
      tenantId: ctx.tenantId,
      variantId: r.variantId,
      warehouseId: ret.warehouseId,
      result: r.result,
      delta: r.delta,
      reason: 'return_to_supplier',
    }));
  });

  // After the commit, never inside it — a rolled-back write must not emit a
  // phantom event.
  for (const event of events) {
    await emitStockEvents(
      ctx,
      event.variantId,
      event.warehouseId,
      event.result,
      event.delta,
      event.reason
    );
  }

  return getSupplierReturn(ctx, id);
}

/**
 * Record what the supplier actually credited.
 *
 * A separate act from editing the paperwork, because it means something
 * different: this closes a debt. Recording LESS than expected leaves the
 * shortfall visible rather than quietly accepting it — a short credit is the
 * most common way money is lost on returns, and it is invisible unless the
 * expectation was written down first.
 */
export async function recordSupplierCredit(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<SupplierReturnDetail> {
  const input = RecordSupplierCreditInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const ret = await loadHeader(tx, id);
    if (ret.status !== 'sent' && ret.status !== 'credited') {
      throw new InventoryConflictError(
        `Return ${ret.number} is ${ret.status}, so there is nothing to credit`,
        'status'
      );
    }

    await tx.supplierReturn.update({
      where: { id },
      data: {
        status: 'credited',
        creditReceivedCents: input.creditReceivedCents,
        resolvedAt: input.resolvedAt ? new Date(input.resolvedAt) : new Date(),
        ...(input.note ? { notes: input.note } : {}),
      },
    });
    await audit(tx, ctx, id, 'credited', {
      number: ret.number,
      creditReceivedCents: input.creditReceivedCents,
      creditExpectedCents: ret.creditExpectedCents,
    });
    return loadDetail(tx, id);
  });
}

/**
 * Give up on the credit.
 *
 * A real, deliberate act with a required reason. Without it, a return nobody
 * will ever be paid for sits on the chase list forever and the list stops being
 * read — and the alternative (silently writing it off) hides a loss that
 * somebody should see once.
 */
export async function closeSupplierReturn(
  ctx: ServiceContext,
  id: string,
  note: string
): Promise<SupplierReturnDetail> {
  const reason = note.trim();
  if (reason.length === 0) {
    throw new InventoryValidationError('Say why this return is being written off', [
      { field: 'note', message: 'A reason is required to close a return with no credit' },
    ]);
  }

  return withTenant(ctx, async (tx) => {
    const ret = await loadHeader(tx, id);
    if (ret.status !== 'sent') {
      throw new InventoryConflictError(
        `Return ${ret.number} is ${ret.status}, not awaiting a credit`,
        'status'
      );
    }
    await tx.supplierReturn.update({
      where: { id },
      data: { status: 'closed', resolvedAt: new Date(), notes: reason },
    });
    await audit(tx, ctx, id, 'closed', {
      number: ret.number,
      writtenOffCents: ret.creditExpectedCents,
      note: reason,
    });
    return loadDetail(tx, id);
  });
}

/** Abandon a draft. Only a draft: once the stock has left, the record is a fact
 *  about where it went and deleting it would leave the ledger unexplained. */
export async function cancelSupplierReturn(
  ctx: ServiceContext,
  id: string
): Promise<SupplierReturnDetail> {
  return withTenant(ctx, async (tx) => {
    const ret = await loadHeader(tx, id);
    if (ret.status !== 'draft') {
      throw new InventoryConflictError(
        `Return ${ret.number} has already been sent and cannot be cancelled`,
        'status'
      );
    }
    await tx.supplierReturn.update({ where: { id }, data: { status: 'cancelled' } });
    return loadDetail(tx, id);
  });
}

// ─── plumbing ────────────────────────────────────────────────────────────────

const HEADER_INCLUDE = {
  supplier: { select: { name: true } },
  warehouse: { select: { name: true } },
  purchaseOrder: { select: { number: true } },
} as const;

interface ResolvedReturnLine {
  variantId: string;
  quantity: number;
  unitCostCents: number;
  uomCode: string | null;
  unitsPerUom: number;
  lotNumber: string | null;
  note: string | null;
}

/**
 * Resolve each line's units and cost basis.
 *
 * The cost fallback chain matters: the linked order line (what this supplier
 * actually charged for these units) → the supplier's own link price → the
 * moving average on the shelf. Never 0 — a zero credit expectation writes the
 * money off silently, which is the exact failure this whole feature exists to
 * stop, so a line with no cost anywhere is refused and the operator is asked.
 */
async function resolveLines(
  tx: TxClient,
  params: {
    supplierId: string;
    purchaseOrderId: string | null;
    warehouseId: string;
    inputs: SupplierReturnLineInput[];
  }
): Promise<ResolvedReturnLine[]> {
  const resolved: ResolvedReturnLine[] = [];

  for (const input of params.inputs) {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, deletedAt: null },
      select: { id: true, costCents: true },
    });
    if (!variant) throw new InventoryNotFoundError('ProductVariant', input.variantId);

    const uom =
      input.uomCode !== undefined
        ? await resolveLineUom(tx, { variantId: input.variantId, uomCode: input.uomCode })
        : await resolveLineUom(tx, { variantId: input.variantId, purpose: 'purchase' });

    const quantity = toBaseUnits(input.quantity, uom.unitsPerUom);

    let unitCostCents: number | null =
      input.unitCostCents !== undefined
        ? toBaseUnitCost(input.unitCostCents, uom.unitsPerUom)
        : null;

    if (unitCostCents === null && params.purchaseOrderId) {
      const poLine = await tx.purchaseOrderLine.findFirst({
        where: { purchaseOrderId: params.purchaseOrderId, variantId: input.variantId },
        select: { unitCostCents: true },
      });
      unitCostCents = poLine?.unitCostCents ?? null;
    }
    if (unitCostCents === null) {
      const link = await tx.supplierVariant.findUnique({
        where: {
          supplierId_variantId: { supplierId: params.supplierId, variantId: input.variantId },
        },
        select: { unitCostCents: true },
      });
      unitCostCents = link?.unitCostCents ?? null;
    }
    if (unitCostCents === null) {
      const level = await tx.inventoryLevel.findFirst({
        where: { variantId: input.variantId, warehouseId: params.warehouseId },
        select: { avgCostCents: true },
      });
      unitCostCents = level?.avgCostCents ?? variant.costCents ?? null;
    }
    if (unitCostCents === null) {
      throw new InventoryValidationError(
        'Nothing on record says what this item cost, so the credit to expect cannot be worked out',
        [
          {
            field: 'lines',
            message: `enter a unit cost for ${input.variantId} — recording a return worth £0 would write the money off`,
          },
        ]
      );
    }

    resolved.push({
      variantId: input.variantId,
      quantity,
      unitCostCents,
      uomCode: uom.uomCode,
      unitsPerUom: uom.unitsPerUom,
      lotNumber: input.lotNumber ?? null,
      note: input.note ?? null,
    });
  }

  return resolved;
}

async function nextReturnNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.supplierReturn.count({ where: { tenantId } });
  return `${RTV_PREFIX}${(count + 1).toString().padStart(RTV_PAD, '0')}`;
}

interface HeaderLite {
  id: string;
  number: string;
  status: string;
  creditExpectedCents: number;
}

async function loadHeader(tx: TxClient, id: string): Promise<HeaderLite> {
  const row = await tx.supplierReturn.findFirst({
    where: { id },
    select: { id: true, number: true, status: true, creditExpectedCents: true },
  });
  if (!row) throw new InventoryNotFoundError('SupplierReturn', id);
  return row;
}

async function loadDetail(tx: TxClient, id: string): Promise<SupplierReturnDetail> {
  const row = await tx.supplierReturn.findFirst({
    where: { id },
    include: {
      ...HEADER_INCLUDE,
      lines: {
        include: { variant: { select: { sku: true, product: { select: { title: true } } } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!row) throw new InventoryNotFoundError('SupplierReturn', id);

  return {
    ...serializeRow(row),
    lines: row.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      variantSku: line.variant?.sku ?? null,
      productTitle: line.variant?.product?.title ?? null,
      quantity: line.quantity,
      unitCostCents: line.unitCostCents,
      lineTotalCents: line.quantity * line.unitCostCents,
      uomCode: line.uomCode,
      unitsPerUom: line.unitsPerUom,
      lotNumber: line.lotNumber,
      note: line.note,
      movementId: line.movementId,
    })),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface ReturnRecord {
  id: string;
  number: string;
  supplierId: string;
  warehouseId: string;
  purchaseOrderId: string | null;
  status: string;
  reason: string;
  creditExpectedCents: number;
  creditReceivedCents: number | null;
  currency: string;
  rmaNumber: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  sentAt: Date | null;
  resolvedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier?: { name: string | null } | null;
  warehouse?: { name: string | null } | null;
  purchaseOrder?: { number: string } | null;
}

function serializeRow(row: ReturnRecord): SupplierReturnRow {
  return {
    id: row.id,
    number: row.number,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse?.name ?? null,
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderNumber: row.purchaseOrder?.number ?? null,
    status: row.status,
    reason: row.reason,
    creditExpectedCents: row.creditExpectedCents,
    creditReceivedCents: row.creditReceivedCents,
    creditShortfallCents:
      row.creditReceivedCents === null ? null : row.creditExpectedCents - row.creditReceivedCents,
    currency: row.currency,
    rmaNumber: row.rmaNumber,
    carrier: row.carrier,
    trackingNumber: row.trackingNumber,
    sentAt: row.sentAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    awaitingCreditDays:
      row.status === 'sent' && row.sentAt !== null
        ? Math.floor((Date.now() - row.sentAt.getTime()) / DAY_MS)
        : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function audit(
  tx: Parameters<typeof writeAuditLog>[0]['tx'],
  ctx: ServiceContext,
  entityId: string,
  action: string,
  diff: Record<string, unknown>
): Promise<void> {
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: `inventory.supplier_return.${action}`,
    entityType: 'SupplierReturn',
    entityId,
    diff: { after: diff },
  });
}
