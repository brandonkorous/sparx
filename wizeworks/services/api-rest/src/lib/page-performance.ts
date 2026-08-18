// Did the page you built actually work? — the Pages report (docs/builder-audit slice 22).
//
// THE GAP THIS CLOSES. Everything else in the builder tells an author what they made.
// Nothing told them whether it did anything. Traffic lives in site analytics, sales
// live in commerce, the search grade lives in the SEO module, and speed lives in web
// vitals — four modules, four surfaces, and no single answer to "is my About page
// pulling its weight". This is that join, and it is the builder's equivalent of what
// click attribution did for email: the owner finds out.
//
// WHY IT ASSEMBLES HERE. Same reason as `lib/site-check.ts`: the answer is gathered
// ACROSS modules, and a builder service reaching into commerce's orders and the SEO
// module's scores would be a builder service in name only.
//
// EVERY PAGE IS RETURNED, INCLUDING THE ONES NOBODY VISITED. A report that lists only
// pages with traffic answers the question the owner already knew the answer to. The
// page with 0 views is the most actionable row on the list, so it is never filtered
// out and never sorted away — it sorts last by traffic, where it is still visible.
//
// A COLLECTION TEMPLATE IS NOT A LOCATION. Its slug is a template address; visitors
// land on `/products/brake-kit`, never on the template. So its row AGGREGATES every
// path under the route its record type is served at — one line that says "every
// product page together did this", which is the only true statement available about a
// template that renders a thousand different pages.

import type { FastifyRequest } from 'fastify';
import type { PropertyContext } from '@wizeworks/builder';
import { isModuleEnabled } from '@wizeworks/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { normalizePath, routePrefixForRecordType } from '@wizeworks/site-lint';

import * as reports from './site-analytics-reports.js';

/** One page's whole story: what it is, how many people saw it, what it earned, how
 *  it reads to a search engine, and how long it takes to appear. */
export interface PagePerformanceRow {
  pageId: string;
  name: string;
  /** The path as authored, normalized. For a collection template this is the
   *  template's own address and NOT where visitors land — `pathPrefix` is. */
  path: string;
  /** Set only for a collection template: the route its records are served under
   *  (`/products/`). Its figures are the sum of every path beneath it. */
  pathPrefix: string | null;
  /** How many separate addresses the figures cover. 1 for an ordinary page; for a
   *  collection template, how many of its records were actually visited — which is
   *  itself worth knowing (400 products, 6 ever seen). */
  pathsCovered: number;
  views: number;
  visitors: number;
  orders: number;
  revenueCents: number;
  /** Orders per visitor, as a percentage, or null when nobody came — a page with no
   *  visitors has no conversion rate, and rendering that as 0% reads as failure
   *  rather than as silence. */
  conversionPct: number | null;
  /** Average real-user load time in ms, and how many measurements it is over. Null
   *  when no visitor's browser reported one; not zero, and never shown as fast. */
  loadMs: number | null;
  loadSamples: number;
  /** The stored search-engine grade, or null if this page has never been audited. */
  seoScore: number | null;
  seoGrade: string | null;
  /** The single highest-value change, in the SEO module's own words. */
  seoFixFirst: string | null;
  /** Deliberately hidden from search engines — so a missing SEO grade on this row is
   *  a decision, not an oversight. */
  noindex: boolean;
}

/** Traffic on a path this site served that no page in the builder owns — a CMS entry,
 *  a legal page, a route the storefront serves itself. Reported rather than dropped:
 *  without it the totals do not reconcile, and an owner comparing this against their
 *  traffic card would be looking at a quiet discrepancy nobody could explain. */
export interface UnownedPathRow {
  path: string;
  views: number;
  visitors: number;
  orders: number;
  revenueCents: number;
}

export interface PagePerformanceReport {
  range: { from: string; to: string };
  pages: PagePerformanceRow[];
  otherPaths: UnownedPathRow[];
  /** False when Commerce is off — there is no revenue to report, and a permanently
   *  empty money column on a publisher's report is noise, not information. */
  commerce: boolean;
  totals: {
    views: number;
    visitors: number;
    orders: number;
    revenueCents: number;
  };
}

const EMPTY_METRICS = {
  views: 0,
  visitors: 0,
  orders: 0,
  revenueCents: 0,
  loadMs: null as number | null,
  loadSamples: 0,
};

/** Orders per visitor as a percentage, to one decimal. Null when nobody came. */
function conversionOf(orders: number, visitors: number): number | null {
  if (visitors <= 0) return null;
  return Math.round((orders / visitors) * 1000) / 10;
}

/**
 * Fold several paths' figures into one row.
 *
 * VISITORS ARE SUMMED, NOT DEDUPLICATED, and that is a real limitation rather than an
 * oversight: one person who browsed four products counts four times here. Deduplicating
 * would mean a second `COUNT(DISTINCT visitor_hash)` per prefix, which is a query per
 * collection template on a report that already runs three. The number is honest as
 * "visits to product pages" and the surface words it that way.
 *
 * The load average is re-weighted by sample count rather than averaged — averaging
 * four averages treats a path with 2 measurements as equal to one with 2000.
 */
function fold(rows: readonly reports.PagePathMetrics[]): typeof EMPTY_METRICS {
  let views = 0;
  let visitors = 0;
  let orders = 0;
  let revenueCents = 0;
  let loadTotal = 0;
  let loadSamples = 0;
  for (const row of rows) {
    views += row.views;
    visitors += row.visitors;
    orders += row.orders;
    revenueCents += row.revenueCents;
    if (row.loadMs != null && row.loadSamples > 0) {
      loadTotal += row.loadMs * row.loadSamples;
      loadSamples += row.loadSamples;
    }
  }
  return {
    views,
    visitors,
    orders,
    revenueCents,
    loadMs: loadSamples > 0 ? Math.round(loadTotal / loadSamples) : null,
    loadSamples,
  };
}

