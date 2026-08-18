// Consignment settlement (docs/146 Phase 9.6) — paying for what sold.
//
// Consigned stock belongs to the supplier until the moment it sells. That moment
// creates a debt, and until somebody adds those moments up over a period and
// sends the total, the supplier is financing the business by accident and both
// sides are guessing. Every consignment arrangement that goes wrong goes wrong
// here, not at the receiving door.
//
// ── A settlement is a closed period, not a running total ─────────────────────
//
// `[periodStart, periodEnd)`, half-open, against one named counterparty. Once
// closed it is immutable: a late-arriving correction becomes a line in the NEXT
// period, never an edit to a settled one. A supplier who has already been paid
// against a document that later changed cannot reconcile anything, and the
// arrangement dies of mistrust rather than of arithmetic.
//
// ── What it counts, and what it refuses to count ─────────────────────────────
//
// Sale movements stamped `ownership = 'consignment'` at the time they happened —
// see the ledger's `ownership` column for why that is stamped rather than joined.
// Movements with no recorded cost are counted and reported SEPARATELY rather
// than valued at zero. A consignment line reading $0.00 says "they gave it to
// us", which is the most expensive possible way for a settlement to be wrong.

import { withTenant } from '@wizeworks/db';
import { CreateConsignmentSettlementInput, draftSettlement } from '@wizeworks/commerce-schemas';
import type { ConsignedSale, SettlementDraft } from '@wizeworks/commerce-schemas';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
  type ServiceContext,
} from '../errors';

export interface ConsignmentSettlementRow {
  id: string;
  number: string;
  ownerType: string;
  supplierId: string | null;
  supplierName: string | null;
  customerId: string | null;
  customerName: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  currency: string;
  totalCents: number;
  unitsSold: number;
  supplierBillId: string | null;
  note: string | null;
  closedAt: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ConsignmentSettlementLineRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  unitsSold: number;
  unitCostCents: number;
  amountCents: number;
  movementIds: string[];
}

export interface ConsignmentSettlementDetail extends ConsignmentSettlementRow {
  lines: ConsignmentSettlementLineRow[];
  /** Units that sold from consigned stock with no cost recorded against the
   *  movement. NOT included in `totalCents` and NOT valued at zero — they are
   *  money owed that nobody can currently put a number on, which is a finding
   *  the merchant has to resolve before the supplier can be paid honestly. */
  unpricedUnits: number;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

const ROW_SELECT = `
  s.id,
  s.number,
  s.owner_type      AS "ownerType",
  s.supplier_id     AS "supplierId",
  sup.name          AS "supplierName",
  s.customer_id     AS "customerId",
  NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '') AS "customerName",
  s.period_start    AS "periodStart",
  s.period_end      AS "periodEnd",
  s.status,
  s.currency,
  s.total_cents     AS "totalCents",
  s.units_sold      AS "unitsSold",
  s.supplier_bill_id AS "supplierBillId",
  s.note,
  s.closed_at       AS "closedAt",
  s.invoiced_at     AS "invoicedAt",
  s.paid_at         AS "paidAt",
  s.created_at      AS "createdAt"
`;

interface RawRow {
  id: string;
  number: string;
  ownerType: string;
  supplierId: string | null;
  supplierName: string | null;
  customerId: string | null;
  customerName: string | null;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  currency: string;
  totalCents: number;
  unitsSold: number;
  supplierBillId: string | null;
  note: string | null;
  closedAt: Date | null;
  invoicedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}

function serialize(r: RawRow): ConsignmentSettlementRow {
  return {
    id: r.id,
    number: r.number,
    ownerType: r.ownerType,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    customerId: r.customerId,
    customerName: r.customerName,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    status: r.status,
    currency: r.currency,
    totalCents: r.totalCents,
    unitsSold: r.unitsSold,
    supplierBillId: r.supplierBillId,
    note: r.note,
    closedAt: r.closedAt?.toISOString() ?? null,
    invoicedAt: r.invoicedAt?.toISOString() ?? null,
    paidAt: r.paidAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface ListConsignmentSettlementsFilter {
  status?: string;
  supplierId?: string;
  take?: number;
  skip?: number;
}

export async function listConsignmentSettlements(
  ctx: ServiceContext,
  filter: ListConsignmentSettlementsFilter = {}
): Promise<{ items: ConsignmentSettlementRow[]; total: number; owedCents: number }> {
  const take = Math.min(Math.max(filter.take ?? 50, 1), 200);
  const skip = Math.max(filter.skip ?? 0, 0);

  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
    };
    const [rows, total, owed] = await Promise.all([
      tx.$queryRawUnsafe<RawRow[]>(
        `SELECT ${ROW_SELECT}
           FROM inventory_consignment_settlements s
           LEFT JOIN inventory_suppliers sup ON sup.id = s.supplier_id
           LEFT JOIN customers c             ON c.id = s.customer_id
          WHERE s.tenant_id = $1::uuid
            AND ($2::text IS NULL OR s.status = $2)
            AND ($3::uuid IS NULL OR s.supplier_id = $3::uuid)
          ORDER BY s.period_end DESC, s.created_at DESC
          LIMIT $4 OFFSET $5`,
        ctx.tenantId,
        filter.status ?? null,
        filter.supplierId ?? null,
        take,
        skip
      ),
      tx.consignmentSettlement.count({ where }),
      // What is actually owed right now: closed and invoiced, not yet paid. A
      // draft is a working document and counting it would inflate the figure
      // with periods nobody has agreed to.
      tx.consignmentSettlement.aggregate({
        where: { tenantId: ctx.tenantId, status: { in: ['closed', 'invoiced'] } },
        _sum: { totalCents: true },
      }),
    ]);

    return {
      items: rows.map(serialize),
      total,
      owedCents: owed._sum.totalCents ?? 0,
    };
  });
}

