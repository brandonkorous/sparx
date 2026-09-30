// SEO audit — live scorecard, stored snapshots, and reindex (docs/50 §7).
//
//   GET  /v1/seo/audit?type=<entity>&id=<uuid>   live audit (computes + stores)
//   GET  /v1/seo/audits[?type=<entity>]          list stored snapshots (overview)
//   POST /v1/seo/audits/reindex                  recompute + store every entity
//
// All authed (dashboard). The live audit recomputes fresh so the editor never
// shows a stale number AND upserts the snapshot; the overview reads snapshots so
// it can rank the whole site without firing N live audits. The mapping from DB
// rows to the engine's input lives in `lib/seo-audit.ts`.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';
import type { EntityType, Scorecard } from '@wizeworks/seo-audit';
// Re-says a stored card in today's words without changing a single finding. The
// stored `fix_first` column is a COPY of one check's advice, so it aged with the
// labels (issue 863).
import { refreshCard } from '@wizeworks/seo-audit';

import { auditAndStore, storedPath } from '../../../lib/seo-audit.js';
import { resolveListScope } from '../../../lib/property.js';
import { auditsOnSiteSql } from './site-scope.js';

const ENTITY_TYPES = ['builder_page', 'cms_page', 'product', 'collection'] as const;

const AuditQuery = z.object({
  type: z.enum(ENTITY_TYPES),
  id: z.string().uuid(),
});

const ListQuery = z.object({
  type: z.enum(ENTITY_TYPES).optional(),
});

/** One stored scorecard as the overview reads it. Hand-named because the list is
 *  a raw query (see below), so the column aliases above are the contract. */
interface AuditListRow {
  id: string;
  entityType: string;
  entityId: string;
  score: number;
  grade: string;
  fixFirst: string | null;
  title: string | null;
  path: string | null;
  computedAt: Date;
  /** The stored scorecard, selected so the `fixFirst` SENTENCE can be re-said in
   *  today's words. `fix_first` is a column holding a copy of one check's advice
   *  at the moment the page was scored, so it aged the way the labels did — this
   *  is the row that read "Add a single H1 — it tells search engines the page's
   *  main topic" on a console whose own vocabulary says "One main heading"
   *  (issue 863). */
  card: unknown;
}

// Per-type cap on a single reindex pass — a guard against an unbounded scan, not
// a real limit at Phase-1 catalog sizes. A larger site moves this to a job.
const REINDEX_LIMIT = 500;

/**
 * One stored card's "fix first" line, re-said in today's words.
 *
 * Null when the blob is not a card this build understands, which is a real answer
 * for a row written by a future version or corrupted by hand — the caller keeps
 * the stored sentence rather than showing nothing.
 */
function refreshedFixFirst(card: unknown, entityType: string): string | null {
  if (card === null || typeof card !== 'object') return null;
  if (!ENTITY_TYPES.includes(entityType as EntityType)) return null;
  const checks = (card as { checks?: unknown }).checks;
  if (!Array.isArray(checks)) return null;
  return refreshCard(card as Scorecard, entityType as EntityType).fixFirst ?? null;
}

const seoAuditRoutes: FastifyPluginAsync = (app) => {
  // ── Live audit (compute + store) ──────────────────────────────────────────
  app.get('/v1/seo/audit', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { type, id } = AuditQuery.parse(request.query);
    const card = await withRequestTenant(request, (tx) =>
      auditAndStore(tx, auth.tenantId, type, id)
    );
    if (!card) throw notFound('Entity', id);
    return ok(card);
  });

  // ── Stored snapshots for the overview ─────────────────────────────────────
  app.get('/v1/seo/audits', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { type } = ListQuery.parse(request.query);
    // The overview's four tiles are computed from THIS list, so an unscoped read
    // put another site's pages into her score (issue 391).
    const propertyId = await resolveListScope(
      auth,
      undefined,
      request.headers['x-sparx-property-id']
    );
    // RAW, because the scope predicate has to reach through the junction tables
    // the three non-builder entity types use for their own site visibility, and
    // `entity_id` is polymorphic so Prisma has no relation to traverse. See
    // ./site-scope.ts. RLS still applies — `withRequestTenant` sets the tenant
    // for the transaction, and this runs inside it like every other read.
    const rows = await withRequestTenant(
      request,
      (tx) =>
        tx.$queryRaw<AuditListRow[]>`
        SELECT
          a.id, a.entity_type AS "entityType", a.entity_id AS "entityId",
          a.score, a.grade, a.fix_first AS "fixFirst", a.title, a.path,
          a.computed_at AS "computedAt", a.card
        FROM seo_audits a
        WHERE ${auditsOnSiteSql(propertyId)}
          AND (${type ?? null}::text IS NULL OR a.entity_type = ${type ?? null}::text)
        -- Worst-scoring first: the overview's whole point is "what needs work".
        ORDER BY a.score ASC, a.computed_at DESC
      `
    );
    return ok(
      rows.map(({ card, ...row }) => ({
        ...row,
        path: storedPath(row.path),
        // Said in today's words. The card itself is not returned — this list shows
        // a score, a grade and one sentence — so only the sentence is refreshed.
        // A card too old or too odd to read leaves the stored line alone rather
        // than blanking it: a worse sentence beats no sentence.
        fixFirst: refreshedFixFirst(card, row.entityType) ?? row.fixFirst,
      }))
    );
  });

  // ── Reindex the whole site ────────────────────────────────────────────────
  app.post('/v1/seo/audits/reindex', async (request) => {
    const auth = requireRole(request, 'editor');
    const result = await withRequestTenant(request, async (tx) => {
      const [builderPages, entries, products, collections] = await Promise.all([
        tx.builderPage.findMany({
          where: { kind: 'singleton' },
          select: { id: true },
          take: REINDEX_LIMIT,
        }),
        tx.contentEntry.findMany({
          where: { deletedAt: null },
          select: { id: true },
          take: REINDEX_LIMIT,
        }),
        tx.product.findMany({
          where: { deletedAt: null },
          select: { id: true },
          take: REINDEX_LIMIT,
        }),
        tx.productCollection.findMany({
          where: { deletedAt: null },
          select: { id: true },
          take: REINDEX_LIMIT,
        }),
      ]);

      const work: [EntityType, string][] = [
        ...builderPages.map((r): [EntityType, string] => ['builder_page', r.id]),
        ...entries.map((r): [EntityType, string] => ['cms_page', r.id]),
        ...products.map((r): [EntityType, string] => ['product', r.id]),
        ...collections.map((r): [EntityType, string] => ['collection', r.id]),
      ];

      let reindexed = 0;
      for (const [type, id] of work) {
        if (await auditAndStore(tx, auth.tenantId, type, id)) reindexed += 1;
      }
      const truncated =
        builderPages.length === REINDEX_LIMIT ||
        entries.length === REINDEX_LIMIT ||
        products.length === REINDEX_LIMIT ||
        collections.length === REINDEX_LIMIT;
      return { reindexed, truncated };
    });
    return ok(result);
  });

  return Promise.resolve();
};

export default seoAuditRoutes;