/**
 * How each page of a site is doing, over a window.
 *
 * Exported for its test, separately from the I/O: everything below is the assembly,
 * and the assembly is where a page can quietly claim the wrong traffic.
 */
export function assemble(
  pages: readonly {
    id: string;
    name: string;
    slug: string | null;
    kind: string;
    recordType: string | null;
    noindex: boolean;
  }[],
  metrics: readonly reports.PagePathMetrics[],
  audits: ReadonlyMap<string, { score: number; grade: string; fixFirst: string | null }>,
  commerce: boolean
): Omit<PagePerformanceReport, 'range'> {
  const byPath = new Map<string, reports.PagePathMetrics>();
  for (const row of metrics) byPath.set(normalizePath(row.path), row);

  /** Paths already credited to a page, so nothing is counted twice and the leftovers
   *  are exactly what no page owns. */
  const claimed = new Set<string>();

  const rows: PagePerformanceRow[] = pages.map((page) => {
    // A NULL SLUG IS "NO ADDRESS", NOT "THE HOME PAGE".
    //
    // This read `page.slug ?? '/'`, which is the difference between an empty string and
    // null quietly collapsing: the home page is slug `''`, so an unaddressed page fell onto
    // the SAME `/` and looked up the same metrics row. Both then rendered as `/` with
    // identical figures, and reading down the People column double-counted every visit the
    // site's busiest page had. Seen live 2026-08-02: "Home" and "Home — Landing" each
    // claiming 10 people / 103 opens / 5.0s, for one page's traffic.
    //
    // An unaddressed page is still LISTED — a page nobody can reach is exactly the kind of
    // thing this table exists to surface — but it owns no path, claims no metrics, and
    // leaves the home page's traffic to the home page.
    const slug = page.slug;
    const addressed = slug != null;
    const path = slug != null ? normalizePath(slug) : '';
    const prefix =
      page.kind === 'collection' && page.recordType
        ? routePrefixForRecordType(page.recordType)
        : null;

    let matched: reports.PagePathMetrics[];
    if (prefix) {
      matched = [...byPath.entries()]
        .filter(([p]) => p.startsWith(prefix))
        .map(([p, row]) => {
          claimed.add(p);
          return row;
        });
    } else if (addressed) {
      const own = byPath.get(path);
      matched = own ? [own] : [];
      claimed.add(path);
    } else {
      matched = [];
    }

    const folded = matched.length > 0 ? fold(matched) : EMPTY_METRICS;
    const audit = audits.get(page.id);
    return {
      pageId: page.id,
      name: page.name,
      path,
      pathPrefix: prefix,
      // Zero for an unaddressed page: it covers no path, so saying "1" would claim it
      // stands for a URL somewhere.
      pathsCovered: prefix ? matched.length : addressed ? 1 : 0,
      ...folded,
      orders: commerce ? folded.orders : 0,
      revenueCents: commerce ? folded.revenueCents : 0,
      conversionPct: commerce ? conversionOf(folded.orders, folded.visitors) : null,
      seoScore: audit?.score ?? null,
      seoGrade: audit?.grade ?? null,
      seoFixFirst: audit?.fixFirst ?? null,
      noindex: page.noindex,
    };
  });

  // Busiest first, and a page with no traffic sorts to the bottom by name rather than
  // by whatever order the database returned — a stable list is a list you can scan
  // twice and trust.
  rows.sort((a, b) => b.views - a.views || a.name.localeCompare(b.name));

  const otherPaths: UnownedPathRow[] = [...byPath.entries()]
    .filter(([path]) => !claimed.has(path))
    .map(([path, row]) => ({
      path,
      views: row.views,
      visitors: row.visitors,
      orders: commerce ? row.orders : 0,
      revenueCents: commerce ? row.revenueCents : 0,
    }))
    .sort((a, b) => b.views - a.views);

  const everything = fold(metrics);
  return {
    pages: rows,
    otherPaths,
    commerce,
    totals: {
      views: everything.views,
      visitors: everything.visitors,
      orders: commerce ? everything.orders : 0,
      revenueCents: commerce ? everything.revenueCents : 0,
    },
  };
}

export async function pagePerformance(
  request: FastifyRequest,
  ctx: PropertyContext,
  range: { from: Date; toExclusive: Date }
): Promise<PagePerformanceReport> {
  const commerce = await isModuleEnabled(ctx.tenantId, 'commerce').catch(() => false);

  return withRequestTenant(request, async (tx) => {
    const [pages, metrics] = await Promise.all([
      tx.builderPage.findMany({
        where: { propertyId: ctx.propertyId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          kind: true,
          recordType: true,
          noindex: true,
        },
      }),
      reports.pageMetrics(tx, ctx.propertyId, range.from, range.toExclusive),
    ]);

    // Scores are looked up by the pages we found rather than by property: an audit
    // row carries `property_id` only for single-site entities, and keying on the ids
    // in hand is right either way.
    const auditRows = await tx.seoAudit.findMany({
      where: { entityType: 'builder_page', entityId: { in: pages.map((p) => p.id) } },
      select: { entityId: true, score: true, grade: true, fixFirst: true },
    });
    const audits = new Map(
      auditRows.map((a) => [a.entityId, { score: a.score, grade: a.grade, fixFirst: a.fixFirst }])
    );

    return {
      range: {
        from: range.from.toISOString(),
        to: range.toExclusive.toISOString(),
      },
      ...assemble(pages, metrics, audits, commerce),
    };
  });
}