export async function getConsignmentSettlement(
  ctx: ServiceContext,
  id: string
): Promise<ConsignmentSettlementDetail> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRawUnsafe<RawRow[]>(
      `SELECT ${ROW_SELECT}
         FROM inventory_consignment_settlements s
         LEFT JOIN inventory_suppliers sup ON sup.id = s.supplier_id
         LEFT JOIN customers c             ON c.id = s.customer_id
        WHERE s.tenant_id = $1::uuid AND s.id = $2::uuid`,
      ctx.tenantId,
      id
    );
    const row = rows[0];
    if (!row) throw new InventoryNotFoundError('ConsignmentSettlement', id);

    const lines = await tx.consignmentSettlementLine.findMany({
      where: { tenantId: ctx.tenantId, settlementId: id },
      orderBy: [{ amountCents: 'desc' }],
      select: {
        id: true,
        variantId: true,
        warehouseId: true,
        unitsSold: true,
        unitCostCents: true,
        amountCents: true,
        movementIds: true,
        variant: { select: { sku: true, title: true } },
        warehouse: { select: { name: true } },
      },
    });

    // A draft is re-derived on every read so the merchant is looking at what is
    // true now, not what was true when they opened it. A closed one reads its
    // own lines, because a settled period must never change shape.
    const unpriced =
      row.status === 'draft' ? (await draftForPeriod(tx, ctx, row)).unpricedUnits : 0;

    return {
      ...serialize(row),
      lines: lines.map((l) => ({
        id: l.id,
        variantId: l.variantId,
        variantSku: l.variant?.sku ?? null,
        variantName: l.variant?.title ?? null,
        warehouseId: l.warehouseId,
        warehouseName: l.warehouse?.name ?? null,
        unitsSold: l.unitsSold,
        unitCostCents: l.unitCostCents,
        amountCents: l.amountCents,
        movementIds: Array.isArray(l.movementIds) ? (l.movementIds as string[]) : [],
      })),
      unpricedUnits: unpriced,
    };
  });
}

// ─── Building a period ───────────────────────────────────────────────────────

