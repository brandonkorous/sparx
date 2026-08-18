// Dynamic reorder points (docs/146 Phase 7.4, 7.5, 7.9).
//
// Turns the measurements the other passes made — demand per day, its daily
// standard deviation, the measured supplier lead time and ITS standard deviation
// — into the two numbers a buyer actually uses: when to reorder, and how many.
//
//   safety stock  = z(service level) × √( LT·σ_d²  +  d²·σ_LT² )
//   reorder point = d × LT × seasonality  +  safety stock
//
// The arithmetic itself lives in `@wizeworks/commerce-schemas/planning`, shared with
// the API and the screen. This file is the plumbing: gather the inputs for every
// level, apply the shared functions, store the result, and record which inputs
// produced it.
//
// ── The consent rule ─────────────────────────────────────────────────────────
//
// The computed figure is written to `inventory_levels.dynamic_reorder_point`,
// which is a NEW column beside the existing `reorder_point` rather than on top
// of it. The operative trigger — the number the reorder engine and the
// `inventory.low` event actually read — is only overwritten where the level is
// explicitly auto-managed.
//
// This is the single most important decision in Phase 7 and it is a trust
// decision rather than a technical one. A buyer who typed 40 last spring and
// finds the system quietly buying at 87 has learned that the platform edits
// their settings behind their back, and there is no feature that earns that back.
// So the default is: show the difference, explain it, and let them adopt it.
// `autoApplyReorderPoints` in the planning policy flips the default for levels
// that have never had a point at all — where there is nothing to overwrite and
// the alternative is no warning at all.

import {
  reorderPoint as computeReorderPoint,
  safetyStock as computeSafetyStock,
  serviceLevelZ,
  suggestedOrderQuantity,
  SetReorderPolicyPlanningInput,
} from '@wizeworks/commerce-schemas';
import type { ServiceLevel } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

import { resolveLeadTimeOnTx } from './lead-times';
import type { ResolvedLeadTime } from './lead-times';
import { loadPlanningPolicy } from './planning-policy';

/** Levels planned per transaction. */
const PLAN_CHUNK = 100;

/** How many days of cover to buy on top of the reorder point. A fortnight is a
 *  sane review period for a business that looks at its buying weekly-ish; it is
 *  what keeps the suggested quantity from being "exactly enough to be low
 *  again tomorrow". */
const REVIEW_PERIOD_DAYS = 14;

export interface ReorderPolicyRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  /** null = following the tenant default. */
  serviceLevel: ServiceLevel | null;
  effectiveServiceLevel: ServiceLevel;
  leadTimeDaysOverride: number | null;
  safetyStockOverride: number | null;
  safetyStockUnits: number;
  computedReorderPoint: number;
  computedOrderQuantity: number;
  leadTimeDaysUsed: number;
  leadTimeStdDevUsed: number;
  leadTimeSource: ResolvedLeadTime['source'];
  isAutoManaged: boolean;
  /** Who decided: a person (final), the sweep under the tenant switch, or nobody
      yet. Lets a screen say "you set this" rather than only "it is on". */
  autoManagedDecidedBy: 'person' | 'sweep' | null;
  /** What the level actually triggers on today. */
  currentReorderPoint: number | null;
  /** True when the two disagree by enough to be worth a person's attention. */
  differsFromCurrent: boolean;
  appliedAt: string | null;
  computedAt: string;
}

export interface ReorderPlanResult {
  levelsPlanned: number;
  autoApplied: number;
  /** Levels where the computed point differs from the one in force. */
  divergent: number;
}

/** Everything one level's arithmetic needs, in one row. */
interface PlanInputRow {
  variantId: string;
  warehouseId: string;
  onHand: number;
  allocated: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  forecastPerDay: number | null;
  demandStdDev: number | null;
  /** Days of movement history behind the forecast. 0 (or null, meaning no
      velocity row at all) = this level has never been seen to move. */
  historyDays: number | null;
  seasonalityIndex: number | null;
  onOrder: number;
  minOrderQty: number | null;
  policyServiceLevel: string | null;
  policyLeadTimeOverride: number | null;
  policySafetyOverride: number | null;
  policyIsAutoManaged: boolean | null;
  /** person | sweep | null. Who decided, which is what makes the tenant switch
      able to act on some rows and forbidden from acting on others. */
  policyAutoManagedSource: string | null;
  /** The point the sweep last applied. Lets a release tell its own number apart
      from one a person has typed over the top since. */
  policyComputedPoint: number | null;
  policyExists: boolean;
}

