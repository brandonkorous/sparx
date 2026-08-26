// The nightly reconcile that maintains `rollup_funnel_daily`.
//
// Same shape as the site-analytics reconcile it sits beside (docs/97 §5):
// recompute a trailing window from the source of truth and overwrite it. The
// source is always recomputable, so delete-then-insert is strictly correct and
// cheaper than an incremental consumer — and the READ live-overlays the open day
// so "today" is fresh without one.
//
// ── THE ROLLUP AND THE LADDER ANSWER DIFFERENT QUESTIONS ────────────────────
//
// A row here is "how many DISTINCT subjects reached this rung ON THIS DAY". That
// charts correctly per bucket and must NOT be summed across days for a
// window-unique figure — somebody who entered Monday and converted Thursday is
// one person in the funnel and two rows here. `buildLadder` reads the raw events
// for exactly that reason. Same caveat `rollup_site_daily.visitors` carries.
//
// ── TWO SOURCES, ONE TABLE, AND WHY THE BEACON DOES NOT WRITE HERE ──────────
//
// docs/151 §4 sketched the anonymous half as "the beacon increments
// rollup_funnel_daily at ingestion". That cannot work beside a delete-then-insert
// reconcile: the first nightly run over the window would erase every incremented
// count, and nothing would say so. It also contradicts the schema's own claim
// that this table is recomputable from source — an incremented counter IS the
// source, and then losing it loses the data.
//
// So both halves are DERIVED here, from the two places the facts already live:
//
//   · below the capture line — funnel_stage_events, one row per known person.
//   · above it — site_analytics_events, counted as DISTINCT visitor_hash on the
//     rung's page. That table is where the rotating hash legitimately lives (it
//     is the window it was designed to expire inside), and counting it is the
//     same thing rollup_site_daily.visitors already does. No identity crosses
//     into a funnel row, which is the whole constraint.
//
// The two writes touch DISJOINT rows: stage keys are unique within a ladder and
// `recordStage` refuses a view rung, so a key is counted by exactly one of them.

import { Prisma, withTenant, type TenantContext, type TxClient } from '@wizeworks/db';

import { FunnelStages, pathForSlug, stagePath } from './schemas.js';