interface PeriodShape {
  supplierId: string | null;
  customerId: string | null;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Every consigned sale in the window, rolled into lines.
 *
 * The `ownership` filter reads the movement's OWN stamp, not the level's current
 * one. That is what makes a settlement stable: buying the consignment out next
 * month must not retroactively empty last month's document.
 *
 * The owner filter is applied through the LEVEL, because a movement does not
 * carry whose stock it was — only that it was consigned. A tenant consigning
 * from two suppliers at the same location is the case this cannot separate, and
 * the ownership axis already refuses to model that (one owner per level), so the
 * join is exact rather than approximate.
 */
async function draftForPeriod(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  ctx: ServiceContext,
  period: PeriodShape
): Promise<SettlementDraft> {
  const sales = await tx.$queryRaw<ConsignedSale[]>`
    SELECT m.variant_id   AS "variantId",
           m.warehouse_id AS "warehouseId",
           ABS(m.delta)   AS "units",
           -- What the goods cost when they sold. The movement's own recorded
           -- cost of goods, per unit; falling back to the unit cost stamped on
           -- the movement. Deliberately NOT the level's average today — what you
           -- owe is what it cost at the time, and today's average has been moved
           -- by every receipt since.
           COALESCE(
             CASE WHEN m.cost_consumed_cents IS NOT NULL AND m.delta <> 0
                  THEN (m.cost_consumed_cents / ABS(m.delta))::int END,
             m.unit_cost_cents,
             0
           )::int AS "unitCostCents",
           m.id AS "movementId"
      FROM inventory_movements m
      JOIN inventory_levels l
        ON l.variant_id = m.variant_id AND l.warehouse_id = m.warehouse_id
     WHERE m.tenant_id  = ${ctx.tenantId}::uuid
       AND m.ownership  = 'consignment'
       AND m.reason     = 'sale'
       AND m.created_at >= ${period.periodStart}
       AND m.created_at <  ${period.periodEnd}
       AND (${period.supplierId}::uuid IS NULL OR l.owner_supplier_id = ${period.supplierId}::uuid)
       AND (${period.customerId}::uuid IS NULL OR l.owner_customer_id = ${period.customerId}::uuid)
     ORDER BY m.created_at ASC
  `;
  return draftSettlement(sales);
}

/**
 * Open a draft settlement for a period and fill it from the ledger.
 *
 * A draft is re-derivable and disposable: the merchant opens one, looks at it,
 * and either closes it or throws it away. Nothing is owed until it is closed.
 */
export async function createConsignmentSettlement(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<ConsignmentSettlementDetail> {
  const input = CreateConsignmentSettlementInput.parse(rawInput);
  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);

  const id = await withTenant(ctx, async (tx) => {
    // Two open drafts for one counterparty over overlapping periods would
    // double-bill the same sales the moment both were closed. Refused here
    // rather than caught at close, when the merchant has already reviewed it.
    const overlapping = await tx.consignmentSettlement.findFirst({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ['draft', 'closed', 'invoiced', 'paid'] },
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
        ...(input.customerId ? { customerId: input.customerId } : {}),
        periodStart: { lt: periodEnd },
        periodEnd: { gt: periodStart },
      },
      select: { id: true, number: true },
    });
    if (overlapping) {
      throw new InventoryConflictError(
        `${overlapping.number} already covers part of that period.`,
        'periodStart'
      );
    }

    const count = await tx.consignmentSettlement.count({ where: { tenantId: ctx.tenantId } });
    const number = `CS-${String(count + 1).padStart(5, '0')}`;

    const draft = await draftForPeriod(tx, ctx, {
      supplierId: input.supplierId ?? null,
      customerId: input.customerId ?? null,
      periodStart,
      periodEnd,
    });

    const settlement = await tx.consignmentSettlement.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        ownerType: input.ownerType,
        supplierId: input.supplierId ?? null,
        customerId: input.customerId ?? null,
        periodStart,
        periodEnd,
        totalCents: draft.totalCents,
        unitsSold: draft.unitsSold,
        note: input.note ?? null,
      },
      select: { id: true },
    });

    for (const line of draft.lines) {
      await tx.consignmentSettlementLine.create({
        data: {
          tenantId: ctx.tenantId,
          settlementId: settlement.id,
          variantId: line.variantId,
          warehouseId: line.warehouseId,
          unitsSold: line.unitsSold,
          unitCostCents: line.unitCostCents,
          amountCents: line.amountCents,
          movementIds: line.movementIds,
        },
      });
    }

    return settlement.id;
  });

  return getConsignmentSettlement(ctx, id);
}

