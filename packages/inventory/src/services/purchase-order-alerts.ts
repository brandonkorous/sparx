// Late purchase orders (docs/146 Phase 8.3) — the order that never turned up.
//
// A business finds out an order is late in one of two ways: a customer asks for
// the part, or somebody happens to scroll past it. Both are too late, and both
// are avoidable, because the platform already knows the date the goods were due
// and knows nothing has been received against them.
//
// ── What "due" means when nobody said ────────────────────────────────────────
//
// The buyer's own `expectedArrivalAt` wins — it is a stated promise and the one
// they will chase against. Failing that, the supplier's stated lead time from
// the order date stands in. Failing THAT, the order is not late: it is undated,
// which is a different problem and one this sweep must not disguise as
// punctuality or as lateness. An order with no due date contributes nothing.
// (The measured lead time is deliberately NOT used as a fallback here. It is the
// right input for planning stock, but "you are late against a figure we worked
// out about you" is not a claim to put in front of a supplier.)
//
// ── Why it fires once ────────────────────────────────────────────────────────
//
// The pass runs nightly and an overdue order stays overdue. Re-announcing it
// every night for six weeks is how a business learns to ignore the alert, so the
// first flag stamps `lateAlertedAt` and the order goes quiet. Moving the
// expected arrival date clears the stamp — accepting a new promise re-arms the
// alert against the new one.

import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

export interface LatePurchaseOrderRow {
  purchaseOrderId: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  warehouseId: string;
  status: string;
  orderedAt: string | null;
  /** The date it was due, and where that date came from. A buyer chasing a
   *  supplier needs to know whether they are quoting the supplier's own promise
   *  or a date derived from their stated lead time. */
  dueAt: string;
  dueSource: 'expected_arrival' | 'supplier_lead_time';
  daysLate: number;
  /** Base units still outstanding across the order's lines. */
  unitsOutstanding: number;
  /** What those outstanding units are worth at the agreed price. This is the
   *  number that decides which of eleven late orders gets chased first. */
  valueOutstandingCents: number;
  /** Null when it has never been flagged — which is not the same as "on time",
   *  and the surface says so. */
  alertedAt: string | null;
}

export interface LateOrderSweepResult {
  /** Open orders that had a due date to be judged against. */
  ordersConsidered: number;
  /** How many of those are past it. */
  lateOrders: number;
  /** Newly flagged tonight — the ones an event went out for. */
  newlyFlagged: number;
  /** Open orders with NO due date at all. Reported rather than swallowed: an
   *  order nobody can be late on is a gap in the paperwork, not a success. */
  undated: number;
}

interface LateRow {
  purchaseOrderId: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  warehouseId: string;
  status: string;
  orderedAt: Date | null;
  dueAt: Date;
  dueSource: 'expected_arrival' | 'supplier_lead_time';
  daysLate: number;
  unitsOutstanding: number;
  valueOutstandingCents: number;
  alertedAt: Date | null;
}

/** Every open order past its due date, worst first. A read — it flags nothing. */
export async function listLatePurchaseOrders(
  ctx: ServiceContext,
  filter: { supplierId?: string; take?: number } = {}
): Promise<{ items: LatePurchaseOrderRow[]; total: number; undated: number }> {
  const take = Math.min(filter.take ?? 100, 500);
  return withTenant(ctx, async (tx) => {
    const rows = await selectLate(tx, ctx.tenantId, {
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      onlyUnflagged: false,
    });
    const undated = await countUndated(tx, ctx.tenantId);
    return {
      items: rows.slice(0, take).map(serialize),
      total: rows.length,
      undated,
    };
  });
}

/**
 * Flag every newly-late order and publish one event each.
 *
 * The stamp is written BEFORE the events go out, in the same transaction as the
 * selection, so a publisher failure cannot produce a second announcement on the
 * next run — a duplicate alert is worse than a missed one here, because the
 * order is still visible on the late list either way.
 */
export async function sweepLatePurchaseOrders(ctx: ServiceContext): Promise<LateOrderSweepResult> {
  const { candidates, considered, undated } = await withTenant(ctx, async (tx) => {
    const all = await selectLate(tx, ctx.tenantId, { onlyUnflagged: false });
    const fresh = all.filter((row) => row.alertedAt === null);
    if (fresh.length > 0) {
      await tx.purchaseOrder.updateMany({
        where: { id: { in: fresh.map((r) => r.purchaseOrderId) } },
        data: { lateAlertedAt: new Date() },
      });
    }
    return {
      candidates: fresh,
      considered: all.length,
      undated: await countUndated(tx, ctx.tenantId),
    };
  });

  for (const row of candidates) {
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      topic: 'inventory.purchase_order.late',
      data: {
        purchaseOrderId: row.purchaseOrderId,
        number: row.number,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        warehouseId: row.warehouseId,
        dueAt: row.dueAt.toISOString(),
        dueSource: row.dueSource,
        daysLate: row.daysLate,
        unitsOutstanding: row.unitsOutstanding,
        valueOutstandingCents: row.valueOutstandingCents,
      },
    });
  }

  return {
    ordersConsidered: considered,
    lateOrders: considered,
    newlyFlagged: candidates.length,
    undated,
  };
}

