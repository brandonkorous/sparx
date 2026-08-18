// Automation run-activity reporting (docs/81 §6, docs/97 §5) — the aggregate
// read side of the run state machine. The per-automation `/:id/runs` list
// answers "what did THIS automation do"; this answers "how is the whole engine
// doing for this tenant" — a daily run-volume series and a success rate across
// every automation.
//
// Backed by the `rollup_automation_daily_runs` table (one row per tenant/UTC
// day), maintained by the nightly reconcile below. The read serves closed days
// from the rollup and recomputes the most recent open day(s) live, so "today"
// is fresh without an event-increment worker — runs are always recomputable
// from `automation_runs`, so reconcile + live-overlay is strictly correct and
// cheaper than an incremental consumer. This is the same rollup shape the
// commerce/invoicing/dropship timeseries use (docs/97 §5); the small UTC-day
// helpers are duplicated here because they're package-private to each service.
//
// All reads are tenant-scoped via `withTenant` (FORCE RLS). Buckets by
// `started_at` (when the run began); terminal counters lag `runs_count` for
// in-flight runs until the reconcile re-buckets them once they settle.

import { Prisma, withTenant, type TxClient } from '@wizeworks/db';

import type { ServiceCtx } from './automation-service';

export type RollupGrain = 'day' | 'week' | 'month';

export interface DateRange {
  from: string; // ISO
  to: string; // ISO
}