/** Rebuild a draft's lines from the ledger. Refused once closed. */
export async function refreshConsignmentSettlement(
  ctx: ServiceContext,
  id: string
): Promise<ConsignmentSettlementDetail> {
  await withTenant(ctx, async (tx) => {
    const row = await tx.consignmentSettlement.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        status: true,
        supplierId: true,
        customerId: true,
        periodStart: true,
        periodEnd: true,
      },
    });
    if (!row) throw new InventoryNotFoundError('ConsignmentSettlement', id);
    if (row.status !== 'draft') {
      throw new InventoryConflictError(
        'A settled period cannot be rebuilt — put the correction in the next one.',
        'status'
      );
    }

    const draft = await draftForPeriod(tx, ctx, row);
    await tx.consignmentSettlementLine.deleteMany({ where: { settlementId: id } });
    for (const line of draft.lines) {
      await tx.consignmentSettlementLine.create({
        data: {
          tenantId: ctx.tenantId,
          settlementId: id,
          variantId: line.variantId,
          warehouseId: line.warehouseId,
          unitsSold: line.unitsSold,
          unitCostCents: line.unitCostCents,
          amountCents: line.amountCents,
          movementIds: line.movementIds,
        },
      });
    }
    await tx.consignmentSettlement.update({
      where: { id },
      data: { totalCents: draft.totalCents, unitsSold: draft.unitsSold },
    });
  });

  return getConsignmentSettlement(ctx, id);
}

/**
 * Close the period. From here it is a document, not a working figure.
 *
 * Refuses while any sale in the window has no cost recorded against it. That is
 * the one blocking check in this service, and it earns its place: closing with
 * unpriced units silently understates what is owed, the supplier is paid short,
 * and the difference is found — if it is ever found — by them.
 */
export async function closeConsignmentSettlement(
  ctx: ServiceContext,
  id: string
): Promise<ConsignmentSettlementDetail> {
  await withTenant(ctx, async (tx) => {
    const row = await tx.consignmentSettlement.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        status: true,
        supplierId: true,
        customerId: true,
        periodStart: true,
        periodEnd: true,
        number: true,
      },
    });
    if (!row) throw new InventoryNotFoundError('ConsignmentSettlement', id);
    if (row.status !== 'draft') {
      throw new InventoryConflictError(`${row.number} is already ${row.status}.`, 'status');
    }

    const draft = await draftForPeriod(tx, ctx, row);
    if (draft.unpricedUnits > 0) {
      throw new InventoryValidationError(
        `${draft.unpricedUnits} units sold from consigned stock with no cost recorded. ` +
          'Settling now would pay the owner short — put a cost on them first.',
        [{ field: 'lines', message: `${draft.unpricedUnits} units have no cost.` }]
      );
    }

    await tx.consignmentSettlement.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date() },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.consignment.closed',
      entityType: 'ConsignmentSettlement',
      entityId: id,
      diff: { after: { totalCents: draft.totalCents, unitsSold: draft.unitsSold } },
    });
  });

  return getConsignmentSettlement(ctx, id);
}

/** Attach the owner's invoice, once they raise one. */
export async function invoiceConsignmentSettlement(
  ctx: ServiceContext,
  id: string,
  supplierBillId: string | null
): Promise<ConsignmentSettlementDetail> {
  await withTenant(ctx, async (tx) => {
    const row = await tx.consignmentSettlement.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!row) throw new InventoryNotFoundError('ConsignmentSettlement', id);
    if (row.status !== 'closed') {
      throw new InventoryConflictError('Close the period before billing against it.', 'status');
    }
    await tx.consignmentSettlement.update({
      where: { id },
      data: { status: 'invoiced', invoicedAt: new Date(), supplierBillId },
    });
  });
  return getConsignmentSettlement(ctx, id);
}

export async function markConsignmentSettlementPaid(
  ctx: ServiceContext,
  id: string
): Promise<ConsignmentSettlementDetail> {
  await withTenant(ctx, async (tx) => {
    const row = await tx.consignmentSettlement.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!row) throw new InventoryNotFoundError('ConsignmentSettlement', id);
    if (row.status === 'paid') return;
    if (row.status !== 'closed' && row.status !== 'invoiced') {
      throw new InventoryConflictError('Only a closed or invoiced period can be paid.', 'status');
    }
    await tx.consignmentSettlement.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date() },
    });
  });
  return getConsignmentSettlement(ctx, id);
}

export async function cancelConsignmentSettlement(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const row = await tx.consignmentSettlement.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true, number: true },
    });
    if (!row) throw new InventoryNotFoundError('ConsignmentSettlement', id);
    if (row.status === 'paid') {
      throw new InventoryConflictError(
        `${row.number} has been paid — cancelling it would erase a payment that happened.`,
        'status'
      );
    }
    await tx.consignmentSettlement.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
  });
}