/**
 * Plan every level (optionally one location).
 *
 * Runs AFTER the demand and lead-time passes — it consumes what they measured
 * and measures nothing itself. The sweep enforces that ordering; calling this
 * alone is legitimate and simply plans against whatever the last measurement
 * said, which is the honest behaviour.
 */
export async function recomputeReorderPoints(
  ctx: ServiceContext,
  filter: { warehouseId?: string } = {}
): Promise<ReorderPlanResult> {
  const warehouseId = filter.warehouseId ?? null;

  const { rows, defaultServiceLevel, autoApplyDefault } = await withTenant(ctx, async (tx) => {
    const policy = await loadPlanningPolicy(tx, ctx.tenantId);
    return {
      rows: await collectPlanInputs(tx, ctx.tenantId, warehouseId),
      defaultServiceLevel: policy.serviceLevel,
      autoApplyDefault: policy.autoApplyReorderPoints,
    };
  });

  let autoApplied = 0;
  let divergent = 0;

  for (let i = 0; i < rows.length; i += PLAN_CHUNK) {
    const chunk = rows.slice(i, i + PLAN_CHUNK);
    const outcome = await withTenant(ctx, async (tx) => {
      let applied = 0;
      let differing = 0;
      for (const row of chunk) {
        const result = await planOne(tx, ctx.tenantId, row, defaultServiceLevel, autoApplyDefault);
        if (result.applied) applied += 1;
        if (result.differs) differing += 1;
      }
      return { applied, differing };
    });
    autoApplied += outcome.applied;
    divergent += outcome.differing;
  }

  return { levelsPlanned: rows.length, autoApplied, divergent };
}

/**
 * Who owns this level's reorder point — the three-state consent rule.
 *
 * A PERSON's answer is final in both directions: they have looked at this level
 * and said yes or no, and a tenant-wide switch must not overrule that. Anything
 * else follows the switch, which is what makes the switch mean something.
 *
 * The `sweep` case is the subtle one, and the reason the source is recorded at
 * all. Once automation writes a point, the level HAS a reorder point — so the
 * plain test "adopt levels with no point of their own" would flip it straight
 * back to unmanaged on the very next run, undoing itself nightly. Remembering
 * that the sweep adopted it keeps it adopted, while still letting the switch
 * release it.
 */
function resolveAutoManaged(input: {
  source: string | null;
  stored: boolean | null;
  autoApplyDefault: boolean;
  hasOwnReorderPoint: boolean;
  /** False when the level has never been seen to move at all. */
  hasAnyHistory: boolean;
}): {
  managed: boolean;
  /** The level is being handed back: whatever automation wrote must come off. */
  release?: boolean;
  record: { isAutoManaged: boolean | null; autoManagedSource: string | null } | null;
} {
  if (input.source === 'person') {
    return { managed: input.stored ?? false, record: null };
  }
  if (input.source === 'sweep') {
    // Still adopted while the switch is on. When it goes off the level is handed
    // BACK — the record returns to undecided so a later opt-in can adopt it
    // again, which a sticky `false` would forbid forever.
    return input.autoApplyDefault
      ? { managed: true, record: null }
      : { managed: false, release: true, record: { isAutoManaged: null, autoManagedSource: null } };
  }
  // Undecided. Adopt only a level nobody has typed a point into, and write that
  // adoption down — leaving it NULL would re-ask the question every night
  // against a point this run just created.
  //
  // …and only where there is history to compute FROM. Without this an item that
  // has never moved gets adopted at a reorder point of 0, which is not "we
  // worked out you need none" but "we have never seen this item" wearing the
  // costume of an answer — and it makes the level look configured, so nobody
  // ever goes back to it. It becomes eligible the first sweep after its first
  // movement, which is the right moment.
  const adopt = input.autoApplyDefault && !input.hasOwnReorderPoint && input.hasAnyHistory;
  return {
    managed: adopt,
    record: adopt ? { isAutoManaged: true, autoManagedSource: 'sweep' } : null,
  };
}

