// Expiring stock (docs/146 Phase 9.8) — the money that goes off.
//
// A business that carries dated goods loses more to the calendar than to theft,
// and the loss is entirely avoidable: a batch 60 days out can be promoted, a
// batch 30 days out can be marked down, and a batch that expired last Tuesday is
// a write-off that has already happened whether or not anybody has recorded it.
//
// ── The horizons ─────────────────────────────────────────────────────────────
//
// 30 / 60 / 90 is the category convention, and it earns its place by mapping
// onto what a person can actually DO: 90 days is a purchasing decision (stop
// buying it), 60 is a promotion, 30 is a markdown. A single "expiring soon"
// flag collapses three different responses into one shrug.
//
// ── Undated is its own bucket ────────────────────────────────────────────────
//
// A lot with no expiry date is NOT a lot that expires late, and folding it into
// "beyond 90 days" would paint a reassuring green row over a data-entry gap. For
// a business that needs to track expiry, "we do not know when this goes off" is
// among the most useful things the report can say.
//
// ── FEFO enforcement ─────────────────────────────────────────────────────────
//
// `resolveFefoLot` (pick-allocation.ts) picks the nearest expiry that is not
// recalled. Phase 9 adds the obvious missing clause: not already EXPIRED either.
// Shipping expired goods because they happened to sort first is the precise
// failure FEFO exists to prevent, and the old query would do it every time.

import { withTenant } from '@wizeworks/db';
import {
  EXPIRY_HORIZON_DAYS,
  MarkdownExpiringLotInput,
  WriteOffExpiringLotInput,
  daysUntilExpiry,
  expiryBucket,
  type ExpiryBucket,
} from '@wizeworks/commerce-schemas';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
  type ServiceContext,
} from '../errors';
import { publishInventoryEvent } from '../events';

import { systemBinFor } from './bin-routing';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';

export interface ExpiringLotRow {
  lotId: string;
  lotNumber: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  quantity: number;
  /** Null when the batch carries no expiry date. Rendered as "no date recorded",
   *  never as a far-future one. */
  expiresAt: string | null;
  /** Null when undated. Negative once past. */
  daysRemaining: number | null;
  bucket: ExpiryBucket;
  /** What the units cost, so the report can be sorted by money rather than by
   *  date — 400 units of a cheap consumable and 3 units of something expensive
   *  are not the same problem. Null when nothing has ever costed this item; a
   *  zero here would rank a real exposure last. */
  valueCents: number | null;
  recallStatus: string | null;
  /** Null when nobody has been told. NOT the same as "fine". */
  alertedAt: string | null;
}

export interface ExpiringStockReport {
  items: ExpiringLotRow[];
  /** Counts and money by horizon. The headline: how much is about to be lost. */
  buckets: {
    bucket: ExpiryBucket;
    lots: number;
    units: number;
    /** Null when NONE of the lots in the bucket could be costed — reporting
     *  $0 for a bucket holding 900 units is the "absence as measurement"
     *  failure this codebase keeps having to relearn. */
    valueCents: number | null;
    /** How many of the bucket's lots had no cost to value. */
    uncostedLots: number;
  }[];
  /** Lots carrying no expiry date at all. A data-entry finding, surfaced rather
   *  than counted as safe. */
  undatedLots: number;
}

interface RawLot {
  lotId: string;
  lotNumber: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  quantity: number;
  expiresAt: Date | null;
  unitCostCents: number | null;
  recallStatus: string | null;
  alertedAt: Date | null;
}

export interface ExpiringStockFilter {
  /** Horizon in days. Anything expiring within it, plus everything already
   *  expired. Defaults to the widest horizon so the report opens complete. */
  withinDays?: number;
  warehouseId?: string;
  /** Include batches with no date. On by default — they are a finding. */
  includeUndated?: boolean;
}

/**
 * Every batch with time running out, bucketed and priced.
 *
 * Reads `inventory_lot_batches.quantity`, which is the as-shipped batch count,
 * NOT the level's on-hand. The two can differ, and where they do the batch count
 * is the right one here: the question is "how much of THIS batch is left to go
 * off", and a level aggregates every batch of the item together.
 */
