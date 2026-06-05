// Per-SITE sitemap.xml (docs/49 — multi-site).
//
//   GET /v1/sitemap.xml?tenant=<slug>[&property=<slug>]     (public — no auth)
//
// Streams a sitemap covering everything ONE web property (site) serves: the home
// page, published CMS content entries (whose resolved content type carries a
// `urlPattern`), active commerce products (`/products/{handle}`) and collections
// (`/collections/{handle}`). The commerce index pages are only listed when the
// site actually has commerce content, so a content-only site doesn't advertise
// empty `/products` / `/collections` surfaces.
//
// Multi-site scoping (docs/49 §3 Model B): products + content entries are scoped
// to the active property — global items (no scope rows) plus this site's
// exclusive items, never another site's. Builder pages are scoped by property_id
// (each site owns its page tree). `?property=` is the stable site slug; absent ⇒
// the tenant's primary site. The `<loc>` base URL is the site's canonical host.
//
// The route runs outside auth/RLS because it's a public consumer endpoint, so
// we look up the tenant by slug and SET LOCAL the GUC ourselves. Pure-RLS is
// preserved: we never bypass it, just choose which tenant to scope to based on
// the public query parameter.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { badRequest, notFound } from '@sparx/api-core/errors';
import {
  resolvePublicPropertyId,
  productSiteVisibilityWhere,
  contentSiteVisibilityWhere,
} from '../../lib/property.js';
import { mintZoneHost } from '../../lib/domain.js';

const Query = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

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
    const { tenant: slug, property: propertySlug } = Query.parse(request.query);

    // Tenants table has no RLS, so we can look it up directly to get the id.
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw notFound('Tenant', slug);
    if (!tenant.settings) throw badRequest('Tenant has no published configuration.');

    const settings = tenant.settings as Record<string, unknown>;

    // The active site (docs/49). `?property=` names the stable site slug; absent
    // ⇒ the tenant's primary. Every read below is scoped to this property.
    const propertyId = await resolvePublicPropertyId(tenant.id, propertySlug);
    const property = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.property.findUnique({
        where: { id: propertyId },
        select: { slug: true, isPrimary: true },
      })
    );

    // Base `<loc>` host = the SITE's canonical host. Prefer the property's
    // canonical domain row (the bare `<tenant>.sparx.zone` for the primary, or a
    // connected custom domain); fall back to the tenant's `primaryDomain` setting
    // (primary only, back-compat), then the minted `*.sparx.zone` subdomain.
    // `domains` is non-RLS, so the bare client reads it directly.
    const canonical = await prisma.domain.findFirst({
      where: {
        propertyId,
        isCanonical: true,
        status: { in: ['verified', 'active'] },
      },
      select: { host: true },
    });
    const baseHost =
      canonical?.host ??
      (property?.isPrimary && typeof settings.primaryDomain === 'string'
        ? settings.primaryDomain
        : mintZoneHost(slug, property?.slug ?? 'primary', property?.isPrimary ?? true));
    const baseUrl = `https://${baseHost}`;

    // Everything is read inside this tenant's RLS context in one round-trip.
    const { entries, types, products, collections, builderPages } = await withTenant(
      { tenantId: tenant.id },
      async (tx) => {
        const [entries, products, collections, builderPages] = await Promise.all([
          // Published, routable CMS entries scoped to this site (Model B).
          tx.contentEntry.findMany({
            where: {
              status: 'published',
              deletedAt: null,
              slug: { not: null },
              ...contentSiteVisibilityWhere(propertyId),
            },
            select: { slug: true, typeKey: true, updatedAt: true, publishedAt: true },
          }),
          // Active commerce products — mirrors the public PDP visibility filter
          // (status active + not deleted) plus this site's Model B scope.
          tx.product.findMany({
            where: {
              status: 'active',
              deletedAt: null,
              ...productSiteVisibilityWhere(propertyId),
            },
            select: { handle: true, updatedAt: true, publishedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: COMMERCE_URL_LIMIT,
          }),
          // Collections — visible whenever not deleted (matches public reads).
          // Collections aren't site-scoped in Model B (shared across sites).
          tx.productCollection.findMany({
            where: { deletedAt: null },
            select: { handle: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: COMMERCE_URL_LIMIT,
          }),
          // Published Builder SINGLETON pages that own a storefront slug (docs/50),
          // scoped to THIS site's page tree (property_id, docs/49 Phase 1B).
          // publishedAt is set on publish; noindex pages are filtered out below.
          tx.builderPage.findMany({
            where: {
              kind: 'singleton',
              slug: { not: null },
              publishedAt: { not: null },
              propertyId,
            },
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
