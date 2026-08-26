// The read model — a ladder with counts, rates and attributed value.
//
// This is the thing a tenant actually looks at, so its job is to answer "where
// are people falling out" in one glance. Everything here is derived; nothing is
// stored, so a definition change is a deploy rather than a backfill.

import { Prisma, withTenant, type TenantContext, type TxClient } from '@wizeworks/db';
import type { Funnel } from '@prisma/client';

import { stagesOf } from './index.js';
import { pathForSlug, stagePath, type StageKind } from './schemas.js';

export interface LadderRung {
  key: string;
  name: string;
  kind: StageKind;
  /**
   * How many people reached this rung in the window, or null when nobody can
   * say.
   *
   * The two halves are counted from different sources and it is not an
   * implementation detail: a `view` rung is DISTINCT VISITORS to its page, read
   * from site analytics, and every rung below the capture line is DISTINCT
   * SUBJECTS, read from the stage events. Both are window-unique — somebody who
   * came back four times is one person who got here.
   *
   * Null only for a view rung with no page to count (its landing page was
   * deleted). Zero would state as a measurement what is actually a missing
   * address.
   */
  entered: number | null;
  /**
   * Share of the rung ABOVE that got here, or null when the rung above was
   * empty.
   *
   * Null, never 0. "Nobody reached the stage above, so this rate does not exist"
   * and "everybody who reached it dropped out" are opposite facts, and a
   * defaulted 0% reports a catastrophe where there is only an absence of data.
   * The same reason every rate in the commerce funnel report became nullable.
   */
  conversionFromPrevious: number | null;
  /** Share of the FIRST rung that got here, or null when the funnel is empty. */
  conversionFromEntry: number | null;
  /** Attributed value in cents. Only ever non-zero on the converting rung. */
  valueCents: number;
  /** The page this rung counts, for a view rung the reader can then go and look
   *  at. Null on every rung below the capture line, which is reached by doing
   *  something rather than by being somewhere. */
  path: string | null;
}

export interface Ladder {
  funnelId: string;
  from: Date;
  to: Date;
  rungs: LadderRung[];
  /** Total attributed value across the window, in cents. */
  valueCents: number;
  /**
   * End-to-end conversion, or null when nobody entered.
   *
   * Null rather than 0 for the reason above, and it matters most here: this is
   * the number that goes on a card at the top of the page, and "0%" on a
   * campaign that launched yesterday reads as failure rather than as silence.
   */
  overallRate: number | null;
}

/**
 * Build the ladder for one funnel over a window.
 *
 * Reads the RAW stage events rather than the daily rollup, deliberately. The
 * rollup is a per-day aggregate, and a person who entered on Monday and
 * converted on Thursday is one subject in the funnel and two rows in the rollup
 * — summing days would count them twice and produce rates above 100%. The
 * rollup exists for the CHART (a value per day, correct per bucket); the ladder
 * needs window-unique subjects, which only the raw rows can give.
 *
 * This is the same distinction `rollup_site_daily` carries on `visitors`, and
 * getting it backwards is the classic way a funnel report ends up impossible.
 *
 * View rungs are read the same way from `site_analytics_events` — one distinct
 * count over the whole window, not a sum of daily rollup rows, for exactly the
 * reason above.
 */
