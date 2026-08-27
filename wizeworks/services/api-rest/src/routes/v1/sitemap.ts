// Per-SITE sitemap.xml (docs/49 — multi-site).
//
//   GET /v1/sitemap.xml?tenant=<slug>[&property=<slug>]     (public — no auth)
//
// Streams a sitemap covering everything ONE web property (site) serves: the home
// page, published CMS content entries (whose content type is routable — see
// IMPLICIT_URL_PATTERNS for how routability is decided), active commerce products
// (`/products/{handle}`), collections (`/collections/{handle}`), the categories that
// hold at least one, and the starter pages the storefront serves for addresses the
// property has published no page at. The index surfaces are only listed when the site
// actually has something behind them, so a content-only site doesn't advertise an
// empty `/products` and a shop with no journal doesn't advertise an empty `/blog`.
//
// "Everything it serves" is the whole contract, and the two ways it has been broken
// are worth naming: a page can be SERVED BY THE PLATFORM with no row of its own (the
// starter fallback — issue 274), and a stored slug can carry a leading slash, which
// this file used to concatenate into `//shop` (issue 275).
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
import { prisma, withTenant } from '@wizeworks/db';
import { isRecordAddress, isUtilityPage } from '@wizeworks/silica-catalog';
import { badRequest, notFound } from '@wizeworks/api-core/errors';
import {
  resolvePublicPropertyId,
  productSiteVisibilityWhere,
  contentSiteVisibilityWhere,
  collectionSiteVisibilityWhere,
  categorySiteVisibilityWhere,
} from '../../lib/property.js';
import { mintZoneHost } from '../../lib/domain.js';
import { siteChromeOptions } from '../../lib/builder-context.js';
import { pageAddress, starterAddresses } from '../../lib/sitemap-urls.js';

const Query = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

// Phase-1 catalogs are small; this is a guard against unbounded memory, not a
// real cap. A tenant past this needs a paginated sitemap index — far future.
const COMMERCE_URL_LIMIT = 20_000;

