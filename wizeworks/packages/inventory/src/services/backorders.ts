// Backorders (docs/146 Phase 9.1–9.3) — the queue of people owed stock that
// does not exist yet.
//
// ── The gap this closes ──────────────────────────────────────────────────────
//
// Under a `continue` or `preorder` policy, an order that outruns stock succeeds
// silently. `reserveOnTx` pushes `allocated` past `on_hand`, the level reads a
// negative available, and that is the entire record. Nothing says who is owed,
// how many, in what order, or what they were told. When the delivery finally
// lands, whoever happens to be standing at the receiving desk decides who gets
// it — usually the customer who shouted most recently rather than the one who
// ordered first.
//
// ── What a backorder row is, and is not ──────────────────────────────────────
//
// It is a RECORD, never a second hold. The hold that matters already exists in
// `inventory_levels.allocated`; if this module also moved stock there would be
// two writers to one number, which docs/146 §7 forbids outright. Filling a
// backorder writes no movement and touches no level: it converts "we owe this
// and cannot cover it" into "the units for this are now here", and tells
// somebody.
//
// That has an honest consequence worth stating plainly, because the alternative
// is a lie the software would tell: allocation is NOT a physical earmark. If 40
// units land against a queue of three and a walk-in buys 10 that afternoon, the
// third person in the queue is short again. What the queue guarantees is that
// the decision about who is covered is made by arrival order and recorded, not
// made at the receiving desk and forgotten.
//
// ── Dates ────────────────────────────────────────────────────────────────────
//
// A promised date is null until something actually promised it. The only three
// things that count are a real purchase order's expected arrival, a MEASURED
// supplier lead time, and a person typing one. Notably absent: the platform's
// 14-day `DEFAULT_LEAD_TIME_DAYS` and a supplier's stated catalogue figure.
// Both are fine for deciding when to reorder and neither is fit to put in front
// of a customer — one is a constant, and the other is a number the supplier
// published, not a commitment they made about this order.

import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';
import {
  backorderStatusFor,
  fillQueue,
  resolvePromisedDate,
  shouldRenotify,
  type PromiseSource,
  type UpdateBackorderInput,
} from '@wizeworks/commerce-schemas';

import { InventoryNotFoundError, InventoryValidationError, type ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';
import { MIN_RELIABLE_SAMPLES } from './lead-times';

/** Holder kinds that represent a real commitment to a person.
 *
 *  A `cart` shortfall is deliberately excluded: a cart is a browsing artefact
 *  with a 30-minute TTL, and a queue that fills up with abandoned carts stops
 *  being a list of people to call. `work_order` is excluded for the opposite
 *  reason — it is internal consumption, and nobody outside the building is
 *  waiting on it. */
const COMMITTING_HOLDERS = new Set(['order', 'subscription']);

export interface RecordBackorderInput {
  variantId: string;
  warehouseId: string;
  /** Units short — NOT the line quantity. */
  shortfall: number;
  holderType: string;
  holderId: string;
  orderItemId?: string | null;
  customerId?: string | null;
}

export interface RecordedBackorder {
  backorderId: string;
  quantity: number;
  promisedAt: Date | null;
  promiseSource: PromiseSource | null;
}

/**
 * Write down a shortfall at the moment the promise is made.
 *
 * Called from inside `reserveOnTx`'s transaction, so the commitment and the hold
 * that created it commit or roll back together. A backorder that survived a
 * rolled-back checkout would have the business chasing stock for an order that
 * does not exist.
 *
 * Returns null for holder kinds that are not commitments.
 */
export async function recordBackorderOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: RecordBackorderInput
): Promise<RecordedBackorder | null> {
  if (!COMMITTING_HOLDERS.has(input.holderType)) return null;
  const quantity = Math.floor(input.shortfall);
  if (quantity <= 0) return null;

  const promise = await resolvePromiseForVariant(tx, ctx.tenantId, {
    variantId: input.variantId,
    warehouseId: input.warehouseId,
  });

  const row = await tx.backorder.create({
    data: {
      tenantId: ctx.tenantId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      quantity,
      holderType: input.holderType,
      holderId: input.holderId,
      orderItemId: input.orderItemId ?? null,
      customerId: input.customerId ?? null,
      promisedAt: promise.promisedAt,
      promiseSource: promise.source,
      expectedPurchaseOrderId: promise.purchaseOrderId,
    },
    select: { id: true },
  });

  return {
    backorderId: row.id,
    quantity,
    promisedAt: promise.promisedAt,
    promiseSource: promise.source,
  };
}

