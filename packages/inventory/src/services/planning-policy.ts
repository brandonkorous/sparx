// How this business plans (docs/146 Phase 7).
//
// One row per tenant, absent by default, and absent means the platform defaults
// — so a business that never opens the setting still gets a working forecast.
// Exactly the contract `CostingPolicy` uses, for the same reason: a planning
// feature that requires configuration before it produces anything is a planning
// feature nobody switches on.
//
// The five things a business can genuinely have an opinion about:
//
//   • how often they intend to be in stock (the service level)
//   • what it costs them to keep stock for a year (the carrying rate)
//   • where the ABC cuts fall, and where the XYZ ones do
//   • how much cover counts as too much, and how long idle counts as dead
//   • whether the maths is allowed to move a reorder point on its own
//
// Everything else is measured, not chosen.

import { UpdatePlanningPolicyInput } from '@sparx/commerce-schemas';
import type { ServiceLevel } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';

export const DEFAULT_PLANNING_POLICY = {
  serviceLevel: 'p95' as ServiceLevel,
  holdingCostRatePct: 25,
  abcAThresholdPct: 80,
  abcBThresholdPct: 95,
  xyzXMaxCv: 0.5,
  xyzYMaxCv: 1,
  overstockCoverDays: 180,
  deadStockDays: 180,
  autoApplyReorderPoints: false,
  minSeasonalityHistoryDays: 365,
} as const;

export interface PlanningPolicyRow {
  serviceLevel: ServiceLevel;
  holdingCostRatePct: number;
  abcAThresholdPct: number;
  abcBThresholdPct: number;
  xyzXMaxCv: number;
  xyzYMaxCv: number;
  overstockCoverDays: number;
  deadStockDays: number;
  autoApplyReorderPoints: boolean;
  minSeasonalityHistoryDays: number;
  /** When the nightly pass last ran. Null means never — and every planning
   *  figure on every screen is then honestly absent rather than zero. */
  lastSweepAt: string | null;
  /** False until someone has actually chosen, so the surface can say "using the
   *  standard settings" rather than implying a decision nobody made. */
  configured: boolean;
  updatedAt: string | null;
}

export async function getPlanningPolicy(ctx: ServiceContext): Promise<PlanningPolicyRow> {
  return withTenant(ctx, (tx) => loadPlanningPolicy(tx, ctx.tenantId));
}

export async function loadPlanningPolicy(
  tx: TxClient,
  tenantId: string
): Promise<PlanningPolicyRow> {
  const row = await tx.inventoryPlanningPolicy.findFirst({ where: { tenantId } });
  if (!row) {
    return {
      ...DEFAULT_PLANNING_POLICY,
      lastSweepAt: null,
      configured: false,
      updatedAt: null,
    };
  }
  return {
    serviceLevel: row.serviceLevel as ServiceLevel,
    holdingCostRatePct: Number(row.holdingCostRatePct),
    abcAThresholdPct: Number(row.abcAThresholdPct),
    abcBThresholdPct: Number(row.abcBThresholdPct),
    xyzXMaxCv: Number(row.xyzXMaxCv),
    xyzYMaxCv: Number(row.xyzYMaxCv),
    overstockCoverDays: row.overstockCoverDays,
    deadStockDays: row.deadStockDays,
    autoApplyReorderPoints: row.autoApplyReorderPoints,
    minSeasonalityHistoryDays: row.minSeasonalityHistoryDays,
    lastSweepAt: row.lastSweepAt?.toISOString() ?? null,
    configured: true,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Set the policy. Creates the row on first use.
 *
 * Changing a threshold does NOT reclassify anything on the spot — the next sweep
 * does, and it says when it ran. Recomputing a whole catalogue inside a settings
 * save is a request that times out on the tenants who most need it, and a
 * classification that changed while someone was reading the screen is worse than
 * one that changes tonight.
 */
export async function updatePlanningPolicy(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<PlanningPolicyRow> {
  const input = UpdatePlanningPolicyInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await loadPlanningPolicy(tx, ctx.tenantId);
    const merged = { ...before, ...stripUndefined(input) };

    await tx.inventoryPlanningPolicy.upsert({
      where: { tenantId: ctx.tenantId },
      create: {
        tenantId: ctx.tenantId,
        serviceLevel: merged.serviceLevel,
        holdingCostRatePct: merged.holdingCostRatePct,
        abcAThresholdPct: merged.abcAThresholdPct,
        abcBThresholdPct: merged.abcBThresholdPct,
        xyzXMaxCv: merged.xyzXMaxCv,
        xyzYMaxCv: merged.xyzYMaxCv,
        overstockCoverDays: merged.overstockCoverDays,
        deadStockDays: merged.deadStockDays,
        autoApplyReorderPoints: merged.autoApplyReorderPoints,
        minSeasonalityHistoryDays: merged.minSeasonalityHistoryDays,
      },
      update: {
        serviceLevel: merged.serviceLevel,
        holdingCostRatePct: merged.holdingCostRatePct,
        abcAThresholdPct: merged.abcAThresholdPct,
        abcBThresholdPct: merged.abcBThresholdPct,
        xyzXMaxCv: merged.xyzXMaxCv,
        xyzYMaxCv: merged.xyzYMaxCv,
        overstockCoverDays: merged.overstockCoverDays,
        deadStockDays: merged.deadStockDays,
        autoApplyReorderPoints: merged.autoApplyReorderPoints,
        minSeasonalityHistoryDays: merged.minSeasonalityHistoryDays,
      },
    });

    const after = await loadPlanningPolicy(tx, ctx.tenantId);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.planning_policy.updated',
      entityType: 'InventoryPlanningPolicy',
      entityId: ctx.tenantId,
      diff: { before: { ...before }, after: { ...after } },
    });
    return after;
  });
}

/** Stamp when the sweep last completed, so every screen can date its numbers. */
export async function markSweepCompleted(tx: TxClient, tenantId: string): Promise<void> {
  await tx.inventoryPlanningPolicy.upsert({
    where: { tenantId },
    create: { tenantId, lastSweepAt: new Date() },
    update: { lastSweepAt: new Date() },
  });
}

/** `undefined` means "not sent" in a patch; it must never overwrite a value. */
function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}
