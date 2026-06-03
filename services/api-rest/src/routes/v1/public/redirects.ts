// Public redirect resolution.
//
//   GET /v1/public/redirects/resolve?tenant=<slug>&path=<path>   (public — no auth)
//
// The storefront calls this only when a path would otherwise 404 (catch-all,
// PDP, collection). We flatten the chain — following up to 8 hops — so the
// storefront emits a single 3xx straight to the final destination, and bump the
// matched redirect's hit counter for the dashboard analytics column.
//
// 404 (Redirect not found) is the normal "no redirect here" answer; the caller
// treats it as "fall through to notFound()".

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';

const Query = z.object({
  tenant: z.string().min(1).max(63),
  path: z.string().min(1).max(2048),
});

const publicRedirectRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/redirects/resolve', async (request, reply) => {
    const { tenant: slug, path } = Query.parse(request.query);

    // Tenants table has no RLS; redirects do, so the chain walk runs inside
    // withTenant (mirrors the sitemap route's pattern).
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw notFound('Tenant', slug);

    const result = await withTenant({ tenantId: tenant.id }, async (tx) => {
      let current = path;
      let firstStatus = 301;
      let firstId: string | null = null;
      const seen = new Set<string>([current]);

      for (let hop = 0; hop < 8; hop++) {
        const row = await tx.redirect.findFirst({ where: { fromPath: current } });
        if (!row) break;
        if (firstId === null) {
          firstStatus = row.statusCode;
          firstId = row.id;
        }
        if (seen.has(row.toPath)) break; // loop guard (defensive; create-time also guards)
        seen.add(row.toPath);
        current = row.toPath;
      }

      if (firstId === null) return null;

      // Approximate analytics — only fires on cache miss (the storefront caches
      // the resolution), which is fine for a hit-count column.
      await tx.redirect
        .update({
          where: { id: firstId },
          data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
        })
        .catch(() => {
          /* analytics best-effort — never fail the redirect on a counter write */
        });

      return { toPath: current, statusCode: firstStatus };
    });

    if (!result) throw notFound('Redirect', path);

    // Short edge cache: redirects are stable, and the storefront also tags this
    // by tenant so a redirect.added/removed purge clears it.
    reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return ok(result);
  });

  return Promise.resolve();
};

export default publicRedirectRoutes;
