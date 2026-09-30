// SEO — reporting reads (docs/50 §7, docs/97 §5).
//
//   GET /v1/seo/reports/checklist
//     → site-wide technical checklist: every distinct audit check, aggregated
//       across all stored page audits (how many pages pass / warn / fail), with
//       a derived per-check site status + pass rate
//   GET /v1/seo/reports/activity?limit=
//     → recent audit runs (newest computed first) — the SEO activity feed
//
// LIVE aggregates over `seo_audits` (the stored Scorecard snapshots). The
// checklist unnests each audit's `card->'checks'` JSON and rolls the per-page
// CheckResults up by check id — so "Structured data: 12/18 pages pass" is the
// real signal, not an invented sitemap/robots/CWV row. Search-Console organic
// metrics (clicks / impressions / position / top queries) are NOT here — those
// need GSC ingestion (workload B) and stay sample on the overview.
//
// Viewer-read, tenant-scoped via withRequestTenant (FORCE RLS on seo_audits).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
// The one list of what each check is CALLED, so the roll-up below stops taking it
// from whichever stored card happens to be newest (issue 863).
import { CHECK_LABELS } from '@wizeworks/seo-audit';
import { storedPath } from '../../../lib/seo-audit.js';
import { resolveListScope } from '../../../lib/property.js';
import { auditsOnSiteSql } from './site-scope.js';

const ActivityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

type ChecklistStatus = 'pass' | 'warn' | 'fail' | 'info';

/** One recent scorecard as the activity feed reads it. Hand-named because the
 *  feed is a raw query, so the column aliases in it are the contract. */
interface ActivityRow {
  id: string;
  entityType: string;
  entityId: string;
  title: string | null;
  path: string | null;
  score: number;
  grade: string;
  fixFirst: string | null;
  computedAt: Date;
}

interface RawCheckRow {
  id: string;
  category: string;
  total: number;
  pass: number;
  warn: number;
  fail: number;
  info: number;
}

// Attention-first ordering: failing checks, then warnings, then clean.
const STATUS_RANK: Record<ChecklistStatus, number> = { fail: 0, warn: 1, pass: 2, info: 3 };

function deriveStatus(scored: number, fail: number, warn: number): ChecklistStatus {
  if (fail > 0) return 'fail';
  if (warn > 0) return 'warn';
  if (scored > 0) return 'pass';
  return 'info';
}

