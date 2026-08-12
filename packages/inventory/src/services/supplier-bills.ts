// Supplier bills and the three-way match (docs/146 Phase 8.8).
//
// The last document in the purchasing chain and the one most likely to be wrong.
// A business that checks nothing pays whatever arrives. A business that checks
// by eye catches the £400 errors and never the £12 ones — which are the ones
// that repeat every month and, over a year, cost more.
//
// ── What "three-way" means, precisely ────────────────────────────────────────
//
//   ORDERED    the purchase-order line: the quantity and the price agreed
//   RECEIVED   the goods-receipt lines against it: what actually turned up
//   BILLED     this table: what they are asking to be paid for
//
// The comparison is billed-against-RECEIVED, and that is the whole point. A
// supplier who ships eight of the ten you ordered and invoices for ten has made
// no ordering error; they have billed for goods that are not on your shelf, and
// only the receipt knows. Checking against the order waves it through.
//
// The variance is surfaced BEFORE the bill is approved for payment, because
// after payment it stops being a discrepancy and becomes a refund request.
//
// ── This is not bookkeeping, and it never becomes one ────────────────────────
//
// No ledger, no double entry, no chart of accounts — docs/148 §1 makes that a
// permanent product position rather than a v1 boundary. The bill exists so the
// match can exist. Paying it is either a payment recorded here or a bill handed
// to an accounting package (docs/146 §10.7).
//
// And docs/148's locked decision #2 applies directly: STOCK IS NOT AN EXPENSE.
// A supplier bill for goods must never become an expense-ledger row. The value
// went into inventory on receipt and becomes cost when the goods sell; writing
// it into both counts every part twice.

import {
  AcceptBillVarianceInput,
  CreateSupplierBillInput,
  RecordBillPaymentInput,
  UpdateSupplierBillInput,
  matchBillLine,
  type MatchLineResult,
  type SupplierBillLineInput,
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

import { resolveLineUom, toBaseUnitCost, toBaseUnits } from './units-of-measure';

export interface SupplierBillLineRow {
  id: string;
  purchaseOrderLineId: string | null;
  variantId: string | null;
  variantSku: string | null;
  productTitle: string | null;
  description: string | null;
  quantity: number;
  unitCostCents: number;
  amountCents: number;
  uomCode: string | null;
  unitsPerUom: number;
}

export interface SupplierBillRow {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  status: string;
  currency: string;
  /** As a NUMBER, like every other rate the module serialises. Null on a
   *  same-currency bill — storing 1 there would dress a non-conversion as one. */
  fxRate: number | null;
  billedAt: string;
  dueAt: string | null;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  /** Null until paid — not 0. An unpaid bill and one settled by a zero credit
   *  note are different facts and only one should keep being chased. */
  paidCents: number | null;
  paidAt: string | null;
  varianceAcceptedByUserId: string | null;
  varianceAcceptedByName: string | null;
  varianceAcceptedAt: string | null;
  notes: string | null;
  /** Negative = overdue. Null when nobody set a due date. */
  daysUntilDue: number | null;
  createdAt: string;
  updatedAt: string;
}

/** One line, with its verdict. */
export interface MatchedBillLine extends SupplierBillLineRow {
  orderedQuantity: number | null;
  orderedUnitCostCents: number | null;
  receivedQuantity: number | null;
  match: MatchLineResult;
}

export interface BillMatch {
  /** Null when NOTHING on the bill points at an order line — the match could not
   *  be run at all, which must not read as "it matched". */
  ok: boolean | null;
  linesMatched: number;
  linesFlagged: number;
  /** Sum of the per-line money variances, positive = the bill is higher than the
   *  goods justify. Null when the match could not run. */
  totalVarianceCents: number | null;
  /** Bill lines that point at no order line at all. Counted separately because
   *  they are not a variance to net off, they are things that should not be on
   *  the invoice. */
  unorderedLines: number;
}

export interface SupplierBillDetail extends SupplierBillRow {
  lines: MatchedBillLine[];
  match: BillMatch;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListSupplierBillsFilter {
  supplierId?: string;
  purchaseOrderId?: string;
  status?: string;
  /** Unpaid and past the due date. */
  overdueOnly?: boolean;
  take?: number;
  skip?: number;
}

export interface SupplierBillsReport {
  items: SupplierBillRow[];
  total: number;
  /** What is owed and not yet paid, in the tenant's mixed bill currencies.
   *  Reported alongside the count so a single figure is never read as a
   *  converted total it is not. */
  outstandingCents: number;
  outstandingCount: number;
}

export async function listSupplierBills(
  ctx: ServiceContext,
  filter: ListSupplierBillsFilter = {}
): Promise<SupplierBillsReport> {
  const take = Math.min(filter.take ?? 50, 250);
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.purchaseOrderId ? { purchaseOrderId: filter.purchaseOrderId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.overdueOnly ? { paidAt: null, dueAt: { lt: new Date() } } : {}),
    };
    const outstandingWhere = {
      tenantId: ctx.tenantId,
      paidAt: null,
      status: { notIn: ['cancelled', 'draft'] },
    };
    const [rows, total, outstanding] = await Promise.all([
      tx.supplierBill.findMany({
        where,
        // Soonest due first — this list is a payment run.
        orderBy: [{ dueAt: 'asc' }, { billedAt: 'desc' }],
        take,
        skip: filter.skip ?? 0,
        include: HEADER_INCLUDE,
      }),
      tx.supplierBill.count({ where }),
      tx.supplierBill.aggregate({
        where: outstandingWhere,
        _sum: { totalCents: true },
        _count: true,
      }),
    ]);
    return {
      items: rows.map(serializeRow),
      total,
      outstandingCents: outstanding._sum.totalCents ?? 0,
      outstandingCount: outstanding._count,
    };
  });
}