interface VariantPromise {
  promisedAt: Date | null;
  source: PromiseSource | null;
  purchaseOrderId: string | null;
}

/**
 * The best honest date for "when will more of this arrive at this location".
 *
 * Looks for an open purchase order first — a real document with a real expected
 * arrival is the strongest thing available and it is what a buyer would quote.
 * Failing that, a measured lead time counted from today, but ONLY if it has
 * cleared `MIN_RELIABLE_SAMPLES`; a mean of two deliveries is not a measurement.
 *
 * Both branches can come back empty, and that is the common case for a business
 * that has not raised the replenishment order yet. Empty is the answer.
 */
export async function resolvePromiseForVariant(
  tx: TxClient,
  tenantId: string,
  params: { variantId: string; warehouseId: string }
): Promise<VariantPromise> {
  // The soonest open order that still has units outstanding for this item at
  // this location. `expected_arrival_at` may be null on it — an order with no
  // stated date tells us nothing, so it is filtered out rather than used as a
  // reason to stop looking.
  const poRows = await tx.$queryRaw<{ id: string; expectedArrivalAt: Date }[]>`
    SELECT po.id, po.expected_arrival_at AS "expectedArrivalAt"
      FROM inventory_purchase_orders po
      JOIN inventory_purchase_order_lines pol ON pol.purchase_order_id = po.id
     WHERE po.tenant_id           = ${tenantId}::uuid
       AND po.warehouse_id        = ${params.warehouseId}::uuid
       AND pol.variant_id         = ${params.variantId}::uuid
       AND po.status IN ('submitted', 'partial')
       AND po.expected_arrival_at IS NOT NULL
       AND pol.quantity_received  < pol.quantity_ordered
     ORDER BY po.expected_arrival_at ASC
     LIMIT 1
  `;
  const po = poRows[0];
  if (po) {
    const resolved = resolvePromisedDate({ purchaseOrderArrivalAt: po.expectedArrivalAt });
    return { promisedAt: resolved.promisedAt, source: resolved.source, purchaseOrderId: po.id };
  }

  const leadRows = await tx.$queryRaw<{ meanDays: number }[]>`
    SELECT COALESCE(lt_variant.mean_days, lt_all.mean_days)::float8 AS "meanDays"
      FROM (
        SELECT s.id AS supplier_id
          FROM inventory_supplier_variants sv
          JOIN inventory_suppliers s ON s.id = sv.supplier_id
         WHERE sv.tenant_id  = ${tenantId}::uuid
           AND sv.variant_id = ${params.variantId}::uuid
           AND s.deleted_at IS NULL AND s.is_active = true
         ORDER BY sv.is_preferred DESC, sv.unit_cost_cents ASC NULLS LAST
         LIMIT 1
      ) sup
      LEFT JOIN inventory_supplier_lead_times lt_variant
        ON lt_variant.tenant_id    = ${tenantId}::uuid
       AND lt_variant.supplier_id  = sup.supplier_id
       AND lt_variant.variant_id   = ${params.variantId}::uuid
       AND lt_variant.sample_count >= ${MIN_RELIABLE_SAMPLES}
      LEFT JOIN inventory_supplier_lead_times lt_all
        ON lt_all.tenant_id    = ${tenantId}::uuid
       AND lt_all.supplier_id  = sup.supplier_id
       AND lt_all.variant_id   IS NULL
       AND lt_all.sample_count >= ${MIN_RELIABLE_SAMPLES}
     LIMIT 1
  `;
  const meanDays = leadRows[0]?.meanDays ?? null;
  const resolved = resolvePromisedDate({
    measuredLeadTimeDays: meanDays,
    leadTimeFrom: meanDays != null ? new Date() : null,
  });
  return { promisedAt: resolved.promisedAt, source: resolved.source, purchaseOrderId: null };
}

// ─── 9.2 Allocate on receipt ─────────────────────────────────────────────────

export interface AllocateBackordersInput {
  variantId: string;
  warehouseId: string;
  /** Units that just arrived. */
  unitsArrived: number;
  sourceType: 'goods_receipt' | 'transfer' | 'count' | 'manual';
  sourceId?: string | null;
  movementId?: string | null;
}