export async function listExpiringStock(
  ctx: ServiceContext,
  filter: ExpiringStockFilter = {}
): Promise<ExpiringStockReport> {
  const horizon = filter.withinDays ?? EXPIRY_HORIZON_DAYS[EXPIRY_HORIZON_DAYS.length - 1];
  const includeUndated = filter.includeUndated ?? true;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<RawLot[]>`
      SELECT lb.id            AS "lotId",
             lb.lot_number    AS "lotNumber",
             lb.variant_id    AS "variantId",
             v.sku            AS "variantSku",
             v.title           AS "variantName",
             lb.warehouse_id  AS "warehouseId",
             w.name           AS "warehouseName",
             lb.quantity,
             lb.expires_at    AS "expiresAt",
             -- Null when nothing has costed the item. Deliberately no COALESCE
             -- to zero: an uncosted lot must rank as unknown, not as worthless.
             COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents) AS "unitCostCents",
             lb.recall_status     AS "recallStatus",
             lb.expiry_alerted_at AS "alertedAt"
        FROM inventory_lot_batches lb
        LEFT JOIN commerce_product_variants v ON v.id = lb.variant_id
        LEFT JOIN inventory_warehouses w      ON w.id = lb.warehouse_id
        LEFT JOIN inventory_levels l
               ON l.variant_id = lb.variant_id AND l.warehouse_id = lb.warehouse_id
       WHERE lb.tenant_id = ${ctx.tenantId}::uuid
         AND lb.quantity > 0
         AND (${filter.warehouseId ?? null}::uuid IS NULL
              OR lb.warehouse_id = ${filter.warehouseId ?? null}::uuid)
         AND (
              (lb.expires_at IS NOT NULL
               AND lb.expires_at < now() + make_interval(days => ${horizon}::int))
           OR (${includeUndated}::boolean AND lb.expires_at IS NULL)
         )
       ORDER BY lb.expires_at ASC NULLS LAST
       LIMIT 1000
    `;

    const now = new Date();
    const items: ExpiringLotRow[] = rows.map((r) => ({
      lotId: r.lotId,
      lotNumber: r.lotNumber,
      variantId: r.variantId,
      variantSku: r.variantSku,
      variantName: r.variantName,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouseName,
      quantity: r.quantity,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      daysRemaining: daysUntilExpiry(r.expiresAt, now),
      bucket: expiryBucket(r.expiresAt, now),
      valueCents: r.unitCostCents == null ? null : r.quantity * r.unitCostCents,
      recallStatus: r.recallStatus,
      alertedAt: r.alertedAt?.toISOString() ?? null,
    }));

    const order: ExpiryBucket[] = ['expired', 'd30', 'd60', 'd90', 'beyond', 'undated'];
    const buckets = order
      .map((bucket) => {
        const inBucket = items.filter((i) => i.bucket === bucket);
        const costed = inBucket.filter((i) => i.valueCents !== null);
        return {
          bucket,
          lots: inBucket.length,
          units: inBucket.reduce((s, i) => s + i.quantity, 0),
          valueCents:
            costed.length === 0 ? null : costed.reduce((s, i) => s + (i.valueCents ?? 0), 0),
          uncostedLots: inBucket.length - costed.length,
        };
      })
      .filter((b) => b.lots > 0);

    return {
      items,
      buckets,
      undatedLots: items.filter((i) => i.bucket === 'undated').length,
    };
  });
}

// ─── Acting on it ────────────────────────────────────────────────────────────

/**
 * Mark a batch's item down.
 *
 * Applies to the VARIANT's compare-at/price pair, not to the batch, because a
 * price is a property of what you sell and not of which box it came from. The
 * lot is what identified the problem; the markdown is an ordinary price change
 * with a note saying why. Pretending otherwise would need per-batch pricing
 * everywhere from the PDP to the till, which is a far larger feature than the
 * one that is warranted here.
 */
