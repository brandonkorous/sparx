// Lean, projected storefront summary for AI/agent surfaces (docs/113 §7).
//
//   GET /v1/public/storefront-info  ?tenant=<slug>[&property=<slug>]
//
// Backs the storefront MCP's `get_store_info` tool and its per-request tool
// filtering. DELIBERATELY a small projection — name, description, socials,
// footer policy links, and disabledModules — NOT the raw `tenant.settings`
// blob the /tenants/:slug bootstrap returns (that verbatim exposure is exactly
// what an anonymous agent surface must not proxy).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';
import { resolvePublicPropertyId, resolveActivePropertyName } from '../../../lib/property.js';
import { mintZoneHost } from '../../../lib/domain.js';

const Query = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

function coerceSocials(raw: unknown): { platform: string; url: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { platform, url } = item as Record<string, unknown>;
    const p = typeof platform === 'string' ? platform.trim() : '';
    const u = typeof url === 'string' ? url.trim() : '';
    return p && u ? [{ platform: p, url: u }] : [];
  });
}

/** Active site's socials (Property.settings.socials) with tenant-level fallback. */
function readSiteSocials(
  settings: unknown,
  tenantSocials: unknown
): { platform: string; url: string }[] {
  const own =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? coerceSocials((settings as { socials?: unknown }).socials)
      : [];
  return own.length > 0 ? own : coerceSocials(tenantSocials);
}

function readString(bag: unknown, key: string): string | null {
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return null;
  const v = (bag as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Prefer the site's own description/tagline, then the tenant's. */
function readDescription(propertySettings: unknown, tenantSettings: unknown): string | null {
  return (
    readString(propertySettings, 'description') ??
    readString(propertySettings, 'tagline') ??
    readString(tenantSettings, 'description') ??
    readString(tenantSettings, 'tagline') ??
    null
  );
}

function prettifySlug(slug: string): string {
  return slug
    .split(/[-_/]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const storefrontInfoRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/storefront-info', async (request) => {
    const q = Query.parse(request.query);
    const tenant = await prisma.tenant.findUnique({
      where: { slug: q.tenant },
      select: { id: true, settings: true, socials: true },
    });
    if (!tenant) throw notFound('Tenant', q.tenant);

    const tenantId = tenant.id;
    const propertyId = await resolvePublicPropertyId(tenantId, q.property ?? null);

    const [property, name, placements] = await Promise.all([
      withTenant({ tenantId }, (tx) =>
        tx.property.findUnique({
          where: { id: propertyId },
          select: { settings: true, moduleScope: true, slug: true, isPrimary: true },
        })
      ),
      resolveActivePropertyName(tenantId, propertyId),
      withTenant({ tenantId }, (tx) =>
        tx.siteDocPlacement.findMany({
          where: { placement: 'footer', enabled: true, OR: [{ propertyId: null }, { propertyId }] },
          orderBy: { position: 'asc' },
          select: {
            label: true,
            legalKind: true,
            entry: { select: { slug: true, status: true, deletedAt: true } },
          },
        })
      ),
    ]);

    const policies = placements.flatMap((r) => {
      const e = r.entry;
      if (!e?.slug || e.status !== 'published' || e.deletedAt) return [];
      return [{ label: r.label ?? prettifySlug(e.slug), href: `/${e.slug}`, kind: r.legalKind }];
    });

    const disabledModules = Array.isArray(property?.moduleScope)
      ? property.moduleScope.filter((v): v is string => typeof v === 'string')
      : [];

    // The store's canonical public origin — the shopper OAuth AS origin (docs/113
    // §5), where the sparx_customer_session cookie lives. A configured custom
    // primary domain wins; otherwise the minted `*.sparx.zone` host.
    const primaryDomain =
      readString(property?.settings, 'primaryDomain') ??
      readString(tenant.settings, 'primaryDomain');
    const host =
      primaryDomain ??
      mintZoneHost(q.tenant, property?.slug ?? q.tenant, property?.isPrimary ?? true);
    const siteUrl = `https://${host}`;

    return ok({
      name,
      description: readDescription(property?.settings, tenant.settings),
      socials: readSiteSocials(property?.settings, tenant.socials),
      policies,
      disabledModules,
      siteUrl,
    });
  });
  return Promise.resolve();
};

export default storefrontInfoRoutes;