export interface BackorderFilled {
  backorderId: string;
  holderType: string;
  holderId: string;
  orderItemId: string | null;
  customerId: string | null;
  variantId: string;
  warehouseId: string;
  quantityFilled: number;
  /** Whether this arrival cleared the commitment entirely. */
  isComplete: boolean;
}

export interface AllocateBackordersResult {
  filled: BackorderFilled[];
  /** Units left over once the queue was satisfied. */
  unitsRemaining: number;
  /** Units still owed across this (variant, location) afterwards — the number
   *  that decides whether to reorder again immediately. */
  unitsStillOwed: number;
}

/**
 * Share an arrival out across everyone waiting, in queue order.
 *
 * Runs INSIDE the arrival's own transaction. That is what makes it safe against
 * two deliveries landing at once: the queue is locked `FOR UPDATE`, so the
 * second receipt waits and then sees the first one's allocations rather than
 * handing the same units out twice.
 *
 * Writes nothing to `inventory_levels` — see the file header. The units are put
 * on the shelf by the caller's own `applyMovement`; this only records who they
 * are spoken for.
 */
export async function allocateBackordersOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: AllocateBackordersInput
): Promise<AllocateBackordersResult> {
  const units = Math.floor(input.unitsArrived);
  if (units <= 0) return { filled: [], unitsRemaining: 0, unitsStillOwed: 0 };

  // Locked in the SAME order the queue is read in, so two concurrent receipts
  // acquire rows in a consistent sequence and cannot deadlock against each
  // other. Priority first, then age — the ordering the index is built for.
  const queue = await tx.$queryRaw<
    {
      id: string;
      quantity: number;
      allocatedQuantity: number;
      holderType: string;
      holderId: string;
      orderItemId: string | null;
      customerId: string | null;
    }[]
  >`
    SELECT id,
           quantity,
           allocated_quantity AS "allocatedQuantity",
           holder_type        AS "holderType",
           holder_id          AS "holderId",
           order_item_id      AS "orderItemId",
           customer_id        AS "customerId"
      FROM inventory_backorders
     WHERE tenant_id    = ${ctx.tenantId}::uuid
       AND variant_id   = ${input.variantId}::uuid
       AND warehouse_id = ${input.warehouseId}::uuid
       AND status IN ('open', 'partial')
     ORDER BY priority DESC, created_at ASC
     FOR UPDATE
  `;
  if (queue.length === 0) {
    return { filled: [], unitsRemaining: units, unitsStillOwed: 0 };
  }

  const result = fillQueue(
    units,
    queue.map((q) => ({ id: q.id, outstanding: q.quantity - q.allocatedQuantity }))
  );

  const byId = new Map(queue.map((q) => [q.id, q]));
  const filled: BackorderFilled[] = [];
  const now = new Date();

  for (const fill of result.fills) {
    const row = byId.get(fill.id);
    if (!row) continue;
    const nowAllocated = row.allocatedQuantity + fill.quantity;
    const status = backorderStatusFor(row.quantity, nowAllocated);
    const isComplete = status === 'allocated';

    await tx.backorder.update({
      where: { id: fill.id },
      data: {
        allocatedQuantity: nowAllocated,
        status,
        // Stamped only when the commitment is fully covered. A partial fill has
        // not been "allocated" in any sense the customer would recognise, and a
        // date here would make a half-filled row look finished on every list
        // that sorts by it.
        ...(isComplete ? { allocatedAt: now } : {}),
      },
    });

    await tx.backorderAllocation.create({
      data: {
        tenantId: ctx.tenantId,
        backorderId: fill.id,
        quantity: fill.quantity,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        movementId: input.movementId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        actorId: ctx.userId ?? null,
      },
    });

    filled.push({
      backorderId: fill.id,
      holderType: row.holderType,
      holderId: row.holderId,
      orderItemId: row.orderItemId,
      customerId: row.customerId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      quantityFilled: fill.quantity,
      isComplete,
    });
  }

  return {
    filled,
    unitsRemaining: result.remaining,
    unitsStillOwed: result.stillOwed,
  };
}

/** Announce the fills, AFTER the arrival's transaction has committed. Told to
 *  the customer only once the units are genuinely on the shelf. */