/**
 * One level: resolve the lead time, run the two formulas, store the answer, and
 * write the fast-read copy.
 *
 * Consent lives in `resolveAutoManaged` above. Note what is NOT written when a
 * level stays unmanaged: nothing. Stamping `false` there is exactly the bug that
 * made the tenant switch inert — a default recorded as though it were a choice.
 */
async function planOne(
  tx: TxClient,
  tenantId: string,
  row: PlanInputRow,
  defaultServiceLevel: ServiceLevel,
  autoApplyDefault: boolean
): Promise<{ applied: boolean; differs: boolean }> {
  const leadTime = await resolveLeadTimeOnTx(tx, {
    tenantId,
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    levelLeadTimeDays: row.leadTimeDays,
  });
  const leadTimeDays = row.policyLeadTimeOverride ?? leadTime.days;
  // An overridden lead time is a stated one, so it carries no measured spread —
  // claiming the override is metronomic would inflate confidence, not reduce it.
  const leadTimeStdDev = row.policyLeadTimeOverride !== null ? 0 : leadTime.stdDevDays;
  const leadTimeSource: ResolvedLeadTime['source'] =
    row.policyLeadTimeOverride !== null ? 'level' : leadTime.source;

  const serviceLevel = (row.policyServiceLevel as ServiceLevel | null) ?? defaultServiceLevel;
  const demandPerDay = row.forecastPerDay ?? 0;

  const computedSafety = computeSafetyStock({
    demandPerDay,
    demandStdDev: row.demandStdDev ?? 0,
    leadTimeDays,
    leadTimeStdDev,
    z: serviceLevelZ(serviceLevel),
  });
  const safetyStockUnits = row.policySafetyOverride ?? computedSafety;

  const point = computeReorderPoint({
    demandPerDay,
    leadTimeDays,
    safetyStockUnits,
    seasonalityIndex: row.seasonalityIndex,
  });

  const orderQuantity = suggestedOrderQuantity({
    reorderPointUnits: point,
    available: row.onHand - row.allocated,
    onOrder: row.onOrder,
    demandPerDay,
    reviewPeriodDays: REVIEW_PERIOD_DAYS,
    minOrderQty: row.minOrderQty,
    fixedLot: row.reorderQuantity,
  });

  const consent = resolveAutoManaged({
    source: row.policyAutoManagedSource,
    stored: row.policyIsAutoManaged,
    autoApplyDefault,
    hasOwnReorderPoint: row.reorderPoint !== null,
    hasAnyHistory: (row.historyDays ?? 0) > 0,
  });
  const isAutoManaged = consent.managed;
  // Only reclaim the number automation itself last wrote. A person who has typed
  // over it since owns it now, and a release must not delete their work.
  const releasing =
    consent.release === true &&
    row.reorderPoint !== null &&
    row.reorderPoint === row.policyComputedPoint;

  const data = {
    safetyStockUnits,
    computedReorderPoint: point,
    computedOrderQuantity: orderQuantity,
    leadTimeDaysUsed: leadTimeDays,
    leadTimeStdDevUsed: leadTimeStdDev,
    leadTimeSource,
    computedAt: new Date(),
    ...(isAutoManaged ? { appliedAt: new Date() } : {}),
    // Only ever written when a decision was actually taken. An unmanaged level
    // keeps its NULL so the tenant switch can still reach it later.
    ...(consent.record ?? {}),
  };

  await tx.reorderPolicy.upsert({
    where: {
      variantId_warehouseId: { variantId: row.variantId, warehouseId: row.warehouseId },
    },
    create: {
      tenantId,
      variantId: row.variantId,
      warehouseId: row.warehouseId,
      ...data,
    },
    update: data,
  });

  await tx.inventoryLevel.update({
    where: {
      variantId_warehouseId: { variantId: row.variantId, warehouseId: row.warehouseId },
    },
    data: {
      dynamicReorderPoint: point,
      planningComputedAt: data.computedAt,
      // The ONE write that changes operational behaviour, and only with consent.
      ...(isAutoManaged ? { reorderPoint: point, reorderQuantity: orderQuantity } : {}),
      // Handing the level back: take the machine's number off with it. Leaving
      // it behind would be indistinguishable from a figure a person typed, and
      // the level could never be adopted again. Only OUR number is removed — if
      // somebody has typed over it since, that is theirs and it stays.
      ...(releasing ? { reorderPoint: null, reorderQuantity: null } : {}),
    },
  });

  return {
    applied: isAutoManaged,
    differs: !isAutoManaged && row.reorderPoint !== null && row.reorderPoint !== point,
  };
}