// ─── The unsettled view ──────────────────────────────────────────────────────

export interface UnsettledConsignmentRow {
  ownerType: string;
  ownerId: string;
  ownerName: string | null;
  unitsSold: number;
  amountCents: number;
  unpricedUnits: number;
  /** When the last closed period ended — the start of what is still owed. Null
   *  when nothing has ever been settled with this owner, which is the state a
   *  new arrangement is in and is worth saying out loud. */
  settledThrough: string | null;
  earliestUnsettledSaleAt: string | null;
}

/**
 * What is owed but not yet settled, by owner.
 *
 * The screen a merchant actually opens: not "show me my settlements" but "who am
 * I behind with". Everything since each owner's last closed period, priced from
 * the movements.
 */
export async function listUnsettledConsignment(
  ctx: ServiceContext
): Promise<UnsettledConsignmentRow[]> {
  return withTenant(ctx, async (tx) => {
    return tx.$queryRaw<UnsettledConsignmentRow[]>`
      WITH owners AS (
        SELECT DISTINCT
               CASE WHEN l.owner_supplier_id IS NOT NULL THEN 'supplier' ELSE 'customer' END AS owner_type,
               COALESCE(l.owner_supplier_id, l.owner_customer_id) AS owner_id
          FROM inventory_levels l
         WHERE l.tenant_id  = ${ctx.tenantId}::uuid
           AND l.ownership  = 'consignment'
           AND COALESCE(l.owner_supplier_id, l.owner_customer_id) IS NOT NULL
      ),
      settled AS (
        SELECT COALESCE(s.supplier_id, s.customer_id) AS owner_id,
               MAX(s.period_end) AS through
          FROM inventory_consignment_settlements s
         WHERE s.tenant_id = ${ctx.tenantId}::uuid
           AND s.status IN ('closed', 'invoiced', 'paid')
         GROUP BY COALESCE(s.supplier_id, s.customer_id)
      ),
      sales AS (
        SELECT COALESCE(l.owner_supplier_id, l.owner_customer_id) AS owner_id,
               ABS(m.delta) AS units,
               COALESCE(
                 CASE WHEN m.cost_consumed_cents IS NOT NULL AND m.delta <> 0
                      THEN (m.cost_consumed_cents / ABS(m.delta))::int END,
                 m.unit_cost_cents
               ) AS unit_cost_cents,
               m.created_at
          FROM inventory_movements m
          JOIN inventory_levels l
            ON l.variant_id = m.variant_id AND l.warehouse_id = m.warehouse_id
          LEFT JOIN settled st
            ON st.owner_id = COALESCE(l.owner_supplier_id, l.owner_customer_id)
         WHERE m.tenant_id = ${ctx.tenantId}::uuid
           AND m.ownership = 'consignment'
           AND m.reason    = 'sale'
           AND (st.through IS NULL OR m.created_at >= st.through)
      )
      SELECT o.owner_type AS "ownerType",
             o.owner_id::text AS "ownerId",
             COALESCE(sup.name, NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '')) AS "ownerName",
             COALESCE(SUM(sa.units) FILTER (WHERE sa.unit_cost_cents IS NOT NULL), 0)::int AS "unitsSold",
             COALESCE(SUM(sa.units * sa.unit_cost_cents), 0)::int AS "amountCents",
             -- Counted, never valued at zero. Money owed that nobody can put a
             -- number on is a finding, not a discount.
             COALESCE(SUM(sa.units) FILTER (WHERE sa.unit_cost_cents IS NULL), 0)::int AS "unpricedUnits",
             st.through AS "settledThrough",
             MIN(sa.created_at) AS "earliestUnsettledSaleAt"
        FROM owners o
        LEFT JOIN sales sa ON sa.owner_id = o.owner_id
        LEFT JOIN settled st ON st.owner_id = o.owner_id
        LEFT JOIN inventory_suppliers sup ON sup.id = o.owner_id
        LEFT JOIN customers c ON c.id = o.owner_id
       GROUP BY o.owner_type, o.owner_id, sup.name, c.first_name, c.last_name, st.through
       ORDER BY "amountCents" DESC
    `;
  });
}