export interface RunsTimeseriesPoint {
  /** Start of the bucket, UTC date `YYYY-MM-DD`. */
  bucket: string;
  runsCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface RunsTimeseries {
  range: { from: string; to: string; grain: RollupGrain };
  points: RunsTimeseriesPoint[];
  totals: {
    runsCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    /** completed / (completed + failed), as a 0–100 percentage rounded to 1dp.
     *  Skipped runs are excluded from the denominator — a skipped run isn't a
     *  failure, it's a condition that no longer matched. */
    successRate: number;
  };
}

export interface RunsRollupReconcileResult {
  /** Days with at least one run started in the reconciled window. */
  days: number;
  runsCount: number;
  windowStart: string;
}

// How many trailing days the read recomputes live on every call (today at 1).
// The reconcile writes these too, but the live overlay wins so a run that
// started today shows up without waiting for the nightly job.
const OVERLAY_DAYS = 1;

// Trailing window the nightly reconcile recomputes from source-of-truth runs.
// At Phase-1 volumes this effectively recomputes all history each night (and is
// the one-shot backfill); narrow it once per-tenant run counts grow large.
const DEFAULT_RECONCILE_DAYS = 400;

interface DayMeasures {
  runsCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
}

const ZERO_MEASURES: DayMeasures = {
  runsCount: 0,
  completedCount: 0,
  failedCount: 0,
  skippedCount: 0,
};

interface DayRow extends DayMeasures {
  /** UTC date key `YYYY-MM-DD`. */
  key: string;
  /** UTC-midnight Date for the bucket (used as the rollup PK value). */
  date: Date;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachUtcDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const end = startOfUtcDay(to).getTime();
  for (let d = startOfUtcDay(from); d.getTime() <= end; d = addUtcDays(d, 1)) out.push(d);
  return out;
}

interface RawDayRow {
  bucket: Date;
  runs_count: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
}

function mapRunRow(r: RawDayRow): DayRow {
  const date = startOfUtcDay(new Date(r.bucket));
  return {
    key: utcDateKey(date),
    date,
    runsCount: Number(r.runs_count ?? 0),
    completedCount: Number(r.completed_count ?? 0),
    failedCount: Number(r.failed_count ?? 0),
    skippedCount: Number(r.skipped_count ?? 0),
  };
}

// One GROUP-BY-day pass over automation_runs in [from, toExclusive), bucketed by
// started_at's UTC date. RLS scopes the read to the tenant — the aggregate spans
// every automation the tenant owns. Shared by the live overlay/cold-start in
// runsTimeseries.
//
// Site scoping is the SHARED-NULL read (docs/131 §6) — and this is where
// automation deliberately DIFFERS from the commerce revenue rollup. A run's
// property_id is the site it executed for, but NULL there is not an orphan: a
// tenant-wide automation (one that applies to every site) and any run triggered
// by a tenant-level record produce property_id = NULL, which is SHARED activity
// every site is entitled to see. So a scoped read for one site must ALSO include
// the null bucket — `(property_id = $site OR property_id IS NULL)`, NOT `=$site`
// alone. `propertyId` undefined = every site (the all-sites total, which already
// sums the null bucket in via no filter).
async function aggregateRunsByDay(
  tx: TxClient,
  from: Date,
  toExclusive: Date,
  propertyId?: string
): Promise<DayRow[]> {
  const rows = await tx.$queryRaw<RawDayRow[]>`
    SELECT
      (started_at AT TIME ZONE 'UTC')::date                     AS bucket,
      COUNT(*)::int                                             AS runs_count,
      (COUNT(*) FILTER (WHERE status = 'completed'))::int       AS completed_count,
      (COUNT(*) FILTER (WHERE status = 'failed'))::int          AS failed_count,
      (COUNT(*) FILTER (WHERE status = 'skipped'))::int         AS skipped_count
    FROM automation_runs
    WHERE started_at >= ${from}
      AND started_at < ${toExclusive}
      ${
        propertyId
          ? // Shared-null read (docs/131 §6): a single site sees its OWN runs plus
            // the tenant-wide (null-property) runs that apply to every site — this
            // OR is intentional and NOT the commerce `= propertyId` semantics.
            Prisma.sql`AND (property_id = ${propertyId}::uuid OR property_id IS NULL)`
          : Prisma.empty
      }
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map(mapRunRow);
}

interface RawDayPropRow extends RawDayRow {
  property_id: string | null;
}

// The per-PROPERTY pass the nightly reconcile writes (docs/131 §6): one row per
// (site, day), null property_id = the SHARED tenant-wide bucket (a run for a
// tenant-wide automation or triggered by a tenant-level record). This aggregate
// is identical in shape to the commerce reconcile — GROUP BY property_id, day,
// nullable property_id — the shared-null semantics live only in the READ above,
// never in how the rollup is stored.
async function aggregateRunsByDayPerProperty(
  tx: TxClient,
  from: Date,
  toExclusive: Date
): Promise<(DayRow & { propertyId: string | null })[]> {
  const rows = await tx.$queryRaw<RawDayPropRow[]>`
    SELECT
      property_id,
      (started_at AT TIME ZONE 'UTC')::date                     AS bucket,
      COUNT(*)::int                                             AS runs_count,
      (COUNT(*) FILTER (WHERE status = 'completed'))::int       AS completed_count,
      (COUNT(*) FILTER (WHERE status = 'failed'))::int          AS failed_count,
      (COUNT(*) FILTER (WHERE status = 'skipped'))::int         AS skipped_count
    FROM automation_runs
    WHERE started_at >= ${from}
      AND started_at < ${toExclusive}
    GROUP BY property_id, 2
    ORDER BY 2
  `;
  return rows.map((r) => ({ ...mapRunRow(r), propertyId: r.property_id }));
}

function bucketStartFor(dateKey: string, grain: 'week' | 'month'): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (grain === 'month') {
    return utcDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }
  // ISO week: snap back to Monday.
  const deltaToMonday = (d.getUTCDay() + 6) % 7;
  return utcDateKey(addUtcDays(startOfUtcDay(d), -deltaToMonday));
}

function foldByGrain(daily: RunsTimeseriesPoint[], grain: 'week' | 'month'): RunsTimeseriesPoint[] {
  const map = new Map<string, RunsTimeseriesPoint>();
  for (const p of daily) {
    const key = bucketStartFor(p.bucket, grain);
    const cur = map.get(key);
    if (cur) {
      cur.runsCount += p.runsCount;
      cur.completedCount += p.completedCount;
      cur.failedCount += p.failedCount;
      cur.skippedCount += p.skippedCount;
    } else {
      map.set(key, { ...p, bucket: key });
    }
  }
  return [...map.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
}

function successRateOf(completed: number, failed: number): number {
  const settled = completed + failed;
  return settled > 0 ? +((completed / settled) * 100).toFixed(1) : 0;
}

// Sum a day's measures into the bucket map. Accumulates rather than overwrites
// because a per-site read (docs/131 §6) now finds MULTIPLE rollup rows per bucket
// — the site's own row plus the SHARED tenant-wide (null-property) row — and an
// all-sites read finds every site's row per bucket; both must add back up to the
// tenant total. The closed and open windows stay disjoint, so this never
// double-counts across them.
function addRunMeasures(byKey: Map<string, DayMeasures>, key: string, m: DayMeasures): void {
  const cur = byKey.get(key);
  byKey.set(
    key,
    cur
      ? {
          runsCount: cur.runsCount + m.runsCount,
          completedCount: cur.completedCount + m.completedCount,
          failedCount: cur.failedCount + m.failedCount,
          skippedCount: cur.skippedCount + m.skippedCount,
        }
      : { ...m }
  );
}

/** Daily/weekly/monthly run-activity series for the whole tenant (or one site),
 *  backed by the rollup with a live overlay of the most recent open day(s). */
export async function runsTimeseries(
  ctx: ServiceCtx,
  input: { range: DateRange; grain?: RollupGrain; propertyId?: string }
): Promise<RunsTimeseries> {
  const grain = input.grain ?? 'day';
  const propertyId = input.propertyId;
  const from = startOfUtcDay(new Date(input.range.from));
  const to = startOfUtcDay(new Date(input.range.to));
  // First day served live (recomputed on every read). Everything before it is a
  // closed day read from the rollup.
  const overlayStart = addUtcDays(startOfUtcDay(new Date()), -OVERLAY_DAYS);

  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const toExclusive = addUtcDays(to, 1);
    const closedToExclusive = new Date(Math.min(toExclusive.getTime(), overlayStart.getTime()));
    const byKey = new Map<string, DayMeasures>();

    // 1) Closed days from the rollup. Cold-start fallback: if the rollup hasn't
    //    been reconciled yet, aggregate the closed window live so a fresh deploy
    //    still serves real history immediately (cheap at Phase-1 volumes).
    //    Per-site (docs/131 §6): read the site's OWN rows PLUS the shared
    //    tenant-wide (null-property) rows — every site sees the tenant-wide
    //    automations' activity — and let addRunMeasures sum them; all-sites reads
    //    every row and sums them back to the tenant total. This `OR null` is the
    //    automation-specific shared-null read, NOT commerce's `{ propertyId }`.
    if (closedToExclusive.getTime() > from.getTime()) {
      const rollup = await tx.rollupAutomationDailyRuns.findMany({
        where: {
          bucket: { gte: from, lt: closedToExclusive },
          ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}),
        },
        orderBy: { bucket: 'asc' },
      });
      if (rollup.length > 0) {
        for (const r of rollup) {
          addRunMeasures(byKey, utcDateKey(startOfUtcDay(new Date(r.bucket))), {
            runsCount: r.runsCount,
            completedCount: r.completedCount,
            failedCount: r.failedCount,
            skippedCount: r.skippedCount,
          });
        }
      } else {
        for (const d of await aggregateRunsByDay(tx, from, closedToExclusive, propertyId)) {
          addRunMeasures(byKey, d.key, d);
        }
      }
    }

    // 2) Open day(s) always recomputed live so they're fresh. Same shared-null
    //    scoping as the closed window (docs/131 §6) — aggregateRunsByDay includes
    //    the null bucket when a propertyId is set.
    const overlayFrom = new Date(Math.max(from.getTime(), overlayStart.getTime()));
    if (toExclusive.getTime() > overlayFrom.getTime()) {
      for (const d of await aggregateRunsByDay(tx, overlayFrom, toExclusive, propertyId)) {
        addRunMeasures(byKey, d.key, d);
      }
    }

    // 3) Continuous, zero-filled daily series so the chart has a clean axis.
    const daily: RunsTimeseriesPoint[] = eachUtcDay(from, to).map((d) => ({
      bucket: utcDateKey(d),
      ...(byKey.get(utcDateKey(d)) ?? ZERO_MEASURES),
    }));

    const points = grain === 'day' ? daily : foldByGrain(daily, grain);
    const totals = daily.reduce(
      (acc, p) => ({
        runsCount: acc.runsCount + p.runsCount,
        completedCount: acc.completedCount + p.completedCount,
        failedCount: acc.failedCount + p.failedCount,
        skippedCount: acc.skippedCount + p.skippedCount,
      }),
      { runsCount: 0, completedCount: 0, failedCount: 0, skippedCount: 0 }
    );

    return {
      range: { from: utcDateKey(from), to: utcDateKey(to), grain },
      points,
      totals: {
        ...totals,
        successRate: successRateOf(totals.completedCount, totals.failedCount),
      },
    };
  });
}

// Nightly maintenance (docs/97 §5): recompute the trailing window from
// automation_runs and overwrite the rollup. Delete-then-insert the window so a
// run that settled (running → completed/failed) after an earlier reconcile
// self-heals in one pass. Run once over full history, this is also the backfill.
// Invoked per active tenant by `/internal/automations/runs-rollup`.
export async function reconcileRunsRollup(
  ctx: ServiceCtx,
  opts?: { sinceDays?: number }
): Promise<RunsRollupReconcileResult> {
  const sinceDays = Math.max(0, opts?.sinceDays ?? DEFAULT_RECONCILE_DAYS);
  const today = startOfUtcDay(new Date());
  const windowStart = addUtcDays(today, -sinceDays);
  const toExclusive = addUtcDays(today, 1); // include today

  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    // Per (property, day) rows (docs/131 §6). Delete-then-insert the whole window
    // for the tenant regardless of property — every site's rows plus the shared
    // null-property row are rewritten in one pass, so a run that settled after an
    // earlier reconcile self-heals and a site with no runs that day has no row.
    const rows = await aggregateRunsByDayPerProperty(tx, windowStart, toExclusive);

    await tx.rollupAutomationDailyRuns.deleteMany({ where: { bucket: { gte: windowStart } } });
    if (rows.length > 0) {
      await tx.rollupAutomationDailyRuns.createMany({
        data: rows.map((r) => ({
          tenantId: ctx.tenantId,
          propertyId: r.propertyId,
          bucket: r.date,
          runsCount: r.runsCount,
          completedCount: r.completedCount,
          failedCount: r.failedCount,
          skippedCount: r.skippedCount,
        })),
      });
    }

    return {
      days: rows.length,
      runsCount: rows.reduce((s, r) => s + r.runsCount, 0),
      windowStart: utcDateKey(windowStart),
    };
  });
}

// ─── Per-automation overview (docs/97) ───────────────────────────────────────
// Every automation the tenant owns, enriched with its trailing-window run count
// + success rate — the AI overview's "Automations & agents" table. `listAutoma-
// tions` returns definitions only (no run stats), so this one groups
// automation_runs by (automationId, status) over the window and merges. A single
// groupBy, not N per-automation queries.
export interface AutomationOverviewRow {
  id: string;
  name: string;
  triggerType: string;
  status: string;
  runs: number;
  successRate: number | null;
}

export async function automationsOverview(
  ctx: ServiceCtx,
  opts?: { sinceDays?: number }
): Promise<AutomationOverviewRow[]> {
  const sinceDays = Math.max(1, opts?.sinceDays ?? 30);
  const since = addUtcDays(startOfUtcDay(new Date()), -(sinceDays - 1));

  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const [automations, grouped] = await Promise.all([
      tx.automation.findMany({
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, triggerType: true, status: true },
      }),
      tx.automationRun.groupBy({
        by: ['automationId', 'status'],
        where: { startedAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    const statById = new Map<string, { runs: number; completed: number }>();
    for (const g of grouped) {
      const s = statById.get(g.automationId) ?? { runs: 0, completed: 0 };
      s.runs += g._count._all;
      if (g.status === 'completed') s.completed += g._count._all;
      statById.set(g.automationId, s);
    }

    return automations.map((a) => {
      const s = statById.get(a.id);
      return {
        id: a.id,
        name: a.name,
        triggerType: a.triggerType,
        status: a.status,
        runs: s?.runs ?? 0,
        successRate: s && s.runs > 0 ? +(s.completed / s.runs).toFixed(4) : null,
      };
    });
  });
}