/** Undo the flag when the buyer accepts a new arrival date. Called by the PO
 *  update path — a new promise deserves a fresh alert if it is also missed. */
export async function rearmLateAlert(tx: TxClient, purchaseOrderId: string): Promise<void> {
  await tx.purchaseOrder.updateMany({
    where: { id: purchaseOrderId },
    data: { lateAlertedAt: null },
  });
}

// ─── the query ───────────────────────────────────────────────────────────────

interface SelectOptions {
  supplierId?: string;
  onlyUnflagged: boolean;
}

async function selectLate(
  tx: TxClient,
  tenantId: string,
  options: SelectOptions
): Promise<LateRow[]> {
  const supplierFilter = options.supplierId ?? null;
  const rows = await tx.$queryRaw<LateRow[]>`
    WITH open_orders AS (
      SELECT
        po.id,
        po.number,
        po.supplier_id,
        po.warehouse_id,
        po.status,
        po.ordered_at,
        po.late_alerted_at,
        s.name AS supplier_name,
        -- The buyer's stated date wins; the supplier's stated lead time is the
        -- fallback; neither means the order is UNDATED and drops out below.
        COALESCE(
          po.expected_arrival_at,
          CASE WHEN s.lead_time_days IS NOT NULL AND po.ordered_at IS NOT NULL
               THEN po.ordered_at + make_interval(days => s.lead_time_days)
          END
        ) AS due_at,
        CASE WHEN po.expected_arrival_at IS NOT NULL
             THEN 'expected_arrival' ELSE 'supplier_lead_time' END AS due_source
      FROM inventory_purchase_orders po
      JOIN inventory_suppliers s ON s.id = po.supplier_id
      WHERE po.tenant_id = ${tenantId}::uuid
        AND po.status IN ('submitted', 'partial')
        AND (${supplierFilter}::uuid IS NULL OR po.supplier_id = ${supplierFilter}::uuid)
    ),
    outstanding AS (
      SELECT
        pol.purchase_order_id,
        SUM(GREATEST(0, pol.quantity_ordered - pol.quantity_received))::int AS units,
        SUM(GREATEST(0, pol.quantity_ordered - pol.quantity_received)
            * pol.unit_cost_cents)::int                                     AS value_cents
      FROM inventory_purchase_order_lines pol
      WHERE pol.tenant_id = ${tenantId}::uuid
      GROUP BY pol.purchase_order_id
    )
    SELECT
      o.id                                                        AS "purchaseOrderId",
      o.number                                                    AS "number",
      o.supplier_id                                               AS "supplierId",
      o.supplier_name                                             AS "supplierName",
      o.warehouse_id                                              AS "warehouseId",
      o.status                                                    AS "status",
      o.ordered_at                                                AS "orderedAt",
      o.due_at                                                    AS "dueAt",
      o.due_source                                                AS "dueSource",
      FLOOR(EXTRACT(EPOCH FROM (now() - o.due_at)) / 86400)::int  AS "daysLate",
      COALESCE(os.units, 0)                                       AS "unitsOutstanding",
      COALESCE(os.value_cents, 0)                                 AS "valueOutstandingCents",
      o.late_alerted_at                                           AS "alertedAt"
    FROM open_orders o
    LEFT JOIN outstanding os ON os.purchase_order_id = o.id
    WHERE o.due_at IS NOT NULL
      AND o.due_at < now()
      -- Nothing outstanding means the order is fully delivered and merely has a
      -- status nobody closed. Chasing a supplier for goods already on the shelf
      -- is the fastest way to make an alert untrustworthy.
      AND COALESCE(os.units, 0) > 0
      AND (${options.onlyUnflagged}::boolean = false OR o.late_alerted_at IS NULL)
    ORDER BY COALESCE(os.value_cents, 0) DESC, o.due_at ASC
  `;
  return rows;
}

/** Open orders with no due date at all — a gap in the paperwork, reported rather
 *  than counted as punctual. */
async function countUndated(tx: TxClient, tenantId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM inventory_purchase_orders po
    JOIN inventory_suppliers s ON s.id = po.supplier_id
    WHERE po.tenant_id = ${tenantId}::uuid
      AND po.status IN ('submitted', 'partial')
      AND po.expected_arrival_at IS NULL
      AND (s.lead_time_days IS NULL OR po.ordered_at IS NULL)
  `;
  return rows[0]?.count ?? 0;
}

function serialize(row: LateRow): LatePurchaseOrderRow {
  return {
    purchaseOrderId: row.purchaseOrderId,
    number: row.number,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    warehouseId: row.warehouseId,
    status: row.status,
    orderedAt: row.orderedAt?.toISOString() ?? null,
    dueAt: row.dueAt.toISOString(),
    dueSource: row.dueSource,
    daysLate: row.daysLate,
    unitsOutstanding: row.unitsOutstanding,
    valueOutstandingCents: row.valueOutstandingCents,
    alertedAt: row.alertedAt?.toISOString() ?? null,
  };
}