export async function emitBackorderAllocations(
  ctx: ServiceContext,
  filled: readonly BackorderFilled[]
): Promise<void> {
  for (const fill of filled) {
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'inventory.backorder.allocated',
      data: {
        backorderId: fill.backorderId,
        variantId: fill.variantId,
        warehouseId: fill.warehouseId,
        holderType: fill.holderType,
        holderId: fill.holderId,
        orderItemId: fill.orderItemId,
        customerId: fill.customerId,
        quantityFilled: fill.quantityFilled,
        isComplete: fill.isComplete,
      },
    });
  }
}

/**
 * Close out commitments once the order they belong to actually ships.
 *
 * Separate from allocation because they are separate events: allocation says the
 * units arrived, fulfillment says they left. A business that ships from a
 * different location, or cancels after allocating, needs those two to be able to
 * disagree.
 */
export async function markBackordersFulfilledOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  params: { holderType: string; holderId: string; variantId?: string }
): Promise<number> {
  const result = await tx.backorder.updateMany({
    where: {
      tenantId: ctx.tenantId,
      holderType: params.holderType,
      holderId: params.holderId,
      ...(params.variantId ? { variantId: params.variantId } : {}),
      status: { in: ['open', 'partial', 'allocated'] },
    },
    data: { status: 'fulfilled', fulfilledAt: new Date() },
  });
  return result.count;
}

/**
 * Close out an order's commitments — the public form, with its own transaction.
 *
 * Called from the two places a fulfillment is actually created (the pack bench
 * and the orders API). It is deliberately best-effort at those call sites: an
 * order that has physically shipped must never fail to record because a queue
 * row would not update.
 */
export async function markBackordersFulfilled(
  ctx: ServiceContext,
  params: { holderType: string; holderId: string }
): Promise<number> {
  return withTenant(ctx, (tx) => markBackordersFulfilledOnTx(tx, ctx, params));
}

/** Drop the commitments belonging to an order that was cancelled. */
export async function cancelBackordersForHolderOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  params: { holderType: string; holderId: string; reason: string }
): Promise<number> {
  const result = await tx.backorder.updateMany({
    where: {
      tenantId: ctx.tenantId,
      holderType: params.holderType,
      holderId: params.holderId,
      status: { in: ['open', 'partial', 'allocated'] },
    },
    data: { status: 'cancelled', cancelledAt: new Date(), note: params.reason },
  });
  return result.count;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface BackorderRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  quantity: number;
  allocatedQuantity: number;
  outstanding: number;
  status: string;
  holderType: string;
  holderId: string;
  orderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  priority: number;
  /** Place in the queue for this (variant, location), 1-based. Derived, never
   *  stored — a stored position develops holes the first time somebody
   *  cancels. Null once the row leaves the queue. */
  position: number | null;
  /** Null when nobody has promised anything. NOT a bug and NOT a blank: the
   *  surface renders it as "no date yet", which is a work item. */
  promisedAt: string | null;
  promiseSource: string | null;
  expectedPurchaseOrderId: string | null;
  expectedPurchaseOrderNumber: string | null;
  /** True only when there IS a promised date and it has gone by. An undated row
   *  is never overdue — you cannot be late for a date nobody set. */
  isOverdue: boolean;
  notifiedAt: string | null;
  createdAt: string;
}

export interface ListBackordersResult {
  items: BackorderRow[];
  total: number;
  /** Rows nobody could promise a date for. Counted separately because it is the
   *  buyer's actual work list, and because a screen that shows "0 overdue" while
   *  40 rows have no date at all is telling a comfortable lie. */
  undatedCount: number;
  overdueCount: number;
  /** Units owed across everything the filter matched. */
  unitsOutstanding: number;
}

export interface ListBackordersParams {
  status?: string;
  variantId?: string;
  warehouseId?: string;
  customerId?: string;
  undatedOnly?: boolean;
  overdueOnly?: boolean;
  take?: number;
  skip?: number;
}

interface BackorderQueryRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  quantity: number;
  allocatedQuantity: number;
  status: string;
  holderType: string;
  holderId: string;
  orderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  priority: number;
  position: number | null;
  promisedAt: Date | null;
  promiseSource: string | null;
  expectedPurchaseOrderId: string | null;
  expectedPurchaseOrderNumber: string | null;
  notifiedAt: Date | null;
  createdAt: Date;
  totalCount: number;
  undatedCount: number;
  overdueCount: number;
  unitsOutstanding: number;
}