/**
 * Every input, per level, in one query.
 *
 * `onOrder` is the outstanding quantity on open purchase orders — the same
 * definition the reorder engine uses, so the suggested quantity here and the
 * one on the buying worklist cannot disagree.
 */
async function collectPlanInputs(
  tx: TxClient,
  tenantId: string,
  warehouseId: string | null,
  variantId: string | null = null
): Promise<PlanInputRow[]> {
  return tx.$queryRaw<PlanInputRow[]>`
    SELECT
      l.variant_id                                  AS "variantId",
      l.warehouse_id                                AS "warehouseId",
      l.on_hand                                     AS "onHand",
      l.allocated                                   AS "allocated",
      l.reorder_point                               AS "reorderPoint",
      l.reorder_quantity                            AS "reorderQuantity",
      l.lead_time_days                              AS "leadTimeDays",
      dv.forecast_per_day::float8                   AS "forecastPerDay",
      dv.demand_std_dev::float8                     AS "demandStdDev",
      dv.history_days::int                          AS "historyDays",
      dv.seasonality_index::float8                  AS "seasonalityIndex",
      COALESCE((
        SELECT SUM(pol.quantity_ordered - pol.quantity_received)
        FROM inventory_purchase_order_lines pol
        JOIN inventory_purchase_orders po ON po.id = pol.purchase_order_id
        WHERE pol.variant_id = l.variant_id
          AND po.warehouse_id = l.warehouse_id
          AND po.status IN ('draft','submitted','partial')
      ), 0)::int                                    AS "onOrder",
      sup.min_order_qty                             AS "minOrderQty",
      rp.service_level                              AS "policyServiceLevel",
      rp.lead_time_days_override                    AS "policyLeadTimeOverride",
      rp.safety_stock_override                      AS "policySafetyOverride",
      rp.is_auto_managed                            AS "policyIsAutoManaged",
      rp.auto_managed_source                        AS "policyAutoManagedSource",
      rp.computed_reorder_point                     AS "policyComputedPoint",
      (rp.variant_id IS NOT NULL)                   AS "policyExists"
    FROM inventory_levels l
    JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
    JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
    LEFT JOIN inventory_demand_velocity dv
      ON dv.variant_id = l.variant_id AND dv.warehouse_id = l.warehouse_id
    LEFT JOIN inventory_reorder_policies rp
      ON rp.variant_id = l.variant_id AND rp.warehouse_id = l.warehouse_id
    LEFT JOIN LATERAL (
      SELECT sv.min_order_qty
      FROM inventory_supplier_variants sv
      JOIN inventory_suppliers s ON s.id = sv.supplier_id
      WHERE sv.tenant_id = l.tenant_id AND sv.variant_id = l.variant_id
        AND s.deleted_at IS NULL AND s.is_active = true
      ORDER BY sv.is_preferred DESC, sv.unit_cost_cents ASC NULLS LAST
      LIMIT 1
    ) sup ON true
    WHERE l.tenant_id = ${tenantId}::uuid
      AND (${warehouseId}::uuid IS NULL OR l.warehouse_id = ${warehouseId}::uuid)
      AND (${variantId}::uuid IS NULL OR l.variant_id = ${variantId}::uuid)
  `;
}

// ─── Reads + the one write a person makes ────────────────────────────────────

export async function getReorderPlan(
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string }
): Promise<ReorderPolicyRow | null> {
  return withTenant(ctx, async (tx) => {
    const policy = await loadPlanningPolicy(tx, ctx.tenantId);
    const row = await tx.reorderPolicy.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      include: {
        variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
      },
    });
    if (!row) return null;
    const level = await tx.inventoryLevel.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      select: { reorderPoint: true },
    });
    return toPolicyRow(row, level?.reorderPoint ?? null, policy.serviceLevel);
  });
}