export async function markdownExpiringLot(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ variantId: string; priceCentsBefore: number; priceCentsAfter: number }> {
  const input = MarkdownExpiringLotInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const lot = await tx.lotBatch.findFirst({
      where: { id: input.lotId, tenantId: ctx.tenantId },
      select: { variantId: true, lotNumber: true, expiresAt: true },
    });
    if (!lot) throw new InventoryNotFoundError('LotBatch', input.lotId);

    const variant = await tx.productVariant.findFirst({
      where: { id: lot.variantId, deletedAt: null },
      select: { id: true, priceCents: true, compareAtPriceCents: true },
    });
    if (!variant) throw new InventoryNotFoundError('ProductVariant', lot.variantId);

    const before = variant.priceCents;
    const after = Math.max(1, Math.round(before * (1 - input.discountPercent / 100)));

    await tx.productVariant.update({
      where: { id: variant.id },
      data: {
        priceCents: after,
        // Keep the original visible as the struck-through price, but only if
        // there was not already one. Overwriting an existing compare-at would
        // erase a sale price the merchant set deliberately and make the discount
        // look bigger than it is.
        ...(variant.compareAtPriceCents == null ? { compareAtPriceCents: before } : {}),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.lot.marked_down',
      entityType: 'LotBatch',
      entityId: input.lotId,
      diff: {
        before: { priceCents: before },
        after: {
          priceCents: after,
          discountPercent: input.discountPercent,
          lotNumber: lot.lotNumber,
          expiresAt: lot.expiresAt?.toISOString() ?? null,
          note: input.note ?? null,
        },
      },
    });

    return { variantId: variant.id, priceCentsBefore: before, priceCentsAfter: after };
  });
}

/**
 * Write a batch off.
 *
 * A `loss` movement, not a `damage` one. The goods are not broken — they ran out
 * of time, which is a different failure with a different fix (buy less, or sell
 * faster), and a shrinkage report that cannot tell the two apart sends people
 * looking for a thief who does not exist.
 *
 * The units go to the DAMAGED shelf on their way out: they are physically still
 * in the building until somebody carries them to a skip, and recording them on
 * the pick face would send a picker to a box of expired stock.
 */
export async function writeOffExpiringLot(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ unitsWrittenOff: number; valueCents: number | null }> {
  const input = WriteOffExpiringLotInput.parse(rawInput);

  const outcome = await withTenant(ctx, async (tx) => {
    const lot = await tx.lotBatch.findFirst({
      where: { id: input.lotId, tenantId: ctx.tenantId },
      select: {
        id: true,
        variantId: true,
        warehouseId: true,
        quantity: true,
        lotNumber: true,
        expiresAt: true,
      },
    });
    if (!lot) throw new InventoryNotFoundError('LotBatch', input.lotId);
    if (lot.quantity <= 0) {
      throw new InventoryConflictError('That batch is already empty.', 'quantity');
    }

    const quantity = Math.min(input.quantity ?? lot.quantity, lot.quantity);
    if (quantity <= 0) {
      throw new InventoryValidationError('Write off at least one unit.');
    }

    const binId = await systemBinFor(tx, lot.warehouseId, 'damaged');

    const result = await applyMovement(tx, {
      tenantId: ctx.tenantId,
      variantId: lot.variantId,
      warehouseId: lot.warehouseId,
      delta: -quantity,
      // `loss`, never `damage` — see the docstring.
      reason: 'loss',
      referenceType: 'LotBatch',
      referenceId: lot.id,
      note: `Expired batch ${lot.lotNumber}: ${input.reason}`,
      actorType: resolveActorType(ctx),
      actorId: ctx.userId ?? null,
      idempotencyKey: `lot-expiry-writeoff:${lot.id}:${lot.quantity}`,
      ...(binId ? { binId } : {}),
    });

    await tx.lotBatch.update({
      where: { id: lot.id },
      data: { quantity: lot.quantity - quantity },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.lot.written_off',
      entityType: 'LotBatch',
      entityId: lot.id,
      diff: {
        before: { quantity: lot.quantity },
        after: {
          quantity: lot.quantity - quantity,
          unitsWrittenOff: quantity,
          reason: input.reason,
          expiresAt: lot.expiresAt?.toISOString() ?? null,
        },
      },
    });

    return {
      variantId: lot.variantId,
      warehouseId: lot.warehouseId,
      quantity,
      result,
      // What it cost, from the movement itself. Null when the ledger could not
      // cost it — an unpriced write-off is a real state and $0.00 is not it.
      valueCents: result.costConsumedCents,
    };
  });

  await emitStockEvents(
    ctx,
    outcome.variantId,
    outcome.warehouseId,
    outcome.result,
    -outcome.quantity,
    'loss'
  );

  return { unitsWrittenOff: outcome.quantity, valueCents: outcome.valueCents };
}