export async function listBackorders(
  ctx: ServiceContext,
  params: ListBackordersParams = {}
): Promise<ListBackordersResult> {
  const take = Math.min(Math.max(params.take ?? 50, 1), 200);
  const skip = Math.max(params.skip ?? 0, 0);

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<BackorderQueryRow[]>`
      WITH ranked AS (
        SELECT b.*,
               -- The queue position, computed over the OPEN rows only and in the
               -- same order the allocator walks them. Rows that have left the
               -- queue get null rather than a stale number.
               CASE WHEN b.status IN ('open', 'partial')
                    THEN ROW_NUMBER() OVER (
                           PARTITION BY b.variant_id, b.warehouse_id, (b.status IN ('open','partial'))
                           ORDER BY b.priority DESC, b.created_at ASC
                         )
               END AS position
          FROM inventory_backorders b
         WHERE b.tenant_id = ${ctx.tenantId}::uuid
      ),
      filtered AS (
        SELECT * FROM ranked r
         WHERE (${params.status ?? null}::text     IS NULL OR r.status       = ${params.status ?? null})
           AND (${params.variantId ?? null}::uuid  IS NULL OR r.variant_id   = ${params.variantId ?? null}::uuid)
           AND (${params.warehouseId ?? null}::uuid IS NULL OR r.warehouse_id = ${params.warehouseId ?? null}::uuid)
           AND (${params.customerId ?? null}::uuid IS NULL OR r.customer_id  = ${params.customerId ?? null}::uuid)
           AND (${params.undatedOnly ?? false}::boolean = false
                OR (r.promised_at IS NULL AND r.status IN ('open', 'partial')))
           AND (${params.overdueOnly ?? false}::boolean = false
                OR (r.promised_at IS NOT NULL AND r.promised_at < now() AND r.status IN ('open', 'partial')))
      ),
      tallies AS (
        SELECT COUNT(*)::int AS total_count,
               COUNT(*) FILTER (
                 WHERE promised_at IS NULL AND status IN ('open', 'partial')
               )::int AS undated_count,
               COUNT(*) FILTER (
                 WHERE promised_at IS NOT NULL AND promised_at < now() AND status IN ('open', 'partial')
               )::int AS overdue_count,
               COALESCE(SUM(
                 CASE WHEN status IN ('open', 'partial')
                      THEN quantity - allocated_quantity ELSE 0 END
               ), 0)::int AS units_outstanding
          FROM filtered
      )
      SELECT f.id,
             f.variant_id          AS "variantId",
             v.sku                 AS "variantSku",
             v.title                AS "variantName",
             f.warehouse_id        AS "warehouseId",
             w.name                AS "warehouseName",
             f.quantity,
             f.allocated_quantity  AS "allocatedQuantity",
             f.status,
             f.holder_type         AS "holderType",
             f.holder_id           AS "holderId",
             o.order_number        AS "orderNumber",
             f.customer_id         AS "customerId",
             NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '') AS "customerName",
             f.priority,
             f.position::int       AS "position",
             f.promised_at         AS "promisedAt",
             f.promise_source      AS "promiseSource",
             f.expected_purchase_order_id AS "expectedPurchaseOrderId",
             po.number             AS "expectedPurchaseOrderNumber",
             f.notified_at         AS "notifiedAt",
             f.created_at          AS "createdAt",
             t.total_count         AS "totalCount",
             t.undated_count       AS "undatedCount",
             t.overdue_count       AS "overdueCount",
             t.units_outstanding   AS "unitsOutstanding"
        FROM filtered f
        CROSS JOIN tallies t
        LEFT JOIN commerce_product_variants v ON v.id = f.variant_id
        LEFT JOIN inventory_warehouses w      ON w.id = f.warehouse_id
        LEFT JOIN customers c                 ON c.id = f.customer_id
        LEFT JOIN inventory_purchase_orders po ON po.id = f.expected_purchase_order_id
        LEFT JOIN orders o
               ON f.holder_type = 'order' AND o.id = f.holder_id
       ORDER BY
         -- Undated first: they are the rows nobody can answer a customer about.
         (f.promised_at IS NULL AND f.status IN ('open', 'partial')) DESC,
         f.promised_at ASC NULLS LAST,
         f.created_at ASC
       LIMIT ${take} OFFSET ${skip}
    `;

    const first = rows[0];
    const now = Date.now();
    return {
      items: rows.map((r) => serializeBackorder(r, now)),
      total: first?.totalCount ?? 0,
      undatedCount: first?.undatedCount ?? 0,
      overdueCount: first?.overdueCount ?? 0,
      unitsOutstanding: first?.unitsOutstanding ?? 0,
    };
  });
}

