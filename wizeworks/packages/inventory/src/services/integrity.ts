// Inventory integrity — the ledger checking itself (docs/146 Phase 1).
//
// `applyMovement()` guarantees `on_hand == Σ(inventory_movements.delta)` by
// construction: it is the only writer, and it appends the movement inside the
// same row lock that mutates the level. That is a strong guarantee. It is also,
// until something re-derives it, a BELIEF — and "my inventory numbers are wrong"
// is the single most common complaint in this category (44.8% of operators name
// it a top challenge). Every competitor asks to be trusted on this. This module
// is how we get to be checked instead.
//
// Two capabilities, both pure observability:
//
//   RECONCILIATION — a pass re-derives Σ(delta) per (variant, warehouse) and
//   compares it to the recorded on-hand. A clean pass is a POSITIVE result worth
//   showing an operator; silence is not reassurance. A drift is an alarm.
//
//   OVERSELL INCIDENTS — one row every time the platform refused a sale for lack
//   of stock, or took one it could not cover. Normally this is diagnosed after
//   the refund, from an order and a memory; here it is diagnosed at the moment it
//   happens, with the policy, the numbers, and the feed age attached.
//
// NEITHER EVER MUTATES STOCK. A drift is not auto-corrected — writing the derived
// value over the recorded one would destroy the evidence, and if the ledger is
// the corrupted side it would propagate the corruption. Resolution is an explicit
// human act (post a count). And an incident write must never be able to fail the
// sale it is describing; see `recordOversellIncidentDetached`.

import { RunReconciliationInput } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

// ─── Reconciliation ────────────────────────────────────────────────────────────