export async function getSupplierBill(
  ctx: ServiceContext,
  id: string
): Promise<SupplierBillDetail> {
  return withTenant(ctx, (tx) => loadDetail(tx, id));
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function createSupplierBill(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<SupplierBillDetail> {
  const input = CreateSupplierBillInput.parse(rawInput);

  const id = await withTenant(ctx, async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: input.supplierId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) throw new InventoryNotFoundError('Supplier', input.supplierId);

    // Their invoice number is the natural key an accounts department will quote
    // back. A duplicate is nearly always the same bill entered twice, which is
    // how it gets paid twice.
    const clash = await tx.supplierBill.findFirst({
      where: { supplierId: input.supplierId, number: input.number },
      select: { id: true },
    });
    if (clash) {
      throw new InventoryConflictError(
        `Invoice ${input.number} from this supplier has already been entered`,
        'number'
      );
    }

    if (input.purchaseOrderId) {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: input.purchaseOrderId },
        select: { id: true, supplierId: true, number: true },
      });
      if (!po) throw new InventoryNotFoundError('PurchaseOrder', input.purchaseOrderId);
      if (po.supplierId !== input.supplierId) {
        throw new InventoryValidationError(
          'That purchase order was raised with a different supplier',
          [{ field: 'purchaseOrderId', message: `order ${po.number} belongs to another supplier` }]
        );
      }
    }

    const lines = await resolveLines(tx, input.purchaseOrderId ?? null, input.lines);
    const subtotal = lines.reduce((sum, l) => sum + l.amountCents, 0);

    const bill = await tx.supplierBill.create({
      data: {
        tenantId: ctx.tenantId,
        number: input.number,
        supplierId: input.supplierId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        status: 'draft',
        currency: input.currency,
        fxRate: input.fxRate ?? null,
        billedAt: new Date(input.billedAt),
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        subtotalCents: subtotal,
        taxCents: input.taxCents,
        shippingCents: input.shippingCents,
        totalCents: subtotal + input.taxCents + input.shippingCents,
        notes: input.notes ?? null,
        lines: {
          create: lines.map((line) => ({
            tenantId: ctx.tenantId,
            purchaseOrderLineId: line.purchaseOrderLineId,
            variantId: line.variantId,
            description: line.description,
            quantity: line.quantity,
            unitCostCents: line.unitCostCents,
            amountCents: line.amountCents,
            uomCode: line.uomCode,
            unitsPerUom: line.unitsPerUom,
          })),
        },
      },
      select: { id: true, number: true },
    });

    await audit(tx, ctx, bill.id, 'created', { number: bill.number, lines: lines.length });
    return bill.id;
  });

  return getSupplierBill(ctx, id);
}

/** Header edits, before it is approved. Lines are replaced wholesale via
 *  `createSupplierBill` on a fresh entry — a bill is a document somebody else
 *  wrote, and patching its lines one at a time is how it stops matching the
 *  paper. */
