// Pick and pack throughput (docs/146 Phase 4.7).
//
// Four numbers, each chosen because it drives a decision somebody actually makes:
//
//   units per hour     staffing. Measured against time SPENT — first confirmed
//                      line to last — not against the clock from assignment,
//                      because a walk handed out at 08:00 and worked at 11:00
//                      took twenty minutes and any other reading slanders the
//                      picker.
//   accuracy           trust. The share of picked lines confirmed by a scan
//                      rather than a tap. Deliberately NOT called "accuracy rate"
//                      as if it were error-free-ness — we cannot know what was
//                      picked wrong and never noticed, and a metric that implies
//                      we can is worse than none.
//   short-pick rate    where the stock numbers are wrong. The single most
//                      actionable number here.
//   by bin             where in the building they are wrong. A shelf that shorts
//                      repeatedly is a put-away problem, a signage problem, or a
//                      theft problem, and it will not appear in any per-picker
//                      view.
//
// ── Two people, one walk ─────────────────────────────────────────────────────
//
// Attribution is per LINE (`picked_by`), never per list, so a walk handed over
// halfway credits both people for what each actually did. Grouping by the list's
// assignee would give one of them everything and the other nothing.

import { PickThroughputQuery } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

export interface PickerThroughput {
  pickedBy: string | null;
  linesPicked: number;
  unitsPicked: number;
  linesShort: number;
  unitsShort: number;
  /** Lines confirmed by a trigger pull rather than a tap. */
  linesScanVerified: number;
  /** Minutes between the first and last confirmed line, summed over walks. */
  activeMinutes: number;
  unitsPerHour: number;
  scanVerifiedRate: number;
  shortLineRate: number;
}

export interface BinShortfall {
  binId: string | null;
  binCode: string | null;
  zone: string | null;
  linesShort: number;
  unitsShort: number;
  /** Lines picked from this shelf in the window, short or not — the denominator
   *  without which "eleven shorts" says nothing about whether the shelf is bad. */
  linesTotal: number;
  shortLineRate: number;
  topReason: string | null;
}

export interface PackThroughput {
  packedBy: string | null;
  boxesPacked: number;
  unitsPacked: number;
  unitsScanned: number;
  scanVerifiedRate: number;
}

export interface PickThroughputReport {
  from: string;
  to: string;
  totals: {
    walksCompleted: number;
    linesPicked: number;
    unitsPicked: number;
    linesShort: number;
    unitsShort: number;
    activeMinutes: number;
    unitsPerHour: number;
    scanVerifiedRate: number;
    shortLineRate: number;
    boxesPacked: number;
  };
  pickers: PickerThroughput[];
  bins: BinShortfall[];
  packers: PackThroughput[];
  /** Which reasons the shorts gave, biggest first. Where the story is. */
  shortReasons: { reason: string; lines: number; units: number }[];
}

const DAY_MS = 86_400_000;

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function perHour(units: number, minutes: number): number {
  return minutes > 0 ? Math.round((units / minutes) * 60 * 10) / 10 : 0;
}