export interface ReconciliationRunRow {
  id: string;
  status: string;
  scope: string;
  levelsChecked: number;
  driftCount: number;
  driftUnits: number;
  driftValueCents: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface ReconciliationDriftRow {
  id: string;
  runId: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  recordedOnHand: number;
  derivedOnHand: number;
  /** recorded − derived. Positive = phantom stock, the direction that oversells. */
  delta: number;
  valueCents: number;
  resolvedAt: string | null;
  createdAt: string;
}

interface DriftScanRow {
  variantId: string;
  warehouseId: string;
  recordedOnHand: number;
  derivedOnHand: number;
  costCents: number;
}

interface ScanStatsRow {
  levelsChecked: number;
  driftCount: number;
  driftUnits: number;
  driftValueCents: number;
}

/** Detail rows persisted per run. A tenant with ten thousand drifting levels has
 *  a systemic problem, not ten thousand individual ones — capping keeps one bad
 *  night from writing a table nobody can read and the surface cannot page. */
const MAX_DRIFT_ROWS = 2000;

/** The bin cross-check's own cap, same reasoning. */
const MAX_BIN_DRIFT_ROWS = 500;

/**
 * The SECOND invariant, added when bins landed (docs/146 Phase 2):
 *
 *     Σ(inventory_bin_levels.on_hand) == inventory_levels.on_hand
 *
 * for every level in a bin-enabled location. The first invariant proves the
 * location total is honest against its own history; this one proves the shelves
 * underneath still add up to it. They fail differently and for different
 * reasons — a location can reconcile perfectly while the shelves have drifted
 * apart from a mis-keyed put-away — so a pass that checked only the first would
 * report clean while a picker could not find anything.
 *
 * Reported as ordinary drift rows with the bin sum as `derivedOnHand`, so the
 * surface, the event and the resolution (post a count) are all the ones that
 * already exist. A second parallel alarm concept would be a second thing to
 * learn for the same underlying problem.
 */
async function scanBinDrifts_(
  tx: TxClient,
  tenantId: string,
  input: RunReconciliationInput
): Promise<DriftScanRow[]> {
  return tx.$queryRawUnsafe<DriftScanRow[]>(
    `
    SELECT l.variant_id   AS "variantId",
           l.warehouse_id AS "warehouseId",
           l.on_hand      AS "recordedOnHand",
           COALESCE(b.total, 0) AS "derivedOnHand",
           COALESCE(l.avg_cost_cents, l.unit_cost_cents, 0) AS "costCents"
      FROM inventory_levels l
      JOIN inventory_warehouses w
        ON w.id = l.warehouse_id AND w.uses_bins = true
      LEFT JOIN LATERAL (
        SELECT SUM(bl.on_hand)::int AS total
          FROM inventory_bin_levels bl
         WHERE bl.variant_id = l.variant_id
           AND bl.warehouse_id = l.warehouse_id
      ) b ON TRUE
     WHERE l.tenant_id = $1::uuid
       ${input.scope === 'variant' ? 'AND l.variant_id = $2::uuid' : ''}
       AND l.on_hand <> COALESCE(b.total, 0)
     ORDER BY ABS(l.on_hand - COALESCE(b.total, 0)) DESC
     LIMIT ${MAX_BIN_DRIFT_ROWS}
    `,
    ...(input.scope === 'variant' ? [tenantId, input.variantId] : [tenantId])
  );
}

/**
 * Run one reconciliation pass and record what it found.
 *
 * Returns the run row. Does NOT throw on drift — drift is a finding, not a
 * failure; it throws only when the pass itself could not complete, and then the
 * run is recorded as `error` so a missing result is never mistaken for a clean one.
 */
export async function runReconciliation(
  ctx: ServiceContext,
  rawInput: unknown = {}
): Promise<ReconciliationRunRow> {
  const input = RunReconciliationInput.parse(rawInput);
  if (input.scope === 'variant' && !input.variantId) {
    throw new InventoryValidationError('variantId is required when scope is "variant"', [
      { field: 'variantId', message: 'Required for a variant-scoped check' },
    ]);
  }

  const startedAtMs = Date.now();

  const runId = await withTenant(ctx, async (tx) => {
    const run = await tx.inventoryReconciliationRun.create({
      data: { tenantId: ctx.tenantId, status: 'running', scope: input.scope },
      select: { id: true },
    });
    return run.id;
  });

  try {
    const { stats, drifts } = await withTenant(ctx, async (tx) => {
      const scanStats = await scanStats_(tx, ctx.tenantId, input);
      const ledgerDrifts = await scanDrifts_(tx, ctx.tenantId, input);

      // The bin cross-check (docs/146 Phase 2). Skipped on a `sample` pass — it
      // is a different question over a different set, and running it against a
      // sample would report shelves as drifting when they simply were not looked
      // at.
      const binDrifts =
        input.scope === 'sample' ? [] : await scanBinDrifts_(tx, ctx.tenantId, input);

      // Deduplicated by level. A level whose ledger has drifted will almost
      // always fail the bin check too — the bins were seated from a number that
      // is itself wrong — and reporting it twice would double every count on the
      // surface and make the drift figure meaningless. The LEDGER finding wins:
      // it is the deeper problem, and fixing it is what the bins then follow.
      const seen = new Set(ledgerDrifts.map((d) => `${d.variantId}:${d.warehouseId}`));
      const merged = [
        ...ledgerDrifts,
        ...binDrifts.filter((d) => !seen.has(`${d.variantId}:${d.warehouseId}`)),
      ];

      return {
        stats: {
          ...scanStats,
          // Fold the bin-only findings into the headline, so a clean-ledger /
          // drifting-shelves tenant is not told "everything adds up".
          driftCount: scanStats.driftCount + (merged.length - ledgerDrifts.length),
          driftUnits:
            scanStats.driftUnits +
            merged
              .slice(ledgerDrifts.length)
              .reduce((s, d) => s + Math.abs(d.recordedOnHand - d.derivedOnHand), 0),
          driftValueCents:
            scanStats.driftValueCents +
            merged
              .slice(ledgerDrifts.length)
              .reduce((s, d) => s + Math.abs(d.recordedOnHand - d.derivedOnHand) * d.costCents, 0),
        },
        drifts: merged,
      };
    });

    const outcome = await withTenant(ctx, async (tx) => {
      // Persist the detail rows.
      if (drifts.length > 0) {
        await tx.inventoryReconciliationDrift.createMany({
          data: drifts.map((d) => ({
            tenantId: ctx.tenantId,
            runId,
            variantId: d.variantId,
            warehouseId: d.warehouseId,
            recordedOnHand: d.recordedOnHand,
            derivedOnHand: d.derivedOnHand,
            delta: d.recordedOnHand - d.derivedOnHand,
            valueCents: Math.abs(d.recordedOnHand - d.derivedOnHand) * d.costCents,
          })),
        });
      }

      // Close out drifts from earlier runs that this pass found reconciling
      // again. Without this the open-drift list is append-only and an operator
      // who fixed something last week still sees it — which is how an alarm
      // surface stops being read.
      await resolveHealedDrifts(tx, ctx.tenantId, runId, drifts, input);

      const finishedAt = new Date();
      const durationMs = Date.now() - startedAtMs;
      const updated = await tx.inventoryReconciliationRun.update({
        where: { id: runId },
        data: {
          status: stats.driftCount > 0 ? 'drift' : 'ok',
          levelsChecked: stats.levelsChecked,
          driftCount: stats.driftCount,
          driftUnits: stats.driftUnits,
          driftValueCents: stats.driftValueCents,
          finishedAt,
          durationMs,
        },
      });
      return updated;
    });

    // One event per RUN, not one per drift. A tenant whose feed corrupted 400
    // levels needs one alarm that says 400, not 400 alarms.
    if (outcome.driftCount > 0) {
      await publishInventoryEvent({
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        topic: 'inventory.reconciliation.drift',
        data: {
          runId,
          scope: input.scope,
          levelsChecked: outcome.levelsChecked,
          driftCount: outcome.driftCount,
          driftUnits: outcome.driftUnits,
          driftValueCents: outcome.driftValueCents,
          // The worst offenders inline, so a notification is actionable without
          // a round trip back to the API.
          topDrifts: drifts
            .slice()
            .sort(
              (a, b) =>
                Math.abs(b.recordedOnHand - b.derivedOnHand) -
                Math.abs(a.recordedOnHand - a.derivedOnHand)
            )
            .slice(0, 5)
            .map((d) => ({
              variantId: d.variantId,
              warehouseId: d.warehouseId,
              recordedOnHand: d.recordedOnHand,
              derivedOnHand: d.derivedOnHand,
            })),
        },
      });
    }

    return serializeRun(outcome);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await withTenant(ctx, (tx) =>
      tx.inventoryReconciliationRun.update({
        where: { id: runId },
        data: {
          status: 'error',
          error: message,
          finishedAt: new Date(),
          durationMs: Date.now() - startedAtMs,
        },
      })
    );
    return serializeRun(failed);
  }
}

/**
 * Aggregate pass: how many levels were checked and how far off they were, in one
 * statement so the counts come from a single snapshot.
 *
 * `Σ(delta)` is computed by a correlated aggregate over the ledger rather than a
 * grouped scan of the whole table, because the scoped forms (`variant`, `sample`)
 * would otherwise still pay for every movement the tenant has ever recorded.
 */
async function scanStats_(
  tx: TxClient,
  tenantId: string,
  input: RunReconciliationInput
): Promise<ScanStatsRow> {
  const rows = await tx.$queryRawUnsafe<ScanStatsRow[]>(
    `
    WITH scoped AS (
      SELECT l.variant_id, l.warehouse_id, l.on_hand,
             COALESCE(l.avg_cost_cents, l.unit_cost_cents, 0) AS cost_cents
        FROM inventory_levels l
       WHERE l.tenant_id = $1::uuid
         ${input.scope === 'variant' ? 'AND l.variant_id = $2::uuid' : ''}
       ${input.scope === 'sample' ? 'ORDER BY l.updated_at DESC LIMIT $2' : ''}
    ),
    derived AS (
      SELECT s.variant_id, s.warehouse_id, s.on_hand, s.cost_cents,
             COALESCE((
               SELECT SUM(m.delta)::int
                 FROM inventory_movements m
                WHERE m.tenant_id = $1::uuid
                  AND m.variant_id = s.variant_id
                  AND m.warehouse_id = s.warehouse_id
             ), 0) AS derived_on_hand
        FROM scoped s
    )
    SELECT COUNT(*)::int AS "levelsChecked",
           COUNT(*) FILTER (WHERE on_hand <> derived_on_hand)::int AS "driftCount",
           COALESCE(SUM(ABS(on_hand - derived_on_hand))
             FILTER (WHERE on_hand <> derived_on_hand), 0)::int AS "driftUnits",
           COALESCE(SUM(ABS(on_hand - derived_on_hand) * cost_cents)
             FILTER (WHERE on_hand <> derived_on_hand), 0)::bigint::int AS "driftValueCents"
      FROM derived
    `,
    ...scanParams(tenantId, input)
  );
  return rows[0] ?? { levelsChecked: 0, driftCount: 0, driftUnits: 0, driftValueCents: 0 };
}

/** Detail pass: the mismatching levels, worst first, capped. */
async function scanDrifts_(
  tx: TxClient,
  tenantId: string,
  input: RunReconciliationInput
): Promise<DriftScanRow[]> {
  return tx.$queryRawUnsafe<DriftScanRow[]>(
    `
    WITH scoped AS (
      SELECT l.variant_id, l.warehouse_id, l.on_hand,
             COALESCE(l.avg_cost_cents, l.unit_cost_cents, 0) AS cost_cents
        FROM inventory_levels l
       WHERE l.tenant_id = $1::uuid
         ${input.scope === 'variant' ? 'AND l.variant_id = $2::uuid' : ''}
       ${input.scope === 'sample' ? 'ORDER BY l.updated_at DESC LIMIT $2' : ''}
    ),
    derived AS (
      SELECT s.variant_id, s.warehouse_id, s.on_hand, s.cost_cents,
             COALESCE((
               SELECT SUM(m.delta)::int
                 FROM inventory_movements m
                WHERE m.tenant_id = $1::uuid
                  AND m.variant_id = s.variant_id
                  AND m.warehouse_id = s.warehouse_id
             ), 0) AS derived_on_hand
        FROM scoped s
    )
    SELECT variant_id     AS "variantId",
           warehouse_id   AS "warehouseId",
           on_hand        AS "recordedOnHand",
           derived_on_hand AS "derivedOnHand",
           cost_cents     AS "costCents"
      FROM derived
     WHERE on_hand <> derived_on_hand
     ORDER BY ABS(on_hand - derived_on_hand) DESC
     LIMIT ${MAX_DRIFT_ROWS}
    `,
    ...scanParams(tenantId, input)
  );
}

/** `$1` is always the tenant; `$2` is the variant (variant scope) or the sample
 *  cap (sample scope) and is absent for a full pass. Keeping the two query bodies
 *  parameterised identically is what lets them share this. */
function scanParams(tenantId: string, input: RunReconciliationInput): unknown[] {
  if (input.scope === 'variant') return [tenantId, input.variantId];
  if (input.scope === 'sample') return [tenantId, input.sampleSize];
  return [tenantId];
}

/**
 * Mark previously-open drifts as resolved when this pass found their level
 * reconciling again.
 *
 * Only within the pass's own scope — a variant-scoped check must not close the
 * drift on a level it never looked at.
 */
async function resolveHealedDrifts(
  tx: TxClient,
  tenantId: string,
  runId: string,
  drifts: DriftScanRow[],
  input: RunReconciliationInput
): Promise<void> {
  const stillDrifting = new Set(drifts.map((d) => `${d.variantId}:${d.warehouseId}`));
  const open = await tx.inventoryReconciliationDrift.findMany({
    where: {
      tenantId,
      resolvedAt: null,
      runId: { not: runId },
      ...(input.scope === 'variant' && input.variantId ? { variantId: input.variantId } : {}),
    },
    select: { id: true, variantId: true, warehouseId: true },
    take: 5000,
  });
  const healed = open
    .filter((o) => !stillDrifting.has(`${o.variantId}:${o.warehouseId}`))
    // A sample pass only looked at part of the catalogue, so "not in the drift
    // set" does not mean "healed" — it usually means "not checked". Only a full
    // or variant pass may close a drift.
    .filter(() => input.scope !== 'sample')
    .map((o) => o.id);
  if (healed.length > 0) {
    await tx.inventoryReconciliationDrift.updateMany({
      where: { id: { in: healed } },
      data: { resolvedAt: new Date() },
    });
  }
}

// ─── Reconciliation reads ──────────────────────────────────────────────────────

export interface ListReconciliationRunsFilter {
  status?: string;
  take?: number;
  skip?: number;
}

export async function listReconciliationRuns(
  ctx: ServiceContext,
  filter: ListReconciliationRunsFilter = {}
): Promise<{ items: ReconciliationRunRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.status ? { status: filter.status } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.inventoryReconciliationRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: Math.min(filter.take ?? 25, 100),
        skip: filter.skip ?? 0,
      }),
      tx.inventoryReconciliationRun.count({ where }),
    ]);
    return { items: rows.map(serializeRun), total };
  });
}