// Content types the storefront serves from a HARDCODED route rather than from
// the type's `urlPattern`.
//
// `urlPattern` is the CMS's "is this type routable" flag — the dashboard gates
// the slug field on `Boolean(urlPattern)` — so a type without one is genuinely
// non-routable and correctly absent from the sitemap. `blog_post` is the
// exception: wizeworks/apps/site ships a literal `/blog/[slug]` route that resolves any
// published blog_post by slug (see wizeworks/apps/site/lib/content.ts getBlogPostBySlug),
// so those posts are reachable, render Article JSON-LD, and are indexable
// whether or not anyone set a urlPattern on the type.
//
// Without this fallback a tenant whose blog_post type has a null urlPattern
// serves a fully working blog that appears nowhere in its sitemap — silently,
// per-tenant, and invisible until someone asks why the blog never indexed.
// The type's own urlPattern still WINS when set; this only fills the gap.
const IMPLICIT_URL_PATTERNS: Record<string, string> = {
  blog_post: '/blog/{slug}',
};

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
    const { entries, types, products, collections, bookableCount, categories, builderPages } =
      await withTenant({ tenantId: tenant.id }, async (tx) => {
        const [entries, products, collections, bookableCount, categories, builderPages] =
          await Promise.all([
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
            // Collections — not deleted AND visible on THIS site, which is what the public
            // `/collections/:handle` read tests (`public/commerce.ts`). This used to say
            // collections "aren't site-scoped in Model B (shared across sites)"; they are,
            // and the storefront has always scoped them — so a tenant with a second site
            // published that site's exclusive collections into the primary's sitemap, and a
            // crawler following one got a 404 on a URL we told it about.
            tx.productCollection.findMany({
              where: { deletedAt: null, ...collectionSiteVisibilityWhere(propertyId) },
              select: { handle: true, updatedAt: true },
              orderBy: { updatedAt: 'desc' },
              take: COMMERCE_URL_LIMIT,
            }),
            // Whether ANYTHING is bookable — the one fact `/book` needs, so a count
            // rather than the rows. Same predicate the public services read applies
            // (`bookableOnline` + `isActive`, this site's or shared), because a sitemap
            // that disagrees with the page advertises "No services are bookable yet".
            tx.schedulingService.count({
              where: {
                deletedAt: null,
                isActive: true,
                bookableOnline: true,
                OR: [{ propertyId }, { propertyId: null }],
              },
            }),
            // Categories — the taxonomy half of a shop, served at `/category/{handle}`
            // and, until now, in no sitemap at all. All eighteen of Juniper Row's
            // answered 200 and not one was advertised.
            //
            // Filtered to categories that HOLD something, which collections deliberately
            // are not. The two are not the same kind of object: a collection is a thing a
            // merchant made and named, so an empty one is a page they are about to fill;
            // a category tree arrives with the blueprint, so most of its branches are
            // taxonomy nobody chose. Hers is the case that decided it — every category
            // she has is empty, because the only products ever filed in them were the
            // blueprint's samples and she deleted those. Eighteen headings over
            // "No products found", one of them a Kids page on a womenswear label.
            tx.productCategory.findMany({
              where: {
                deletedAt: null,
                ...categorySiteVisibilityWhere(propertyId),
                products: {
                  some: {
                    product: {
                      status: 'active',
                      deletedAt: null,
                      ...productSiteVisibilityWhere(propertyId),
                    },
                  },
                },
              },
              select: { handle: true, updatedAt: true },
              orderBy: { updatedAt: 'desc' },
              take: COMMERCE_URL_LIMIT,
            }),
            // Published Builder SINGLETON pages that own a storefront slug (docs/50),
            // scoped to THIS site's page tree (property_id, docs/49 Phase 1B).
            // publishedAt is set on publish; noindex pages are filtered out below.
            //
            // A RECORD PAGE MUST NEVER REACH THIS QUERY. `/products/:handle` is an address,
            // not a URL — emitting it would publish a literal `:handle` to Google, which
            // crawls it and gets a 404. `kind:'singleton'` already excludes them today, but
            // that is the column Stage 2 removes; `isRecordAddress` is the filter that
            // still holds afterwards, and having both means the column can go without this
            // file being the thing that breaks.
            //
            // NOT filtered to `publishedAt: { not: null }` any more, because the starter
            // pass below needs to see an UNPUBLISHED row too: a page whose author has
            // ticked "keep this out of search" is still being served by the starter
            // fallback at its address, and the sitemap must respect that tick whether or
            // not the page was ever published. The publish test moved into the loop.
            tx.builderPage.findMany({
              where: {
                kind: 'singleton',
                slug: { not: null },
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

        return { entries, types, products, collections, bookableCount, categories, builderPages };
      });

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

    // CMS content entries. The type's configured urlPattern wins; a type the
    // storefront serves from a hardcoded route falls back to that route's shape
    // so its entries are never silently uncovered (see IMPLICIT_URL_PATTERNS).
    for (const r of entries) {
      const pattern = patterns.get(r.typeKey) ?? IMPLICIT_URL_PATTERNS[r.typeKey];
      if (!pattern || !r.slug) continue;
      push({
        path: pattern.replace('{slug}', r.slug),
        lastmod: r.publishedAt ?? r.updatedAt,
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    // Published Builder singleton pages — skip any flagged noindex, any that is a
    // record page's ADDRESS rather than a location a visitor can reach, and the
    // starter's utility pages.
    //
    // The utility check is not redundant with `noindex`. That column is honoured here
    // and always has been, but nothing SETS it on a seeded starter — `sync` writes it
    // only when a caller passes one, and the code-authored starter has no field to pass
    // — so every site built by sparx has been offering Google its cart, its search page
    // and its four account pages. Matching the closed slug set fixes that for sites that
    // already exist, which seeding the column cannot.
    //
    // `declined` collects the addresses whose author has said "not in search" — read
    // from every row, published or not, and consulted by the starter pass below.
    const declined = new Set<string>();
    for (const b of builderPages) {
      if (!b.slug || isRecordAddress(b.slug) || isUtilityPage(b.slug)) continue;
      if (b.noindex) {
        declined.add(pageAddress(b.slug));
        continue;
      }
      if (!b.publishedAt) continue;
      push({
        path: pageAddress(b.slug),
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
    // Same "only advertise a surface with something behind it" rule as `/products` and
    // `/collections` above — the query has already dropped the empty branches, so an
    // index here means there is at least one category page worth landing on.
    if (categories.length) {
      push({ path: '/category', changefreq: 'weekly', priority: 0.7, lastmod: new Date() });
      for (const c of categories) {
        push({
          path: `/category/${c.handle}`,
          lastmod: c.updatedAt,
          changefreq: 'weekly',
          priority: 0.6,
        });
      }
    }

    // Pages the platform SERVES that the property has no published row for — the
    // starter fallback, which is a real part of the site and was in no sitemap.
    // Runs last, so `seen` already holds every address that earned one.
    const starters = starterAddresses(
      await siteChromeOptions(tenant.id),
      {
        products: products.length,
        collections: collections.length,
        categories: categories.length,
        posts: entries.filter((r) => r.typeKey === 'blog_post').length,
        bookable: bookableCount,
      },
      seen,
      declined
    );
    for (const path of starters) {
      push({ path, changefreq: 'weekly', priority: 0.8, lastmod: new Date() });
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
