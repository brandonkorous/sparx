// Per-tenant sitemap.xml.
//
//   GET /v1/sitemap.xml?tenant=<slug>     (public — no auth)
//
// Streams a sitemap covering everything the storefront serves for a tenant:
// the home page, published CMS content entries (whose resolved content type
// carries a `urlPattern`), active commerce products (`/products/{handle}`) and
// collections (`/collections/{handle}`). The commerce index pages are only
// listed when the tenant actually has commerce content, so a content-only
// tenant doesn't advertise empty `/products` / `/collections` surfaces.
//
// The route runs outside auth/RLS because it's a public consumer endpoint, so
// we look up the tenant by slug and SET LOCAL the GUC ourselves. Pure-RLS is
// preserved: we never bypass it, just choose which tenant to scope to based on
// the public query parameter.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { badRequest, notFound } from '@sparx/api-core/errors';

const Query = z.object({ tenant: z.string().min(1).max(63) });

// Phase-1 catalogs are small; this is a guard against unbounded memory, not a
// real cap. A tenant past this needs a paginated sitemap index — far future.
const COMMERCE_URL_LIMIT = 20_000;

interface SitemapEntry {
  path: string;
  lastmod?: Date;
  changefreq?: string;
  priority?: number;
}

function xmlEscape(s: string): string {
  return s.replace(/[<>&"']/g, (ch) => {
    switch (ch) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function urlNode(baseUrl: string, e: SitemapEntry): string {
  const parts = [`<loc>${xmlEscape(`${baseUrl}${e.path}`)}</loc>`];
  if (e.lastmod) parts.push(`<lastmod>${e.lastmod.toISOString()}</lastmod>`);
  if (e.changefreq) parts.push(`<changefreq>${e.changefreq}</changefreq>`);
  if (e.priority != null) parts.push(`<priority>${e.priority.toFixed(1)}</priority>`);
  return `<url>${parts.join('')}</url>`;
}

const sitemapRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/sitemap.xml', async (request, reply) => {
    const { tenant: slug } = Query.parse(request.query);

    // Tenants table has no RLS, so we can look it up directly to get the id.
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw notFound('Tenant', slug);
    if (!tenant.settings) throw badRequest('Tenant has no published configuration.');

    const settings = tenant.settings as Record<string, unknown>;
    // sparx.works is the admin host; tenant storefronts live on
    // *.sparx.zone. The fallback used to point at .sparx.works (the dashboard
    // domain) so once any entry published the <loc> URLs would 404 against
    // the storefront. Default to the .sparx.zone subdomain unless the tenant
    // has explicitly set a primary domain.
    const baseUrl =
      typeof settings.primaryDomain === 'string'
        ? `https://${settings.primaryDomain}`
        : `https://${slug}.sparx.zone`;

    // Everything is read inside this tenant's RLS context in one round-trip.
    const { entries, types, products, collections, builderPages } = await withTenant(
      { tenantId: tenant.id },
      async (tx) => {
        const [entries, products, collections, builderPages] = await Promise.all([
          // Published, routable CMS entries.
          tx.contentEntry.findMany({
            where: { status: 'published', deletedAt: null, slug: { not: null } },
            select: { slug: true, typeKey: true, updatedAt: true, publishedAt: true },
          }),
          // Active commerce products — mirrors the public PDP visibility filter
          // (status active + not deleted).
          tx.product.findMany({
            where: { status: 'active', deletedAt: null },
            select: { handle: true, updatedAt: true, publishedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: COMMERCE_URL_LIMIT,
          }),
          // Collections — visible whenever not deleted (matches public reads).
          tx.productCollection.findMany({
            where: { deletedAt: null },
            select: { handle: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: COMMERCE_URL_LIMIT,
          }),
          // Published Builder SINGLETON pages that own a storefront slug (docs/50).
          // publishedAt is set on publish; noindex pages are filtered out below.
          tx.builderPage.findMany({
            where: { kind: 'singleton', slug: { not: null }, publishedAt: { not: null } },
            select: { slug: true, updatedAt: true, publishedAt: true, noindex: true },
          }),
        ]);

        // url patterns for the entry types in one more query.
        const typeKeys = Array.from(new Set(entries.map((r) => r.typeKey)));
        const types = typeKeys.length
          ? await tx.contentType.findMany({
              where: { key: { in: typeKeys }, urlPattern: { not: null } },
              select: { key: true, urlPattern: true },
            })
          : [];

        return { entries, types, products, collections, builderPages };
      }
    );

    const patterns = new Map(types.map((t) => [t.key, t.urlPattern!]));
    const seen = new Set<string>();
    const out: SitemapEntry[] = [];
    const push = (e: SitemapEntry) => {
      if (seen.has(e.path)) return;
      seen.add(e.path);
      out.push(e);
    };

    // Home first.
    push({ path: '/', changefreq: 'daily', priority: 1.0, lastmod: new Date() });

    // CMS content entries.
    for (const r of entries) {
      const pattern = patterns.get(r.typeKey);
      if (!pattern || !r.slug) continue;
      push({
        path: pattern.replace('{slug}', r.slug),
        lastmod: r.publishedAt ?? r.updatedAt,
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    // Published Builder singleton pages — skip any flagged noindex.
    for (const b of builderPages) {
      if (b.noindex || !b.slug) continue;
      push({
        path: `/${b.slug}`,
        lastmod: b.publishedAt ?? b.updatedAt,
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    // Commerce — only advertise the index surfaces when there's content behind
    // them, so a content-only tenant never lists an empty /products page.
    if (products.length) {
      push({ path: '/products', changefreq: 'daily', priority: 0.8, lastmod: new Date() });
      for (const p of products) {
        push({
          path: `/products/${p.handle}`,
          lastmod: p.publishedAt ?? p.updatedAt,
          changefreq: 'weekly',
          priority: 0.7,
        });
      }
    }
    if (collections.length) {
      push({ path: '/collections', changefreq: 'weekly', priority: 0.7, lastmod: new Date() });
      for (const c of collections) {
        push({
          path: `/collections/${c.handle}`,
          lastmod: c.updatedAt,
          changefreq: 'weekly',
          priority: 0.6,
        });
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${out
      .map((e) => urlNode(baseUrl, e))
      .join('\n')}\n</urlset>`;

    reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
      .send(xml);
  });
  return Promise.resolve();
};

export default sitemapRoutes;