export async function buildLadder(
  ctx: TenantContext,
  funnel: Funnel,
  range: { from: Date; to: Date }
): Promise<Ladder> {
  const stages = stagesOf(funnel);
  const viewStages = stages.filter((s) => s.kind === 'view');

  const read = await withTenant(ctx, async (tx) => {
    const events = await tx.funnelStageEvent.findMany({
      where: {
        funnelId: funnel.id,
        occurredAt: { gte: range.from, lte: range.to },
      },
      select: {
        stageKey: true,
        customerId: true,
        subjectEmail: true,
        valueCents: true,
      },
    });
    // Only looked up when the ladder actually has an anonymous rung. Most do not
    // (a recovery or winback funnel starts at a person), and this is a read on
    // the hot path of the surface a tenant opens most.
    const entryPath = viewStages.length > 0 ? await entryPathOf(tx, funnel.entryPageId) : null;
    const paths = new Map<string, string>();
    for (const stage of viewStages) {
      const path = stagePath(stage, entryPath);
      if (path !== null) paths.set(stage.key, path);
    }
    return { events, paths, visitors: await countVisitors(tx, funnel.propertyId, paths, range) };
  });

  // Window-unique per rung. A person who hit the same stage three times is one
  // person who reached it, not three — a funnel counts people, not events.
  const subjectsByStage = new Map<string, Set<string>>();
  const valueByStage = new Map<string, bigint>();
  for (const row of read.events) {
    // One of the two is always set (a CHECK constraint guarantees it), and
    // prefixing keeps a customer id from ever colliding with an address.
    const subject = row.customerId ? `c:${row.customerId}` : `e:${row.subjectEmail ?? ''}`;
    const set = subjectsByStage.get(row.stageKey) ?? new Set<string>();
    set.add(subject);
    subjectsByStage.set(row.stageKey, set);

    if (row.valueCents !== null) {
      valueByStage.set(row.stageKey, (valueByStage.get(row.stageKey) ?? 0n) + row.valueCents);
    }
  }

  /** How many reached one rung, reading whichever half of the line it sits on.
   *  A view rung with no page returns null rather than a confident zero. */
  const countFor = (stage: (typeof stages)[number]): number | null =>
    stage.kind === 'view'
      ? (read.visitors.get(stage.key) ?? null)
      : (subjectsByStage.get(stage.key)?.size ?? 0);

  const entryCount = stages[0] ? countFor(stages[0]) : null;

  let previousCount: number | null = null;
  const rungs: LadderRung[] = stages.map((stage) => {
    const entered = countFor(stage);
    const rung: LadderRung = {
      key: stage.key,
      name: stage.name,
      kind: stage.kind,
      entered,
      conversionFromPrevious: rate(entered, previousCount),
      conversionFromEntry: rate(entered, entryCount),
      valueCents: Number(valueByStage.get(stage.key) ?? 0n),
      path: read.paths.get(stage.key) ?? null,
    };
    previousCount = entered;
    return rung;
  });

  const convertRung = rungs.find((r) => r.kind === 'convert');

  return {
    funnelId: funnel.id,
    from: range.from,
    to: range.to,
    rungs,
    valueCents: rungs.reduce((sum, r) => sum + r.valueCents, 0),
    overallRate: rate(convertRung?.entered ?? null, entryCount),
  };
}

/** The path a funnel's landing page serves at, or null when it has none. */
async function entryPathOf(tx: TxClient, entryPageId: string | null): Promise<string | null> {
  if (!entryPageId) return null;
  const page = await tx.builderPage.findUnique({
    where: { id: entryPageId },
    select: { slug: true },
  });
  return page ? pathForSlug(page.slug) : null;
}

/**
 * Distinct visitors to each view rung's page across the WHOLE window.
 *
 * One query for every rung, then fanned back out by path, because two rungs can
 * legitimately point at the same page and a query each would scan the same
 * events twice. `COUNT(DISTINCT visitor_hash)` is the same figure
 * `rollup_site_daily.visitors` carries, computed over the window rather than per
 * day — summing the daily rows would count a visitor who came back on Tuesday
 * twice, which is the mistake this whole file exists to avoid.
 */
async function countVisitors(
  tx: TxClient,
  propertyId: string,
  pathsByStage: Map<string, string>,
  range: { from: Date; to: Date }
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const paths = [...new Set(pathsByStage.values())];
  if (paths.length === 0) return out;

  const rows = await tx.$queryRaw<{ path: string; visitors: number }[]>`
    SELECT path, COUNT(DISTINCT visitor_hash)::int AS visitors
    FROM site_analytics_events
    WHERE property_id = ${propertyId}::uuid
      AND type = 'pageview'
      AND created_at >= ${range.from}
      AND created_at <= ${range.to}
      AND path IN (${Prisma.join(paths)})
    GROUP BY path
  `;
  const byPath = new Map(rows.map((r) => [r.path, Number(r.visitors)]));
  for (const [stageKey, path] of pathsByStage) {
    out.set(stageKey, byPath.get(path) ?? 0);
  }
  return out;
}

/** A rate, or NULL when either side of it is missing. Same shape and same
 *  reasoning as the commerce reporting service: an absence must never render as
 *  a measurement of zero, and a rate off an uncounted rung is an absence on both
 *  sides of the divide. */
function rate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}