function serializeBackorder(r: BackorderQueryRow, nowMs: number): BackorderRow {
  const open = r.status === 'open' || r.status === 'partial';
  return {
    id: r.id,
    variantId: r.variantId,
    variantSku: r.variantSku,
    variantName: r.variantName,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouseName,
    quantity: r.quantity,
    allocatedQuantity: r.allocatedQuantity,
    outstanding: Math.max(0, r.quantity - r.allocatedQuantity),
    status: r.status,
    holderType: r.holderType,
    holderId: r.holderId,
    orderNumber: r.orderNumber,
    customerId: r.customerId,
    customerName: r.customerName,
    priority: r.priority,
    position: r.position,
    promisedAt: r.promisedAt?.toISOString() ?? null,
    promiseSource: r.promiseSource,
    expectedPurchaseOrderId: r.expectedPurchaseOrderId,
    expectedPurchaseOrderNumber: r.expectedPurchaseOrderNumber,
    isOverdue: open && r.promisedAt != null && r.promisedAt.getTime() < nowMs,
    notifiedAt: r.notifiedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface BackorderAllocationRow {
  id: string;
  quantity: number;
  sourceType: string;
  sourceId: string | null;
  movementId: string | null;
  allocatedAt: string;
}

export interface BackorderDetail extends BackorderRow {
  note: string | null;
  allocations: BackorderAllocationRow[];
}

export async function getBackorder(ctx: ServiceContext, id: string): Promise<BackorderDetail> {
  const list = await listBackorders(ctx, { take: 200 });
  const row = list.items.find((b) => b.id === id);
  if (!row) throw new InventoryNotFoundError('Backorder', id);

  return withTenant(ctx, async (tx) => {
    const detail = await tx.backorder.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        note: true,
        allocations: {
          orderBy: { allocatedAt: 'asc' },
          select: {
            id: true,
            quantity: true,
            sourceType: true,
            sourceId: true,
            movementId: true,
            allocatedAt: true,
          },
        },
      },
    });
    if (!detail) throw new InventoryNotFoundError('Backorder', id);

    return {
      ...row,
      note: detail.note,
      allocations: detail.allocations.map((a) => ({
        id: a.id,
        quantity: a.quantity,
        sourceType: a.sourceType,
        sourceId: a.sourceId,
        movementId: a.movementId,
        allocatedAt: a.allocatedAt.toISOString(),
      })),
    };
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function updateBackorder(
  ctx: ServiceContext,
  id: string,
  input: UpdateBackorderInput
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.backorder.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!existing) throw new InventoryNotFoundError('Backorder', id);
    if (existing.status === 'cancelled' || existing.status === 'fulfilled') {
      throw new InventoryValidationError(
        `This commitment is already ${existing.status} — there is nothing left to promise.`
      );
    }

    const data: Record<string, unknown> = {};
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.note !== undefined) data.note = input.note;
    if (input.expectedPurchaseOrderId !== undefined) {
      data.expectedPurchaseOrderId = input.expectedPurchaseOrderId;
    }
    if (input.promisedAt !== undefined) {
      // A date typed by a person is always `manual`, whatever else is on the
      // row: they are asserting something the ledger does not know. Clearing it
      // clears the source too, or the CHECK constraint rejects the pair.
      data.promisedAt = input.promisedAt ? new Date(input.promisedAt) : null;
      data.promiseSource = input.promisedAt ? 'manual' : null;
    }
    if (Object.keys(data).length === 0) return;

    await tx.backorder.update({ where: { id }, data });
  });
}

export async function cancelBackorder(
  ctx: ServiceContext,
  id: string,
  reason: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.backorder.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!existing) throw new InventoryNotFoundError('Backorder', id);
    if (existing.status === 'cancelled') return;
    if (existing.status === 'fulfilled') {
      throw new InventoryValidationError('That commitment has already shipped.');
    }
    await tx.backorder.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date(), note: reason },
    });
  });
}

/** Record that the customer has been told the current date, so the next sweep
 *  can tell a SLIP from a date they already know about. */
export async function markBackorderNotified(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const row = await tx.backorder.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { promisedAt: true },
    });
    if (!row) throw new InventoryNotFoundError('Backorder', id);
    await tx.backorder.update({
      where: { id },
      data: { notifiedAt: new Date(), notifiedPromisedAt: row.promisedAt },
    });
  });
}