export interface ReconcileResult {
  /** Rollup rows written. */
  rows: number;
  /** Days recomputed. */
  days: number;
  /** Funnels whose stored ladder did not parse and were left out. Surfaced
   *  rather than swallowed: one bad row must not kill a tenant's whole nightly
   *  run, and it must not vanish either. */
  skipped: number;
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Recompute `rollup_funnel_daily` for one tenant over `[from, toExclusive)`.
 *
 * MUST be called inside `withTenant` — every table it touches is FORCE RLS, so
 * without a tenant context this writes and reads nothing while reporting
 * success. The caller enumerates tenants from the non-RLS `tenants` dispatch
 * row, never by relation into one of these tables: a platform-level relation
 * query returns zero rows in production and the whole job silently no-ops. That
 * failure is invisible locally, where the owner role is a superuser.
 */
export async function reconcileFunnelDaily(
  ctx: TenantContext,
  from: Date,
  toExclusive: Date
): Promise<ReconcileResult> {
  const windowStart = startOfUtcDay(from);
  const windowEnd = startOfUtcDay(toExclusive);
  const days = Math.max(
    0,
    Math.round((windowEnd.getTime() - windowStart.getTime()) / (24 * 60 * 60 * 1000))
  );
  if (days === 0) return { rows: 0, days: 0, skipped: 0 };

  return withTenant(ctx, async (tx) => {
    // Delete-then-insert over the window, in one transaction, so a reader never
    // sees a half-rebuilt day. Idempotent by construction: running it twice
    // produces the same rows, which is what makes it usable as the backfill too.
    await tx.rollupFunnelDaily.deleteMany({
      where: { bucket: { gte: windowStart, lt: windowEnd } },
    });

    // Aggregated in Postgres rather than in Node. The alternative is streaming
    // every stage event for the window into memory to group it, which is fine on
    // a laptop and is not fine for a tenant with a year of traffic.
    //
    // `entered` counts DISTINCT SUBJECTS, not rows: COALESCE picks whichever of
    // the two identity columns is set (a CHECK guarantees exactly one), and the
    // prefix keeps a customer id from colliding with an address. Counting rows
    // instead would report somebody who opened the same email twice as two
    // people, which is how a funnel ends up with a stage above 100%.
    const inserted = await tx.$executeRaw`
      INSERT INTO rollup_funnel_daily
        (tenant_id, property_id, funnel_id, stage_key, bucket, entered, converted, value_cents, updated_at)
      SELECT
        e.tenant_id,
        e.property_id,
        e.funnel_id,
        e.stage_key,
        (e.occurred_at AT TIME ZONE 'UTC')::date AS bucket,
        COUNT(DISTINCT COALESCE('c:' || e.customer_id::text, 'e:' || e.subject_email))::int AS entered,
        -- The conversion count belongs to the converting rung and to no other.
        -- Counting it on every rung would make each stage look like it converted
        -- everyone who passed through it.
        COUNT(DISTINCT CASE
          WHEN s.kind = 'convert'
          THEN COALESCE('c:' || e.customer_id::text, 'e:' || e.subject_email)
        END)::int AS converted,
        COALESCE(SUM(e.value_cents), 0)::bigint AS value_cents,
        now()
      FROM funnel_stage_events e
      JOIN funnels f ON f.id = e.funnel_id
      -- The ladder is a JSON document, so the stage's KIND is read out of it
      -- rather than joined from a table. stage_key is the join key and the
      -- stable identity: a renamed stage keeps matching, which is the whole
      -- reason the key and the display name are different things.
      LEFT JOIN LATERAL (
        SELECT stage->>'kind' AS kind
        FROM jsonb_array_elements(f.stages) AS stage
        WHERE stage->>'key' = e.stage_key
        LIMIT 1
      ) s ON true
      WHERE e.occurred_at >= ${windowStart}
        AND e.occurred_at < ${windowEnd}
      GROUP BY e.tenant_id, e.property_id, e.funnel_id, e.stage_key, bucket
    `;

    const views = await reconcileViewRungs(tx, ctx.tenantId, windowStart, windowEnd);

    return { rows: inserted + views.rows, days, skipped: views.skipped };
  });
}

/** One view rung of one funnel, and the page that counts as reaching it. */
interface ViewRung {
  funnelId: string;
  propertyId: string;
  stageKey: string;
  path: string;
}

/**
 * The anonymous half: distinct visitors to each view rung's page, per day.
 *
 * Resolved in TypeScript rather than in the SQL because the slug-to-path
 * convention (home is a null slug) would otherwise exist twice, and the copy in
 * a raw string is the one that goes stale silently. `pathForSlug` is the single
 * definition; this reads it, the ladder reads it, and the activation check reads
 * it.
 */
async function reconcileViewRungs(
  tx: TxClient,
  tenantId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<{ rows: number; skipped: number }> {
  const funnels = await tx.funnel.findMany({
    select: { id: true, propertyId: true, stages: true, entryPageId: true },
  });
  if (funnels.length === 0) return { rows: 0, skipped: 0 };

  // Entry pages in one read. `entry_page_id` is SetNull, so a funnel can point at
  // a page that no longer exists; that resolves to no path and the rung is left
  // uncounted rather than counted as zero.
  const entryIds = [...new Set(funnels.map((f) => f.entryPageId).filter((id) => id !== null))];
  const pages =
    entryIds.length > 0
      ? await tx.builderPage.findMany({
          where: { id: { in: entryIds } },
          select: { id: true, slug: true },
        })
      : [];
  const entryPathById = new Map(pages.map((p) => [p.id, pathForSlug(p.slug)]));

  const rungs: ViewRung[] = [];
  let skipped = 0;
  for (const funnel of funnels) {
    const parsed = FunnelStages.safeParse(funnel.stages);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const entryPath = funnel.entryPageId ? (entryPathById.get(funnel.entryPageId) ?? null) : null;
    for (const stage of parsed.data) {
      const path = stagePath(stage, entryPath);
      if (path === null) continue;
      rungs.push({
        funnelId: funnel.id,
        propertyId: funnel.propertyId,
        stageKey: stage.key,
        path,
      });
    }
  }
  if (rungs.length === 0) return { rows: 0, skipped };

  // One grouped read for every path any rung points at, then fanned back out.
  // The alternative is a query per rung, which on a tenant with twenty funnels
  // is twenty scans of the same table for the same window.
  const paths = [...new Set(rungs.map((r) => r.path))];
  const propertyIds = [...new Set(rungs.map((r) => r.propertyId))];
  const counts = await tx.$queryRaw<
    { property_id: string; path: string; bucket: Date; visitors: number }[]
  >`
    SELECT
      property_id,
      path,
      (created_at AT TIME ZONE 'UTC')::date AS bucket,
      COUNT(DISTINCT visitor_hash)::int     AS visitors
    FROM site_analytics_events
    WHERE type = 'pageview'
      AND created_at >= ${windowStart}
      AND created_at < ${windowEnd}
      -- Cast each id rather than the column: parameters arrive as text, and
      -- uuid = text has no operator in Postgres. Casting the COLUMN instead
      -- would compile and then quietly stop using the index.
      AND property_id IN (${Prisma.join(propertyIds.map((id) => Prisma.sql`${id}::uuid`))})
      AND path IN (${Prisma.join(paths)})
    GROUP BY 1, 2, 3
  `;
  if (counts.length === 0) return { rows: 0, skipped };

  const byPage = new Map<string, { bucket: Date; visitors: number }[]>();
  for (const row of counts) {
    const key = `${row.property_id} ${row.path}`;
    const list = byPage.get(key) ?? [];
    list.push({ bucket: startOfUtcDay(new Date(row.bucket)), visitors: Number(row.visitors) });
    byPage.set(key, list);
  }

  const data = rungs.flatMap((rung) =>
    (byPage.get(`${rung.propertyId} ${rung.path}`) ?? []).map((day) => ({
      tenantId,
      propertyId: rung.propertyId,
      funnelId: rung.funnelId,
      stageKey: rung.stageKey,
      bucket: day.bucket,
      entered: day.visitors,
      // A view rung converts nobody and is worth nothing: converting is what the
      // rung at the bottom of the ladder counts, and a sum of no conversions is
      // honestly zero.
      converted: 0,
      valueCents: 0n,
    }))
  );
  if (data.length === 0) return { rows: 0, skipped };

  await tx.rollupFunnelDaily.createMany({ data });
  return { rows: data.length, skipped };
}