export interface ListDriftsFilter {
  runId?: string;
  variantId?: string;
  warehouseId?: string;
  /** Defaults to OPEN only — resolved drifts are history, and they are what makes
   *  an unfiltered list stop being an alarm. */
  includeResolved?: boolean;
  take?: number;
  skip?: number;
}

export async function listReconciliationDrifts(
  ctx: ServiceContext,
  filter: ListDriftsFilter = {}
): Promise<{ items: ReconciliationDriftRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.includeResolved ? {} : { resolvedAt: null }),
      ...(filter.runId ? { runId: filter.runId } : {}),
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    };
    const include = {
      variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
      warehouse: { select: { name: true, code: true } },
    };
    const [rows, total] = await Promise.all([
      tx.inventoryReconciliationDrift.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.inventoryReconciliationDrift.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        runId: r.runId,
        variantId: r.variantId,
        variantSku: r.variant?.sku ?? null,
        productTitle: r.variant?.product?.title ?? r.variant?.title ?? null,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse?.name ?? null,
        warehouseCode: r.warehouse?.code ?? null,
        recordedOnHand: r.recordedOnHand,
        derivedOnHand: r.derivedOnHand,
        delta: r.delta,
        valueCents: r.valueCents,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  });
}

function serializeRun(r: {
  id: string;
  status: string;
  scope: string;
  levelsChecked: number;
  driftCount: number;
  driftUnits: number;
  driftValueCents: number;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  error: string | null;
}): ReconciliationRunRow {
  return {
    id: r.id,
    status: r.status,
    scope: r.scope,
    levelsChecked: r.levelsChecked,
    driftCount: r.driftCount,
    driftUnits: r.driftUnits,
    driftValueCents: r.driftValueCents,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    durationMs: r.durationMs,
    error: r.error,
  };
}