export interface ListReorderPlansFilter {
  warehouseId?: string;
  /** Only levels whose computed point disagrees with the one in force — the
   *  list a buyer reviews when deciding what to adopt. */
  divergentOnly?: boolean;
  autoManagedOnly?: boolean;
  take?: number;
  skip?: number;
}

export async function listReorderPlans(
  ctx: ServiceContext,
  filter: ListReorderPlansFilter = {}
): Promise<{ items: ReorderPolicyRow[]; total: number }> {
  const take = Math.min(filter.take ?? 50, 250);
  const skip = Math.max(filter.skip ?? 0, 0);

  return withTenant(ctx, async (tx) => {
    const policy = await loadPlanningPolicy(tx, ctx.tenantId);
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.autoManagedOnly ? { isAutoManaged: true } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.reorderPolicy.findMany({
        where,
        orderBy: [{ computedReorderPoint: 'desc' }],
        take,
        skip,
        include: {
          variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
        },
      }),
      tx.reorderPolicy.count({ where }),
    ]);

    // The level's live trigger is read alongside so "differs" is a fact rather
    // than a stale flag — the point can be edited by hand at any moment.
    const levels = await tx.inventoryLevel.findMany({
      where: {
        tenantId: ctx.tenantId,
        OR: rows.map((r) => ({ variantId: r.variantId, warehouseId: r.warehouseId })),
      },
      select: { variantId: true, warehouseId: true, reorderPoint: true },
    });
    const byKey = new Map(levels.map((l) => [`${l.variantId}::${l.warehouseId}`, l.reorderPoint]));

    const items = rows
      .map((r) =>
        toPolicyRow(r, byKey.get(`${r.variantId}::${r.warehouseId}`) ?? null, policy.serviceLevel)
      )
      .filter((r) => !filter.divergentOnly || r.differsFromCurrent);

    return { items, total: filter.divergentOnly ? items.length : total };
  });
}

/**
 * Set the planning inputs for one level, or hand it to the maths.
 *
 * Turning `isAutoManaged` ON applies the computed point IMMEDIATELY rather than
 * waiting for tonight's sweep. Someone who just chose to trust the number
 * expects it to be in force; telling them it takes effect at 4am is how a
 * setting gets toggled three times while somebody checks whether it worked.
 */
export async function setReorderPlanningPolicy(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<ReorderPolicyRow> {
  const input = SetReorderPolicyPlanningInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const level = await tx.inventoryLevel.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      select: { reorderPoint: true },
    });
    if (!level) {
      throw new InventoryNotFoundError('InventoryLevel', `${input.variantId}@${input.warehouseId}`);
    }

    const before = await tx.reorderPolicy.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
    });

    const patch = {
      ...(input.serviceLevel !== undefined ? { serviceLevel: input.serviceLevel ?? null } : {}),
      ...(input.leadTimeDaysOverride !== undefined
        ? { leadTimeDaysOverride: input.leadTimeDaysOverride ?? null }
        : {}),
      ...(input.safetyStockOverride !== undefined
        ? { safetyStockOverride: input.safetyStockOverride ?? null }
        : {}),
      // Stamped `person`, which is what makes it final: from here the tenant-wide
      // switch never overrides this level in either direction. Somebody looked at
      // THIS item and answered the question.
      ...(input.isAutoManaged !== undefined
        ? { isAutoManaged: input.isAutoManaged, autoManagedSource: 'person' }
        : {}),
    };

    await tx.reorderPolicy.upsert({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      create: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        ...patch,
      },
      update: patch,
    });

    // Re-plan this one level so the stored figures reflect the new inputs before
    // anybody reads them back.
    const [row] = await collectPlanInputs(tx, ctx.tenantId, input.warehouseId, input.variantId);
    const policy = await loadPlanningPolicy(tx, ctx.tenantId);
    if (row) {
      await planOne(tx, ctx.tenantId, row, policy.serviceLevel, policy.autoApplyReorderPoints);
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.reorder_policy.planning_set',
      entityType: 'ReorderPolicy',
      // entity_id is a single UUID — key on the variant, carry the warehouse in
      // the diff, exactly as `setReorderPolicy` does.
      entityId: input.variantId,
      diff: {
        before: {
          serviceLevel: before?.serviceLevel ?? null,
          leadTimeDaysOverride: before?.leadTimeDaysOverride ?? null,
          safetyStockOverride: before?.safetyStockOverride ?? null,
          isAutoManaged: before?.isAutoManaged ?? false,
        },
        after: { warehouseId: input.warehouseId, ...patch },
      },
    });

    const after = await tx.reorderPolicy.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      include: {
        variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
      },
    });
    const liveLevel = await tx.inventoryLevel.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      select: { reorderPoint: true },
    });
    // The upsert above guarantees the row exists.
    return toPolicyRow(after!, liveLevel?.reorderPoint ?? null, policy.serviceLevel);
  });
}

