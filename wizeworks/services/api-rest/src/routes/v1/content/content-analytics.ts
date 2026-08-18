// CMS — content performance from first-party site analytics (docs/97 §4/§5).
//
//   GET /v1/content/reports/top-content?from=&to=&limit=
//     → most-viewed published content entries over the window: clicks/visitors
//       per entry + the window total, joined from the site-analytics pageviews.
//
// Bridges two datasets that don't share a key: content_entries (what exists) and
// site_analytics_events (what got viewed, keyed by URL path). An entry's public
// path is `urlPattern.replace('{slug}', slug)` — the SAME construction the
// sitemap uses (routes/v1/sitemap.ts) — normalized with the same normalizePath
// the beacon applies on capture, so the two paths match exactly. Scoped to the
// ACTIVE web property (the site switcher's x-sparx-property-id), since pageviews
// and Model-B content visibility are both per-site.
//
// Viewer-read, tenant-scoped via withTenant (FORCE RLS on both tables). Returns
// an empty list until the site has captured pageviews to content, so the CMS
// overview treats it as "no data yet" and falls back to a badged sample.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';

import { contentSiteVisibilityWhere, resolvePropertyId } from '../../../lib/property.js';
import { normalizePath } from '../../../lib/site-analytics.js';

const TopContentQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Human title from an entry's JSON body, falling back to slug. */
function entryTitle(body: unknown, slug: string | null): string {
  if (body && typeof body === 'object' && 'title' in body) {
    const t = (body as { title?: unknown }).title;
    if (typeof t === 'string' && t.trim().length > 0) return t;
  }
  return slug && slug.length > 0 ? slug : '(untitled)';
}

interface PathAgg {
  path: string;
  views: number;
  visitors: number;
}

const contentAnalyticsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/content/reports/top-content', async (request) => {
    const auth = requireRole(request, 'viewer');
    const q = TopContentQuery.parse(request.query);
    const to = startOfUtcDay(q.to ? new Date(q.to) : new Date());
    const from = startOfUtcDay(q.from ? new Date(q.from) : addUtcDays(to, -29));
    const toExclusive = addUtcDays(to, 1);
    const limit = q.limit ?? 8;

    const header = request.headers['x-sparx-property-id'];
    const propertyId = await resolvePropertyId(auth, typeof header === 'string' ? header : null);

    return withTenant({ tenantId: auth.tenantId }, async (tx) => {
      // 1) Pageviews grouped by path for this site in the window.
      const agg = await tx.$queryRaw<PathAgg[]>`
        SELECT
          path,
          COUNT(*)::int                     AS views,
          COUNT(DISTINCT visitor_hash)::int AS visitors
        FROM site_analytics_events
        WHERE property_id = ${propertyId}::uuid
          AND type = 'pageview'
          AND created_at >= ${from} AND created_at < ${toExclusive}
        GROUP BY path
      `;
      const byPath = new Map(
        agg.map((r) => [r.path, { views: Number(r.views), visitors: Number(r.visitors) }])
      );

      // 2) Published, routable entries visible on this site + their type patterns.
      const entries = await tx.contentEntry.findMany({
        where: {
          status: 'published',
          deletedAt: null,
          slug: { not: null },
          ...contentSiteVisibilityWhere(propertyId),
        },
        select: { id: true, slug: true, typeKey: true, body: true, publishedAt: true },
      });
      const typeKeys = [...new Set(entries.map((e) => e.typeKey))];
      const types = typeKeys.length
        ? await tx.contentType.findMany({
            where: { key: { in: typeKeys }, urlPattern: { not: null } },
            select: { key: true, name: true, urlPattern: true },
          })
        : [];
      const patternByKey = new Map(
        types.flatMap((t) => (t.urlPattern ? [[t.key, t.urlPattern] as const] : []))
      );
      const nameByKey = new Map(types.map((t) => [t.key, t.name]));

      // 3) Match each entry to its captured pageviews via the resolved path.
      const matched = entries.flatMap((e) => {
        const pattern = patternByKey.get(e.typeKey);
        if (!pattern || !e.slug) return [];
        const path = normalizePath(pattern.replace('{slug}', e.slug));
        const stat = byPath.get(path);
        if (!stat || stat.views === 0) return [];
        return [
          {
            id: e.id,
            title: entryTitle(e.body, e.slug),
            typeKey: e.typeKey,
            typeName: nameByKey.get(e.typeKey) ?? e.typeKey,
            path,
            views: stat.views,
            visitors: stat.visitors,
            publishedAt: e.publishedAt?.toISOString() ?? null,
          },
        ];
      });

      const totalViews = matched.reduce((s, m) => s + m.views, 0);
      const items = matched.sort((a, b) => b.views - a.views).slice(0, limit);

      return ok({
        range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
        totalViews,
        contentPagesViewed: matched.length,
        items,
      });
    });
  });

  return Promise.resolve();
};

export default contentAnalyticsRoutes;