// ─── Oversell incidents ────────────────────────────────────────────────────────

export interface OversellIncidentInput {
  variantId: string;
  warehouseId: string;
  kind: 'blocked' | 'allowed' | 'negative_on_hand';
  requestedQuantity: number;
  availableQuantity: number;
  onHandAtDecision: number;
  allocatedAtDecision: number;
  bufferAtDecision: number;
  policy: string;
  channel?: string | null;
  holderType?: string | null;
  holderId?: string | null;
  actorType?: string;
  actorId?: string | null;
  sourceId?: string | null;
  stockAgeSeconds?: number | null;
}

function incidentData(
  tenantId: string,
  input: OversellIncidentInput
): Record<string, string | number | null> {
  return {
    tenantId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    kind: input.kind,
    requestedQuantity: input.requestedQuantity,
    availableQuantity: input.availableQuantity,
    shortfall: Math.max(0, input.requestedQuantity - input.availableQuantity),
    onHandAtDecision: input.onHandAtDecision,
    allocatedAtDecision: input.allocatedAtDecision,
    bufferAtDecision: input.bufferAtDecision,
    policy: input.policy,
    channel: input.channel ?? null,
    // `holder_type` is VARCHAR(20) while a ledger `reference_type` may be up to
    // 63. The ledger passes its reference through here for negative-on-hand
    // incidents, so clamp rather than let a long reference type fail the insert
    // — losing the tail of a label is a far better outcome than losing the
    // incident, which is the one thing this table exists to keep.
    holderType: input.holderType ? input.holderType.slice(0, 20) : null,
    holderId: input.holderId ?? null,
    actorType: input.actorType ?? 'system',
    actorId: input.actorId ?? null,
    sourceId: input.sourceId ?? null,
    stockAgeSeconds: input.stockAgeSeconds ?? null,
  };
}