// ─── The nightly pass ────────────────────────────────────────────────────────

export interface ExpirySweepResult {
  /** Dated batches with stock, looked at. */
  considered: number;
  /** Batches that crossed into the nearest horizon tonight — one event each. */
  newlyFlagged: number;
  /** Already past their date and still holding stock. The number that should be
   *  zero and rarely is. */
  expired: number;
  /** Batches with stock and no date. Counted, never treated as safe. */
  undated: number;
}

/** How close a lot gets before it is worth interrupting somebody. The nearest
 *  horizon: 60 days is a plan, 30 days is a deadline. */
const ALERT_HORIZON_DAYS = EXPIRY_HORIZON_DAYS[0];

/**
 * Flag batches that have crossed into the nearest horizon, once each.
 *
 * Runs as a stage of the existing nightly planning pass rather than as its own
 * CronJob — the same argument as the supplier scorecards and the late-order
 * sweep: one pass over the catalogue, one place to look when it did not run.
 */
export async function sweepExpiringLots(ctx: ServiceContext): Promise<ExpirySweepResult> {
  const toAnnounce = await withTenant(ctx, async (tx) => {
    const counts = await tx.$queryRaw<{ considered: number; expired: number; undated: number }[]>`
      SELECT COUNT(*) FILTER (WHERE expires_at IS NOT NULL)::int AS "considered",
             COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < now())::int AS "expired",
             COUNT(*) FILTER (WHERE expires_at IS NULL)::int AS "undated"
        FROM inventory_lot_batches
       WHERE tenant_id = ${ctx.tenantId}::uuid
         AND quantity > 0
    `;

    const crossing = await tx.$queryRaw<
      {
        lotId: string;
        lotNumber: string;
        variantId: string;
        warehouseId: string;
        quantity: number;
        expiresAt: Date;
      }[]
    >`
      SELECT id           AS "lotId",
             lot_number   AS "lotNumber",
             variant_id   AS "variantId",
             warehouse_id AS "warehouseId",
             quantity,
             expires_at   AS "expiresAt"
        FROM inventory_lot_batches
       WHERE tenant_id         = ${ctx.tenantId}::uuid
         AND quantity          > 0
         AND expires_at        IS NOT NULL
         AND expiry_alerted_at IS NULL
         AND expires_at        < now() + make_interval(days => ${ALERT_HORIZON_DAYS}::int)
       ORDER BY expires_at ASC
       LIMIT 500
    `;

    if (crossing.length > 0) {
      await tx.lotBatch.updateMany({
        where: { id: { in: crossing.map((c) => c.lotId) } },
        data: { expiryAlertedAt: new Date() },
      });
    }

    const c = counts[0];
    return {
      crossing,
      considered: c?.considered ?? 0,
      expired: c?.expired ?? 0,
      undated: c?.undated ?? 0,
    };
  });

  const now = new Date();
  for (const lot of toAnnounce.crossing) {
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      actorId: null,
      topic: 'inventory.lot.expiring',
      data: {
        lotId: lot.lotId,
        lotNumber: lot.lotNumber,
        variantId: lot.variantId,
        warehouseId: lot.warehouseId,
        quantity: lot.quantity,
        expiresAt: lot.expiresAt.toISOString(),
        daysRemaining: daysUntilExpiry(lot.expiresAt, now),
      },
    });
  }

  return {
    considered: toAnnounce.considered,
    newlyFlagged: toAnnounce.crossing.length,
    expired: toAnnounce.expired,
    undated: toAnnounce.undated,
  };
}

/**
 * Clear a batch's alert stamp because its DATE changed.
 *
 * Correcting a mis-keyed year, or a supplier re-certifying a batch, makes the
 * old announcement stale — the lot deserves to be able to raise its hand again
 * against the new date. Called by whatever edits `expiresAt`.
 */
export async function rearmExpiryAlert(ctx: ServiceContext, lotId: string): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.lotBatch.updateMany({
      where: { id: lotId, tenantId: ctx.tenantId },
      data: { expiryAlertedAt: null },
    })
  );
}