export async function updateSupplierBill(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<SupplierBillDetail> {
  const input = UpdateSupplierBillInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const bill = await loadHeader(tx, id);
    if (bill.status === 'paid' || bill.status === 'cancelled') {
      throw new InventoryConflictError(`Bill ${bill.number} is ${bill.status}`, 'status');
    }

    await tx.supplierBill.update({
      where: { id },
      data: {
        ...(input.number !== undefined ? { number: input.number } : {}),
        ...(input.purchaseOrderId !== undefined ? { purchaseOrderId: input.purchaseOrderId } : {}),
        ...(input.billedAt !== undefined ? { billedAt: new Date(input.billedAt) } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
        ...(input.taxCents !== undefined ? { taxCents: input.taxCents } : {}),
        ...(input.shippingCents !== undefined ? { shippingCents: input.shippingCents } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    if (input.taxCents !== undefined || input.shippingCents !== undefined) {
      await recomputeTotals(tx, id);
    }
    return loadDetail(tx, id);
  });
}

/**
 * Approve a bill for payment.
 *
 * REFUSES while the match has flagged something and nobody has accepted it. That
 * refusal is the entire feature: an approval step that can be clicked through
 * without reading is not a control, it is a formality, and the discrepancy the
 * platform went to the trouble of finding gets paid anyway.
 *
 * The escape hatch is `acceptBillVariance`, which requires a written reason and
 * records who wrote it.
 */
export async function approveSupplierBill(
  ctx: ServiceContext,
  id: string
): Promise<SupplierBillDetail> {
  return withTenant(ctx, async (tx) => {
    const detail = await loadDetail(tx, id);
    if (detail.status !== 'draft' && detail.status !== 'awaiting_approval') {
      throw new InventoryConflictError(`Bill ${detail.number} is ${detail.status}`, 'status');
    }
    if (detail.match.ok === false && detail.varianceAcceptedAt === null) {
      throw new InventoryConflictError(
        `Bill ${detail.number} does not agree with what was ordered and received — ` +
          `${detail.match.linesFlagged} line(s) differ. Accept the difference with a reason, or dispute it.`,
        'match'
      );
    }
    await tx.supplierBill.update({ where: { id }, data: { status: 'approved' } });
    await audit(tx, ctx, id, 'approved', {
      number: detail.number,
      totalCents: detail.totalCents,
      varianceCents: detail.match.totalVarianceCents,
    });
    return loadDetail(tx, id);
  });
}

/** Accept a variance the match found, with a reason. The reason is required —
 *  an override that leaves no trace is indistinguishable from a match, and the
 *  next person to look cannot tell whether anyone noticed. */
export async function acceptBillVariance(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<SupplierBillDetail> {
  const input = AcceptBillVarianceInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const bill = await loadHeader(tx, id);
    if (bill.status === 'paid' || bill.status === 'cancelled') {
      throw new InventoryConflictError(`Bill ${bill.number} is ${bill.status}`, 'status');
    }
    await tx.supplierBill.update({
      where: { id },
      data: {
        varianceAcceptedByUserId: ctx.userId ?? null,
        varianceAcceptedAt: new Date(),
        notes: input.note,
      },
    });
    await audit(tx, ctx, id, 'variance_accepted', { number: bill.number, note: input.note });
    return loadDetail(tx, id);
  });
}

/** Hold the bill. A real state rather than a note, because it is the one that
 *  must stop a payment run. */
export async function disputeSupplierBill(
  ctx: ServiceContext,
  id: string,
  note: string
): Promise<SupplierBillDetail> {
  const reason = note.trim();
  if (reason.length === 0) {
    throw new InventoryValidationError('Say what is being disputed', [
      { field: 'note', message: 'A dispute needs a reason the supplier can answer' },
    ]);
  }
  return withTenant(ctx, async (tx) => {
    const bill = await loadHeader(tx, id);
    if (bill.status === 'paid' || bill.status === 'cancelled') {
      throw new InventoryConflictError(`Bill ${bill.number} is ${bill.status}`, 'status');
    }
    await tx.supplierBill.update({ where: { id }, data: { status: 'disputed', notes: reason } });
    await audit(tx, ctx, id, 'disputed', { number: bill.number, note: reason });
    return loadDetail(tx, id);
  });
}

export async function recordBillPayment(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<SupplierBillDetail> {
  const input = RecordBillPaymentInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const bill = await loadHeader(tx, id);
    if (bill.status === 'cancelled') {
      throw new InventoryConflictError(`Bill ${bill.number} was cancelled`, 'status');
    }
    if (bill.status === 'disputed') {
      throw new InventoryConflictError(
        `Bill ${bill.number} is disputed — settle the dispute before paying it`,
        'status'
      );
    }
    await tx.supplierBill.update({
      where: { id },
      data: {
        status: 'paid',
        paidCents: input.paidCents,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        ...(input.note ? { notes: input.note } : {}),
      },
    });
    await audit(tx, ctx, id, 'paid', { number: bill.number, paidCents: input.paidCents });
    return loadDetail(tx, id);
  });
}

export async function cancelSupplierBill(
  ctx: ServiceContext,
  id: string
): Promise<SupplierBillDetail> {
  return withTenant(ctx, async (tx) => {
    const bill = await loadHeader(tx, id);
    if (bill.status === 'paid') {
      throw new InventoryConflictError(
        `Bill ${bill.number} has been paid and cannot be cancelled`,
        'status'
      );
    }
    await tx.supplierBill.update({ where: { id }, data: { status: 'cancelled' } });
    return loadDetail(tx, id);
  });
}

// ─── plumbing ────────────────────────────────────────────────────────────────

const HEADER_INCLUDE = {
  supplier: { select: { name: true } },
  purchaseOrder: { select: { number: true } },
  varianceAcceptedBy: { select: { name: true } },
} as const;

interface ResolvedBillLine {
  purchaseOrderLineId: string | null;
  variantId: string | null;
  description: string | null;
  quantity: number;
  unitCostCents: number;
  amountCents: number;
  uomCode: string | null;
  unitsPerUom: number;
}

async function resolveLines(
  tx: TxClient,
  purchaseOrderId: string | null,
  inputs: SupplierBillLineInput[]
): Promise<ResolvedBillLine[]> {
  const resolved: ResolvedBillLine[] = [];

  for (const input of inputs) {
    let poLine: {
      id: string;
      variantId: string;
      uomCode: string | null;
      unitsPerUom: number;
    } | null = null;

    if (input.purchaseOrderLineId) {
      poLine = await tx.purchaseOrderLine.findFirst({
        where: {
          id: input.purchaseOrderLineId,
          ...(purchaseOrderId ? { purchaseOrderId } : {}),
        },
        select: { id: true, variantId: true, uomCode: true, unitsPerUom: true },
      });
      if (!poLine) {
        throw new InventoryValidationError('That order line is not on this purchase order', [
          { field: 'lines', message: `unknown line ${input.purchaseOrderLineId}` },
        ]);
      }
    }

    const variantId = input.variantId ?? poLine?.variantId ?? null;

    // Same unit convention as everywhere else: a supplier billing against a case
    // order bills in cases, and everything downstream works in base units.
    const uom =
      input.uomCode !== undefined && variantId
        ? await resolveLineUom(tx, { variantId, uomCode: input.uomCode })
        : { uomCode: poLine?.uomCode ?? null, unitsPerUom: poLine?.unitsPerUom ?? 1 };

    const quantity = toBaseUnits(input.quantity, uom.unitsPerUom);
    const unitCostCents = toBaseUnitCost(input.unitCostCents, uom.unitsPerUom);

    resolved.push({
      purchaseOrderLineId: poLine?.id ?? null,
      variantId,
      description: input.description ?? null,
      quantity,
      unitCostCents,
      // What they printed, when they printed one. Their rounding is their own,
      // and a recomputed total that disagrees with the paper by a penny reads as
      // a bug in this software rather than as an invoice.
      amountCents: input.amountCents ?? quantity * unitCostCents,
      uomCode: uom.uomCode,
      unitsPerUom: uom.unitsPerUom,
    });
  }

  return resolved;
}

async function recomputeTotals(tx: TxClient, id: string): Promise<void> {
  const bill = await tx.supplierBill.findFirst({
    where: { id },
    select: { taxCents: true, shippingCents: true, lines: { select: { amountCents: true } } },
  });
  if (!bill) return;
  const subtotal = bill.lines.reduce((sum, l) => sum + l.amountCents, 0);
  await tx.supplierBill.update({
    where: { id },
    data: { subtotalCents: subtotal, totalCents: subtotal + bill.taxCents + bill.shippingCents },
  });
}

interface HeaderLite {
  id: string;
  number: string;
  status: string;
}

async function loadHeader(tx: TxClient, id: string): Promise<HeaderLite> {
  const row = await tx.supplierBill.findFirst({
    where: { id },
    select: { id: true, number: true, status: true },
  });
  if (!row) throw new InventoryNotFoundError('SupplierBill', id);
  return row;
}

/**
 * Load the bill and run the match.
 *
 * The received quantity is summed from the RECEIPT LINES rather than read off
 * `purchaseOrderLine.quantityReceived`, which excludes damaged-on-arrival units.
 * That is correct for the order (the supplier still owes them) and wrong here:
 * a supplier who ships ten and breaks two has delivered ten units of invoice,
 * and the two broken ones are a RETURN conversation (Phase 8.7), not a reason to
 * tell them they under-shipped.
 */
async function loadDetail(tx: TxClient, id: string): Promise<SupplierBillDetail> {
  const bill = await tx.supplierBill.findFirst({
    where: { id },
    include: {
      ...HEADER_INCLUDE,
      lines: {
        include: {
          variant: { select: { sku: true, product: { select: { title: true } } } },
          purchaseOrderLine: {
            select: {
              id: true,
              quantityOrdered: true,
              unitCostCents: true,
              receiptLines: { select: { quantityReceived: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!bill) throw new InventoryNotFoundError('SupplierBill', id);

  const lines: MatchedBillLine[] = bill.lines.map((line) => {
    const poLine = line.purchaseOrderLine;
    const received = poLine
      ? poLine.receiptLines.reduce((sum, r) => sum + r.quantityReceived, 0)
      : null;

    const match = matchBillLine({
      purchaseOrderLineId: line.purchaseOrderLineId,
      billedQuantity: line.quantity,
      billedUnitCostCents: line.unitCostCents,
      orderedQuantity: poLine?.quantityOrdered ?? null,
      orderedUnitCostCents: poLine?.unitCostCents ?? null,
      receivedQuantity: received,
    });

    return {
      id: line.id,
      purchaseOrderLineId: line.purchaseOrderLineId,
      variantId: line.variantId,
      variantSku: line.variant?.sku ?? null,
      productTitle: line.variant?.product?.title ?? null,
      description: line.description,
      quantity: line.quantity,
      unitCostCents: line.unitCostCents,
      amountCents: line.amountCents,
      uomCode: line.uomCode,
      unitsPerUom: line.unitsPerUom,
      orderedQuantity: poLine?.quantityOrdered ?? null,
      orderedUnitCostCents: poLine?.unitCostCents ?? null,
      receivedQuantity: received,
      match,
    };
  });

  const matchable = lines.filter((l) => l.purchaseOrderLineId !== null);
  const flagged = lines.filter((l) => l.match.needsReview);
  const unordered = lines.filter((l) => l.match.verdict === 'unordered');

  // NULL, not `true`, when there was nothing to match against — the same fault
  // as a scorecard scoring a supplier nobody measured. The test is the BILL's
  // link to an order, not the lines': a carriage-only invoice tied to no order
  // cannot be checked at all, while a rogue line on a bill that IS tied to an
  // order is exactly the finding the match exists to surface, so that one gets
  // checked and flagged rather than excused.
  const canMatch = matchable.length > 0 || bill.purchaseOrderId !== null;

  return {
    ...serializeRow(bill),
    lines,
    match: {
      ok: canMatch ? flagged.length === 0 : null,
      linesMatched: matchable.length,
      linesFlagged: flagged.length,
      totalVarianceCents: canMatch
        ? lines.reduce((sum, l) => sum + (l.match.amountVarianceCents ?? 0), 0)
        : null,
      unorderedLines: unordered.length,
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface BillRecord {
  id: string;
  number: string;
  supplierId: string;
  purchaseOrderId: string | null;
  status: string;
  currency: string;
  fxRate: unknown;
  billedAt: Date;
  dueAt: Date | null;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  paidCents: number | null;
  paidAt: Date | null;
  varianceAcceptedByUserId: string | null;
  varianceAcceptedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier?: { name: string | null } | null;
  purchaseOrder?: { number: string } | null;
  varianceAcceptedBy?: { name: string | null } | null;
}

function serializeRow(row: BillRecord): SupplierBillRow {
  return {
    id: row.id,
    number: row.number,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderNumber: row.purchaseOrder?.number ?? null,
    status: row.status,
    currency: row.currency,
    fxRate: row.fxRate === null || row.fxRate === undefined ? null : Number(row.fxRate),
    billedAt: row.billedAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    shippingCents: row.shippingCents,
    totalCents: row.totalCents,
    paidCents: row.paidCents,
    paidAt: row.paidAt?.toISOString() ?? null,
    varianceAcceptedByUserId: row.varianceAcceptedByUserId,
    varianceAcceptedByName: row.varianceAcceptedBy?.name ?? null,
    varianceAcceptedAt: row.varianceAcceptedAt?.toISOString() ?? null,
    notes: row.notes,
    // Only for a bill still owed. "Three days until due" on something already
    // paid is a countdown to nothing.
    daysUntilDue:
      row.dueAt !== null && row.paidAt === null
        ? Math.ceil((row.dueAt.getTime() - Date.now()) / DAY_MS)
        : null,
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
    action: `inventory.supplier_bill.${action}`,
    entityType: 'SupplierBill',
    entityId,
    diff: { after: diff },
  });
}