/**
 * Record an incident INSIDE the caller's transaction.
 *
 * For the outcomes whose transaction COMMITS — an `allowed` hold, a sale that
 * drove on-hand negative. The incident and the thing it describes then land
 * together or not at all, which is what makes the log trustworthy.
 */
export async function recordOversellIncidentOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: OversellIncidentInput
): Promise<void> {
  await tx.inventoryOversellIncident.create({
    data: incidentData(ctx.tenantId, input) as never,
  });
}

/**
 * Record an incident on its OWN connection, and never throw.
 *
 * For the `blocked` outcome, where the caller is about to throw
 * `InventoryOutOfStockError` and roll its transaction back — an in-transaction
 * write would be rolled back with it, and the one incident an operator most
 * wants to see is the sale that did not happen.
 *
 * Best-effort by construction: this is observability on the critical path of a
 * checkout, and an observability write that can fail a sale is worse than no
 * observability. A failure is logged and swallowed.
 */
export async function recordOversellIncidentDetached(
  ctx: ServiceContext,
  input: OversellIncidentInput
): Promise<void> {
  try {
    await withTenant(ctx, (tx) =>
      tx.inventoryOversellIncident.create({ data: incidentData(ctx.tenantId, input) as never })
    );
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'inventory.oversell.blocked',
      data: {
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        kind: input.kind,
        requested: input.requestedQuantity,
        available: input.availableQuantity,
        policy: input.policy,
        channel: input.channel ?? null,
      },
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        src: 'inventory',
        msg: 'failed to record oversell incident',
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

export interface OversellIncidentRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  kind: string;
  requestedQuantity: number;
  availableQuantity: number;
  shortfall: number;
  onHandAtDecision: number;
  allocatedAtDecision: number;
  bufferAtDecision: number;
  policy: string;
  channel: string | null;
  holderType: string | null;
  holderId: string | null;
  actorType: string;
  actorId: string | null;
  sourceId: string | null;
  stockAgeSeconds: number | null;
  occurredAt: string;
}

export interface ListOversellIncidentsFilter {
  variantId?: string;
  productId?: string;
  warehouseId?: string;
  kind?: string;
  channel?: string;
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
}

export async function listOversellIncidents(
  ctx: ServiceContext,
  filter: ListOversellIncidentsFilter = {}
): Promise<{ items: OversellIncidentRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const occurredAt =
      filter.from || filter.to
        ? {
            ...(filter.from ? { gte: new Date(filter.from) } : {}),
            ...(filter.to ? { lte: new Date(filter.to) } : {}),
          }
        : undefined;
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.productId ? { variant: { productId: filter.productId } } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.channel ? { channel: filter.channel } : {}),
      ...(occurredAt ? { occurredAt } : {}),
    };
    const include = {
      variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
      warehouse: { select: { name: true, code: true } },
    };
    const [rows, total] = await Promise.all([
      tx.inventoryOversellIncident.findMany({
        where,
        include,
        orderBy: { occurredAt: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.inventoryOversellIncident.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        variantId: r.variantId,
        variantSku: r.variant?.sku ?? null,
        productTitle: r.variant?.product?.title ?? r.variant?.title ?? null,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse?.name ?? null,
        warehouseCode: r.warehouse?.code ?? null,
        kind: r.kind,
        requestedQuantity: r.requestedQuantity,
        availableQuantity: r.availableQuantity,
        shortfall: r.shortfall,
        onHandAtDecision: r.onHandAtDecision,
        allocatedAtDecision: r.allocatedAtDecision,
        bufferAtDecision: r.bufferAtDecision,
        policy: r.policy,
        channel: r.channel,
        holderType: r.holderType,
        holderId: r.holderId,
        actorType: r.actorType,
        actorId: r.actorId,
        sourceId: r.sourceId,
        stockAgeSeconds: r.stockAgeSeconds,
        occurredAt: r.occurredAt.toISOString(),
      })),
      total,
    };
  });
}

