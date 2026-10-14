// A site's RSS 2.0 feed.
//
//   GET /v1/rss.xml?tenant=<slug>[&property=<site slug>][&type=<typeKey>][&author=<uuid>]
//
// Public, no auth — pairs with /v1/sitemap.xml. The site serves it at `/feed.xml`
// and names it in every page's head, so a reader's feed app finds it from the
// address bar. Returns the 50 newest pieces published ON THIS SITE; older ones fall
// off naturally (RSS readers cache).
//
// With no `type`, every kind of writing the site serves: a journal's Articles, a
// shop's blog posts, both. It used to default to `blog_post`, so a journal whose
// writing is Articles had a feed of nothing, and nothing on her site linked it
// anyway (P09). It also read the whole account rather than the site being read, so
// a second business's posts arrived in the first one's feed.
//
// Tenant resolution follows the same pattern as sitemap.ts: tenants has no
// RLS so we look it up directly, then SET LOCAL its tenant_id via
// withTenant() before any RLS-protected query.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@wizeworks/db';
import { badRequest, notFound } from '@wizeworks/api-core/errors';

import { canonicalSiteHost } from '../../lib/site-origin.js';
import { kindLayout, type KindFieldLike } from '@wizeworks/silica-catalog';
import { entryPublicPath } from '../../lib/content-paths.js';
import { publishedOnSite, siteKindsTx } from '../../lib/author-roster.js';
import {
  resolveActivePropertyName,
  resolvePublicPropertyId,
  siteDisabledModules,
} from '../../lib/property.js';

const Query = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
  type: z.string().min(1).max(63).optional(),
  author: z.string().uuid().optional(),
});

const FEED_LIMIT = 50;

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

function rfc822(date: Date): string {
  // RSS 2.0 mandates RFC 822 dates ("Thu, 28 May 2026 12:00:00 +0000"). JS
  // `toUTCString()` already returns exactly that format with a trailing
  // "GMT" instead of "+0000"; both are valid per the spec, but readers
  // are happier with "+0000".
  return date.toUTCString().replace(/GMT$/, '+0000');
}

const rssRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/rss.xml', async (request, reply) => {
    const q = Query.parse(request.query);

    const tenant = await prisma.tenant.findUnique({ where: { slug: q.tenant } });
    if (!tenant) throw notFound('Tenant', q.tenant);
    if (!tenant.settings) throw badRequest('Tenant has no published configuration.');

    // The site being read: its own pieces, on its own address.
    const propertyId = await resolvePublicPropertyId(tenant.id, q.property);
    if ((await siteDisabledModules(tenant.id, propertyId)).includes('cms')) {
      throw notFound('Feed', q.tenant);
    }
    const site = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.property.findFirst({
        where: { id: propertyId },
        select: { id: true, slug: true, isPrimary: true },
      })
    );
    // The site's real address, by the helper the sitemap and every customer email use
    // (lib/site-origin.ts). The fallback here was `<slug>.sparx.works`, the platform's
    // own marketing domain, which serves no tenant's site at all (found beside 064).
    const baseUrl = `https://${await canonicalSiteHost({
      tenantId: tenant.id,
      tenantSlug: q.tenant,
      tenantSettings: tenant.settings,
      property: site,
    })}`;
    const siteName = (await resolveActivePropertyName(tenant.id, propertyId)) || tenant.name;

    // Every kind the site serves at an address; or the one asked for, if it is one.
    const served = await withTenant({ tenantId: tenant.id }, (tx) => siteKindsTx(tx, propertyId));
    const kinds = q.type ? new Map([...served].filter(([key]) => key === q.type)) : served;
    if (q.type && kinds.size === 0) throw notFound(`Routable content type "${q.type}"`);
    const one = q.type ? kinds.get(q.type) : undefined;

    const rows = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.contentEntry.findMany({
        where: {
          ...publishedOnSite(propertyId, kinds),
          slug: { not: null },
          ...(q.author ? { authorId: q.author } : {}),
        },
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        take: FEED_LIMIT,
        select: {
          id: true,
          typeKey: true,
          slug: true,
          body: true,
          seoJson: true,
          publishedAt: true,
          updatedAt: true,
        },
      })
    );

    const items = rows.flatMap((r) => {
      const kind = kinds.get(r.typeKey);
      const path = kind ? entryPublicPath(kind.key, kind.urlPattern, r.slug) : null;
      if (!kind || !path) return [];
      // The fields its kind calls a headline and a summary (`kindLayout`), for a kind
      // that does not name them `title` and `excerpt` — a journal's Article says
      // `standfirst`.
      const layout = kindLayout(kind.fields as KindFieldLike[]);
      const body = (r.body ?? {}) as Record<string, unknown>;
      const seo = (r.seoJson ?? {}) as Record<string, unknown>;
      const field = (key: string | null): string | false =>
        key !== null && typeof body[key] === 'string' && body[key];
      const title =
        (typeof seo.title === 'string' && seo.title) ||
        (typeof body.title === 'string' && body.title) ||
        field(layout.headline) ||
        (r.slug ?? r.id);
      const description =
        (typeof seo.description === 'string' && seo.description) ||
        (typeof body.excerpt === 'string' && body.excerpt) ||
        (typeof body.summary === 'string' && body.summary) ||
        field(layout.lede) ||
        '';
      const link = `${baseUrl}${path}`;
      const pubDate = rfc822(r.publishedAt ?? r.updatedAt);
      return [
        [
          '<item>',
          `<title>${xmlEscape(String(title))}</title>`,
          `<link>${xmlEscape(link)}</link>`,
          `<guid isPermaLink="true">${xmlEscape(link)}</guid>`,
          `<pubDate>${pubDate}</pubDate>`,
          description ? `<description>${xmlEscape(String(description))}</description>` : '',
          '</item>',
        ]
          .filter(Boolean)
          .join(''),
      ];
    });

    const channelTitle = one ? `${siteName}: ${one.pluralName}` : siteName;
    const channelLink = baseUrl;
    const channelDesc = one
      ? `Latest ${one.pluralName.toLowerCase()} from ${siteName}.`
      : `The latest from ${siteName}.`;
    const buildDate = rfc822(new Date());
    // The address a reader subscribed to: the site's own, for the whole feed.
    const selfHref = one
      ? `${request.protocol}://${request.hostname}/v1/rss.xml?tenant=${encodeURIComponent(q.tenant)}&type=${encodeURIComponent(one.key)}`
      : `${baseUrl}/feed.xml`;

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
      `<channel>\n` +
      `<title>${xmlEscape(channelTitle)}</title>\n` +
      `<link>${xmlEscape(channelLink)}</link>\n` +
      `<description>${xmlEscape(channelDesc)}</description>\n` +
      `<language>en</language>\n` +
      `<lastBuildDate>${buildDate}</lastBuildDate>\n` +
      `<atom:link href="${xmlEscape(selfHref)}" rel="self" type="application/rss+xml"/>\n` +
      items.join('\n') +
      `\n</channel>\n</rss>`;

    reply
      .header('Content-Type', 'application/rss+xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
      .send(xml);
  });
  return Promise.resolve();
};

export default rssRoutes;