export async function pickThroughput(
  ctx: ServiceContext,
  rawQuery: unknown = {}
): Promise<PickThroughputReport> {
  const query = PickThroughputQuery.parse(rawQuery ?? {});
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * DAY_MS);
  const warehouseId = query.warehouseId ?? null;
  const pickedBy = query.pickedBy ?? null;

  return withTenant(ctx, async (tx) => {
    // Time spent is measured PER WALK PER PERSON: first to last confirmed line.
    // A single elapsed span over the whole window would count the hours nobody
    // was picking, and a sum of per-line gaps would count the coffee break twice.
    const pickers = await tx.$queryRaw<
      {
        pickedBy: string | null;
        linesPicked: number;
        unitsPicked: number;
        linesShort: number;
        unitsShort: number;
        linesScanVerified: number;
        activeMinutes: number;
      }[]
    >`
      WITH scoped AS (
        SELECT ln.*, pl.warehouse_id
          FROM inventory_pick_list_lines ln
          JOIN inventory_pick_lists pl ON pl.id = ln.pick_list_id
         WHERE ln.tenant_id = ${ctx.tenantId}::uuid
           AND ln.picked_at IS NOT NULL
           AND ln.picked_at >= ${from}
           AND ln.picked_at <= ${to}
           AND (${warehouseId}::uuid IS NULL OR pl.warehouse_id = ${warehouseId}::uuid)
           AND (${pickedBy}::text IS NULL OR ln.picked_by = ${pickedBy})
      ),
      spans AS (
        SELECT picked_by,
               pick_list_id,
               EXTRACT(EPOCH FROM (MAX(picked_at) - MIN(picked_at))) / 60 AS minutes
          FROM scoped
         GROUP BY picked_by, pick_list_id
      )
      SELECT s.picked_by                                       AS "pickedBy",
             COUNT(*) FILTER (WHERE s.status = 'picked')::int  AS "linesPicked",
             COALESCE(SUM(s.picked_quantity), 0)::int          AS "unitsPicked",
             COUNT(*) FILTER (WHERE s.status = 'short')::int   AS "linesShort",
             COALESCE(SUM(s.short_quantity), 0)::int           AS "unitsShort",
             COUNT(*) FILTER (WHERE s.verified_by_scan)::int   AS "linesScanVerified",
             COALESCE((SELECT SUM(sp.minutes) FROM spans sp
                        WHERE sp.picked_by IS NOT DISTINCT FROM s.picked_by), 0)::int
                                                               AS "activeMinutes"
        FROM scoped s
       GROUP BY s.picked_by
       ORDER BY COALESCE(SUM(s.picked_quantity), 0) DESC
    `;

    const binRows = await tx.$queryRaw<
      {
        binId: string | null;
        binCode: string | null;
        zone: string | null;
        linesShort: number;
        unitsShort: number;
        linesTotal: number;
        topReason: string | null;
      }[]
    >`
      SELECT ln.bin_id                                        AS "binId",
             b.code                                           AS "binCode",
             b.zone                                           AS "zone",
             COUNT(*) FILTER (WHERE ln.status = 'short')::int AS "linesShort",
             COALESCE(SUM(ln.short_quantity), 0)::int         AS "unitsShort",
             COUNT(*)::int                                    AS "linesTotal",
             (SELECT x.short_reason
                FROM inventory_pick_list_lines x
               WHERE x.tenant_id = ln.tenant_id
                 AND x.bin_id IS NOT DISTINCT FROM ln.bin_id
                 AND x.short_reason IS NOT NULL
                 AND x.picked_at >= ${from} AND x.picked_at <= ${to}
               GROUP BY x.short_reason
               ORDER BY COUNT(*) DESC
               LIMIT 1)                                       AS "topReason"
        FROM inventory_pick_list_lines ln
        JOIN inventory_pick_lists pl ON pl.id = ln.pick_list_id
        LEFT JOIN inventory_bins b   ON b.id = ln.bin_id
       WHERE ln.tenant_id = ${ctx.tenantId}::uuid
         AND ln.picked_at IS NOT NULL
         AND ln.picked_at >= ${from}
         AND ln.picked_at <= ${to}
         AND (${warehouseId}::uuid IS NULL OR pl.warehouse_id = ${warehouseId}::uuid)
       GROUP BY ln.tenant_id, ln.bin_id, b.code, b.zone
      HAVING COUNT(*) FILTER (WHERE ln.status = 'short') > 0
       ORDER BY COUNT(*) FILTER (WHERE ln.status = 'short') DESC
       LIMIT 25
    `;

    const reasonRows = await tx.$queryRaw<{ reason: string; lines: number; units: number }[]>`
      SELECT ln.short_reason                    AS "reason",
             COUNT(*)::int                      AS "lines",
             COALESCE(SUM(ln.short_quantity), 0)::int AS "units"
        FROM inventory_pick_list_lines ln
        JOIN inventory_pick_lists pl ON pl.id = ln.pick_list_id
       WHERE ln.tenant_id = ${ctx.tenantId}::uuid
         AND ln.short_reason IS NOT NULL
         AND ln.picked_at >= ${from}
         AND ln.picked_at <= ${to}
         AND (${warehouseId}::uuid IS NULL OR pl.warehouse_id = ${warehouseId}::uuid)
       GROUP BY ln.short_reason
       ORDER BY COUNT(*) DESC
    `;

    const packerRows = await tx.$queryRaw<
      { packedBy: string | null; boxesPacked: number; unitsPacked: number; unitsScanned: number }[]
    >`
      SELECT pk.packed_by                        AS "packedBy",
             COUNT(*)::int                       AS "boxesPacked",
             COALESCE(SUM(agg.units), 0)::int    AS "unitsPacked",
             COALESCE(SUM(agg.scanned), 0)::int  AS "unitsScanned"
        FROM inventory_shipment_packages pk
        LEFT JOIN LATERAL (
          SELECT SUM(pl.quantity) AS units, SUM(pl.scanned_quantity) AS scanned
            FROM inventory_shipment_package_lines pl
           WHERE pl.package_id = pk.id
        ) agg ON TRUE
       WHERE pk.tenant_id = ${ctx.tenantId}::uuid
         AND pk.status = 'packed'
         AND pk.packed_at >= ${from}
         AND pk.packed_at <= ${to}
       GROUP BY pk.packed_by
       ORDER BY COUNT(*) DESC
    `;

    const walks = await tx.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
        FROM inventory_pick_lists pl
       WHERE pl.tenant_id = ${ctx.tenantId}::uuid
         AND pl.status = 'picked'
         AND pl.picked_at >= ${from}
         AND pl.picked_at <= ${to}
         AND (${warehouseId}::uuid IS NULL OR pl.warehouse_id = ${warehouseId}::uuid)
    `;

    const pickerRows: PickerThroughput[] = pickers.map((p) => ({
      ...p,
      unitsPerHour: perHour(p.unitsPicked, p.activeMinutes),
      scanVerifiedRate: ratio(p.linesScanVerified, p.linesPicked + p.linesShort),
      shortLineRate: ratio(p.linesShort, p.linesPicked + p.linesShort),
    }));

    const totalLines = pickerRows.reduce((s, p) => s + p.linesPicked, 0);
    const totalShort = pickerRows.reduce((s, p) => s + p.linesShort, 0);
    const totalUnits = pickerRows.reduce((s, p) => s + p.unitsPicked, 0);
    const totalUnitsShort = pickerRows.reduce((s, p) => s + p.unitsShort, 0);
    const totalVerified = pickerRows.reduce((s, p) => s + p.linesScanVerified, 0);
    const totalMinutes = pickerRows.reduce((s, p) => s + p.activeMinutes, 0);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: {
        walksCompleted: walks[0]?.count ?? 0,
        linesPicked: totalLines,
        unitsPicked: totalUnits,
        linesShort: totalShort,
        unitsShort: totalUnitsShort,
        activeMinutes: totalMinutes,
        unitsPerHour: perHour(totalUnits, totalMinutes),
        scanVerifiedRate: ratio(totalVerified, totalLines + totalShort),
        shortLineRate: ratio(totalShort, totalLines + totalShort),
        boxesPacked: packerRows.reduce((s, p) => s + p.boxesPacked, 0),
      },
      pickers: pickerRows,
      bins: binRows.map((b) => ({
        ...b,
        shortLineRate: ratio(b.linesShort, b.linesTotal),
      })),
      packers: packerRows.map((p) => ({
        ...p,
        scanVerifiedRate: ratio(p.unitsScanned, p.unitsPacked),
      })),
      shortReasons: reasonRows,
    };
  });
}