/** Headline counts for the integrity surface. Split by kind because the three
 *  kinds call for three different reactions and a single total hides that. */
export interface OversellSummary {
  windowDays: number;
  blocked: number;
  allowed: number;
  negativeOnHand: number;
  unitsShort: number;
  /** Distinct variants involved — "40 incidents" reads very differently when it
   *  is one runaway SKU than when it is forty. */
  variantsAffected: number;
  topVariants: {
    variantId: string;
    variantSku: string | null;
    productTitle: string | null;
    incidents: number;
    unitsShort: number;
  }[];
}

interface SummaryCountsRow {
  blocked: number;
  allowed: number;
  negativeOnHand: number;
  unitsShort: number;
  variantsAffected: number;
}

interface TopVariantRow {
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  incidents: number;
  unitsShort: number;
}

export async function oversellSummary(
  ctx: ServiceContext,
  opts: { windowDays?: number } = {}
): Promise<OversellSummary> {
  const windowDays = Math.min(Math.max(opts.windowDays ?? 30, 1), 365);
  return withTenant(ctx, async (tx) => {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const counts = await tx.$queryRaw<SummaryCountsRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE kind = 'blocked')::int          AS "blocked",
        COUNT(*) FILTER (WHERE kind = 'allowed')::int          AS "allowed",
        COUNT(*) FILTER (WHERE kind = 'negative_on_hand')::int AS "negativeOnHand",
        COALESCE(SUM(shortfall), 0)::int                       AS "unitsShort",
        COUNT(DISTINCT variant_id)::int                        AS "variantsAffected"
      FROM inventory_oversell_incidents
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND occurred_at >= ${since}
    `;

    const top = await tx.$queryRaw<TopVariantRow[]>`
      SELECT i.variant_id            AS "variantId",
             v.sku                   AS "variantSku",
             COALESCE(p.title, v.title) AS "productTitle",
             COUNT(*)::int           AS "incidents",
             COALESCE(SUM(i.shortfall), 0)::int AS "unitsShort"
        FROM inventory_oversell_incidents i
        JOIN commerce_product_variants v ON v.id = i.variant_id
        LEFT JOIN commerce_products p ON p.id = v.product_id
       WHERE i.tenant_id = ${ctx.tenantId}::uuid
         AND i.occurred_at >= ${since}
       GROUP BY i.variant_id, v.sku, p.title, v.title
       ORDER BY COUNT(*) DESC, SUM(i.shortfall) DESC
       LIMIT 10
    `;

    const c = counts[0] ?? {
      blocked: 0,
      allowed: 0,
      negativeOnHand: 0,
      unitsShort: 0,
      variantsAffected: 0,
    };
    return { windowDays, ...c, topVariants: top };
  });
}