// ─── The nightly pass ────────────────────────────────────────────────────────

export interface BackorderSweepResult {
  /** Open commitments looked at. */
  considered: number;
  /** Rows that gained a date they did not have. */
  newlyDated: number;
  /** Rows whose date moved. */
  redated: number;
  /** Rows whose date moved far enough that the customer should hear about it. */
  worthTelling: number;
  /** Still nobody can say when. The honest headline. */
  stillUndated: number;
}

/**
 * Re-resolve every open commitment's date against today's purchase orders.
 *
 * The reason this runs nightly rather than once at order time: the buyer raises
 * the replenishment order AFTER the customer ordered, so the strongest kind of
 * date — a real PO with a real arrival — usually does not exist yet at the
 * moment the promise is first recorded. This is the pass that upgrades a row
 * from "no date" to "the 14th, from order PO-1043".
 *
 * A MANUAL date is never overwritten. Somebody typed it because they knew
 * something, and a sweep that silently replaces it with a computed date destroys
 * exactly the information that made it worth typing.
 */
export async function refreshBackorderPromises(ctx: ServiceContext): Promise<BackorderSweepResult> {
  return withTenant(ctx, async (tx) => {
    const open = await tx.backorder.findMany({
      where: { tenantId: ctx.tenantId, status: { in: ['open', 'partial'] } },
      select: {
        id: true,
        variantId: true,
        warehouseId: true,
        promisedAt: true,
        promiseSource: true,
        notifiedPromisedAt: true,
      },
    });

    let newlyDated = 0;
    let redated = 0;
    let worthTelling = 0;
    let stillUndated = 0;

    for (const row of open) {
      if (row.promiseSource === 'manual') continue;

      const next = await resolvePromiseForVariant(tx, ctx.tenantId, {
        variantId: row.variantId,
        warehouseId: row.warehouseId,
      });

      if (!next.promisedAt) {
        stillUndated += 1;
        continue;
      }

      const before = row.promisedAt;
      const changed = before?.getTime() !== next.promisedAt.getTime();
      if (!changed) continue;

      await tx.backorder.update({
        where: { id: row.id },
        data: {
          promisedAt: next.promisedAt,
          promiseSource: next.source,
          expectedPurchaseOrderId: next.purchaseOrderId,
        },
      });

      if (before) redated += 1;
      else newlyDated += 1;
      if (shouldRenotify(row.notifiedPromisedAt, next.promisedAt)) worthTelling += 1;
    }

    return {
      considered: open.length,
      newlyDated,
      redated,
      worthTelling,
      stillUndated,
    };
  });
}

// ─── What a customer is told ─────────────────────────────────────────────────

export interface VariantCommitmentSummary {
  variantId: string;
  /** Units owed across every open commitment at every location. */
  unitsOwed: number;
  /** How many people are in front of you — resolved for a specific holder by
   *  `positionFor`, and null here because "the queue" has no single position. */
  openCommitments: number;
  /** The soonest date ANY open commitment for this item has been promised, or
   *  null when none of them has one. A storefront renders null as "we will
   *  confirm a date" — never as an estimate, and never as silence. */
  soonestPromisedAt: string | null;
}

/**
 * What the storefront and the B2B portal are allowed to say about an item that
 * is not in stock.
 *
 * Deliberately narrow. It reports a date only where a date genuinely exists, and
 * it never exposes the queue's contents — how many other people are waiting is
 * the tenant's business, not a shopper's.
 */
export async function getVariantCommitmentSummary(
  ctx: ServiceContext,
  variantId: string
): Promise<VariantCommitmentSummary> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<
      { unitsOwed: number; openCommitments: number; soonestPromisedAt: Date | null }[]
    >`
      SELECT COALESCE(SUM(quantity - allocated_quantity), 0)::int AS "unitsOwed",
             COUNT(*)::int                                        AS "openCommitments",
             MIN(promised_at)                                     AS "soonestPromisedAt"
        FROM inventory_backorders
       WHERE tenant_id  = ${ctx.tenantId}::uuid
         AND variant_id = ${variantId}::uuid
         AND status IN ('open', 'partial')
    `;
    const row = rows[0];
    return {
      variantId,
      unitsOwed: row?.unitsOwed ?? 0,
      openCommitments: row?.openCommitments ?? 0,
      soonestPromisedAt: row?.soonestPromisedAt?.toISOString() ?? null,
    };
  });
}