/**
 * Adopt the computed point for one level: copy it onto the operative trigger,
 * once, without turning on nightly management.
 *
 * The middle option between "leave it alone" and "let the maths drive". It is
 * the one most buyers actually want the first few times — take today's number,
 * keep the wheel.
 */
export async function applyComputedReorderPoint(
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string }
): Promise<ReorderPolicyRow> {
  return withTenant(ctx, async (tx) => {
    const plan = await tx.reorderPolicy.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      include: {
        variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
      },
    });
    if (!plan) {
      throw new InventoryNotFoundError('ReorderPolicy', `${input.variantId}@${input.warehouseId}`);
    }
    const level = await tx.inventoryLevel.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      select: { reorderPoint: true },
    });

    await tx.inventoryLevel.update({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      data: {
        reorderPoint: plan.computedReorderPoint,
        reorderQuantity: plan.computedOrderQuantity > 0 ? plan.computedOrderQuantity : null,
      },
    });
    await tx.reorderPolicy.update({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
      data: { appliedAt: new Date() },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.reorder_policy.computed_applied',
      entityType: 'InventoryLevel',
      entityId: input.variantId,
      diff: {
        before: { reorderPoint: level?.reorderPoint ?? null },
        after: {
          warehouseId: input.warehouseId,
          reorderPoint: plan.computedReorderPoint,
        },
      },
    });

    const policy = await loadPlanningPolicy(tx, ctx.tenantId);
    return toPolicyRow(plan, plan.computedReorderPoint, policy.serviceLevel);
  });
}

function toPolicyRow(
  row: {
    variantId: string;
    warehouseId: string;
    serviceLevel: string | null;
    leadTimeDaysOverride: number | null;
    safetyStockOverride: number | null;
    safetyStockUnits: number;
    computedReorderPoint: number;
    computedOrderQuantity: number;
    leadTimeDaysUsed: unknown;
    leadTimeStdDevUsed: unknown;
    leadTimeSource: string;
    isAutoManaged: boolean | null;
    autoManagedSource: string | null;
    appliedAt: Date | null;
    computedAt: Date;
    variant?: {
      sku: string | null;
      title: string | null;
      product?: { title: string } | null;
    } | null;
  },
  currentReorderPoint: number | null,
  defaultServiceLevel: ServiceLevel
): ReorderPolicyRow {
  return {
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    sku: row.variant?.sku ?? null,
    title: row.variant?.product?.title ?? row.variant?.title ?? null,
    serviceLevel: (row.serviceLevel as ServiceLevel | null) ?? null,
    effectiveServiceLevel: (row.serviceLevel as ServiceLevel | null) ?? defaultServiceLevel,
    leadTimeDaysOverride: row.leadTimeDaysOverride,
    safetyStockOverride: row.safetyStockOverride,
    safetyStockUnits: row.safetyStockUnits,
    computedReorderPoint: row.computedReorderPoint,
    computedOrderQuantity: row.computedOrderQuantity,
    leadTimeDaysUsed: Number(row.leadTimeDaysUsed),
    leadTimeStdDevUsed: Number(row.leadTimeStdDevUsed),
    leadTimeSource: row.leadTimeSource as ResolvedLeadTime['source'],
    isAutoManaged: row.isAutoManaged ?? false,
    autoManagedDecidedBy: (row.autoManagedSource as 'person' | 'sweep' | null) ?? null,
    currentReorderPoint,
    differsFromCurrent:
      currentReorderPoint !== null && currentReorderPoint !== row.computedReorderPoint,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    computedAt: row.computedAt.toISOString(),
  };
}