const seoReportRoutes: FastifyPluginAsync = (app) => {
  // ── Technical checklist: per-check site-wide pass/warn/fail roll-up ──
  app.get('/v1/seo/reports/checklist', async (request) => {
    const auth = requireRole(request, 'viewer');
    const propertyId = await resolveListScope(
      auth,
      undefined,
      request.headers['x-sparx-property-id']
    );
    return withRequestTenant(request, async (tx) => {
      const [rows, scoredRows] = await Promise.all([
        // ── GROUPED BY `id` ALONE, NOT BY THE WORDS ──────────────────────
        //
        // A stored card is a SNAPSHOT: it keeps the label the checks carried on
        // the day that page was scored, and a page is only re-scored when it is
        // saved or the owner runs a scan. So a site normally holds cards written
        // by several versions of the rules at once.
        //
        // Grouping by (id, label, category) made every rewording split one check
        // into two rows. After the plain-English pass, one live site showed all
        // THIRTEEN checks twice — "Title length, 33 of 37" directly above "How
        // long the title is, 52 of 93" — which reads as twenty-six different
        // problems, each with a denominator that is only the share of pages that
        // happen to hold that wording.
        //
        // The `id` is the check's real identity and has never changed, so it is
        // what groups.
        //
        // THE WORDS NO LONGER COME FROM THE NEWEST ROW. That was this comment's
        // next line, and it claimed the newest card holds "the wording the product
        // uses today". It does not: a card is only rewritten when its page is saved
        // or somebody runs a scan, so on a site nobody has rescanned since the
        // plain-English pass the newest row is the OLDEST wording. Measured
        // 2026-09-28: 15 of the 16 businesses on this database, every one of their
        // scorecards, every one of the thirteen checks (issue 863). The label now
        // comes from `CHECK_LABELS`, which is a fact about the code and not about
        // which page happened to be saved last.
        // [[feedback_never_present_absence_as_measurement]]
        tx.$queryRaw<RawCheckRow[]>`
          SELECT
            chk->>'id' AS id,
            (array_agg(chk->>'category' ORDER BY a.computed_at DESC))[1] AS category,
            COUNT(*)::int                                        AS total,
            COUNT(*) FILTER (WHERE chk->>'status' = 'pass')::int AS pass,
            COUNT(*) FILTER (WHERE chk->>'status' = 'warn')::int AS warn,
            COUNT(*) FILTER (WHERE chk->>'status' = 'fail')::int AS fail,
            COUNT(*) FILTER (WHERE chk->>'status' = 'info')::int AS info
          FROM seo_audits a
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(a.card -> 'checks') = 'array'
                 THEN a.card -> 'checks' ELSE '[]'::jsonb END
          ) AS chk
          -- The shared predicate, not a fourth spelling of it. This query used
          -- to inline the pin-only rule, which is how it went on counting
          -- another site's products after the list stopped (issue 639).
          WHERE ${auditsOnSiteSql(propertyId)}
          GROUP BY 1
        `,
        // The DENOMINATOR under "average score", so it has to be counted by the
        // same rule the scores are averaged over.
        tx.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*)::bigint AS n FROM seo_audits a WHERE ${auditsOnSiteSql(propertyId)}
        `,
      ]);

      // COUNT(*) comes back as a bigint, which does not survive JSON.
      const pagesScored = Number(scoredRows[0]?.n ?? 0);

      const checks = rows
        .map((r) => {
          const pass = Number(r.pass);
          const warn = Number(r.warn);
          const fail = Number(r.fail);
          const info = Number(r.info);
          const scored = Number(r.total) - info;
          const status = deriveStatus(scored, fail, warn);
          return {
            id: r.id,
            // From the code, never from a row. A check whose id has no entry falls
            // back to the id itself, which is loud rather than wrong.
            label: CHECK_LABELS[r.id] ?? r.id,
            category: r.category,
            status,
            pagesPass: pass,
            pagesWarn: warn,
            pagesFail: fail,
            pagesScored: scored,
            passRate: scored > 0 ? +(pass / scored).toFixed(4) : null,
          };
        })
        .sort((a, b) => {
          const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          if (byStatus !== 0) return byStatus;
          return (a.passRate ?? 1) - (b.passRate ?? 1);
        });

      const summary = {
        pagesScored,
        checks: checks.length,
        passing: checks.filter((c) => c.status === 'pass').length,
        warning: checks.filter((c) => c.status === 'warn').length,
        failing: checks.filter((c) => c.status === 'fail').length,
      };

      return ok({ summary, checks });
    });
  });

  // ── Activity feed: recent audit runs (newest computed first) ──
  app.get('/v1/seo/reports/activity', async (request) => {
    const auth = requireRole(request, 'viewer');
    const take = ActivityQuery.parse(request.query).limit ?? 12;
    const propertyId = await resolveListScope(
      auth,
      undefined,
      request.headers['x-sparx-property-id']
    );

    return withRequestTenant(request, async (tx) => {
      // Raw for the same reason the list is: the scope predicate reaches through
      // junction tables Prisma has no relation for. See ./site-scope.ts.
      const audits = await tx.$queryRaw<ActivityRow[]>`
        SELECT
          a.id, a.entity_type AS "entityType", a.entity_id AS "entityId",
          a.title, a.path, a.score, a.grade, a.fix_first AS "fixFirst",
          a.computed_at AS "computedAt"
        FROM seo_audits a
        WHERE ${auditsOnSiteSql(propertyId)}
        ORDER BY a.computed_at DESC
        LIMIT ${take}
      `;

      return ok(
        audits.map((a) => ({
          id: a.id,
          entityType: a.entityType,
          entityId: a.entityId,
          title: a.title,
          path: storedPath(a.path),
          score: a.score,
          grade: a.grade,
          fixFirst: a.fixFirst,
          computedAt: a.computedAt.toISOString(),
        }))
      );
    });
  });

  return Promise.resolve();
};

export default seoReportRoutes;
