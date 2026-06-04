// Public read endpoints for headless storefronts and the marketing site.
//
//   GET /v1/public/content/entries          ?tenant=<slug>&type=<key>[&limit=&cursor=]
//   GET /v1/public/content/entries/by-slug  ?tenant=<slug>&type=<key>&slug=<>
//   GET /v1/public/content/types/:key       ?tenant=<slug>
//
// No auth required: results are restricted to `status='published'` and
// `deleted_at IS NULL`. Tenant resolution is by SLUG (tenants table is the
// only non-RLS row, safe to look up), then RLS-scoped reads with that
// tenant's id via `withTenant`.
//
// Preview tokens (Phase 2.6) layer on top: when the request carries
// `Authorization: Preview <jwt>` and the jwt validates + names the same
// entry being requested, the draft is served instead. That's wired in
// services/api-rest/src/lib/preview.ts (see also the dashboard's "Copy
// preview URL" button on each entry).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { notFound, badRequest } from '@sparx/api-core/errors';
import { serializeEntry } from '@sparx/api-core/entries';
import { tryVerifyPreviewToken } from '../../../lib/preview.js';
import { readPublicConsentConfig } from '../../../lib/consent.js';

const ListQuery = z.object({
  tenant: z.string().min(1).max(63),
  type: z.string().min(1).max(63),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(250).default(50),
});

const BySlugQuery = z.object({
  tenant: z.string().min(1).max(63),
  type: z.string().min(1).max(63),
  slug: z.string().min(1).max(255),
});

const TypeKeyParams = z.object({ key: z.string().min(1).max(63) });
const TypeKeyQuery = z.object({ tenant: z.string().min(1).max(63) });

const ByIdParams = z.object({ id: z.string().uuid() });
const ByIdQuery = z.object({ tenant: z.string().min(1).max(63) });

async function resolveTenantBySlug(slug: string): Promise<string> {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!t) throw notFound('Tenant', slug);
  return t.id;
}

// "privacy-policy" → "Privacy Policy". Used as the footer link label only when
// a placement has no explicit label override (the seed always sets one).
function prettifySlug(slug: string): string {
  return slug
    .split(/[-_/]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Navigation item resolution — shared by the by-id and by-location reads. An
// item resolves to an href (an internal published CMS page, or an external URL);
// items with no resolvable href are dropped — and their descendants with them,
// so the storefront never renders a dead link. Tree-shaped via parentItemId.
interface RawNavItem {
  id: string;
  parentItemId: string | null;
  position: number;
  label: string;
  externalUrl: string | null;
  openInNewTab: boolean;
  entry: { slug: string | null; status: string; deletedAt: Date | null } | null;
}
interface PublicNavNode {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
  children: PublicNavNode[];
}

function buildNavTree(items: RawNavItem[]): PublicNavNode[] {
  const hrefFor = (item: RawNavItem): string | null => {
    if (item.externalUrl) return item.externalUrl;
    const e = item.entry;
    if (e?.slug && e.status === 'published' && !e.deletedAt) return `/${e.slug}`;
    return null;
  };
  const byParent = new Map<string | null, RawNavItem[]>();
  for (const item of items) {
    const key = item.parentItemId;
    const bucket = byParent.get(key) ?? [];
    bucket.push(item);
    byParent.set(key, bucket);
  }
  const build = (parentId: string | null): PublicNavNode[] =>
    (byParent.get(parentId) ?? []).flatMap((item) => {
      const href = hrefFor(item);
      if (!href) return [];
      return [
        {
          id: item.id,
          label: item.label,
          href,
          openInNewTab: item.openInNewTab,
          children: build(item.id),
        },
      ];
    });
  return build(null);
}

const NAV_ITEM_SELECT = {
  orderBy: { position: 'asc' },
  select: {
    id: true,
    parentItemId: true,
    position: true,
    label: true,
    externalUrl: true,
    openInNewTab: true,
    // Only published, non-deleted target pages resolve to a link.
    entry: { select: { slug: true, status: true, deletedAt: true } },
  },
} as const;

const publicContentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/content/entries', async (request) => {
    const q = ListQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.contentEntry.findMany({
        where: { typeKey: q.type, status: 'published', deletedAt: null },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      })
    );
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    const next = hasMore ? (page[page.length - 1]?.id ?? null) : null;
    return paged(page.map(serializeEntry), { per_page: q.limit, next_cursor: next });
  });

  app.get('/v1/public/content/entries/by-slug', async (request) => {
    const q = BySlugQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const preview = await tryVerifyPreviewToken(app, request);
    const row = await withTenant({ tenantId }, (tx) =>
      tx.contentEntry.findFirst({
        where: {
          typeKey: q.type,
          slug: q.slug,
          deletedAt: null,
          // Preview token grants draft access only for the entry it's
          // scoped to. For any other entry the default published-only
          // filter applies.
          ...(preview
            ? { OR: [{ status: 'published' }, { id: preview.entryId }] }
            : { status: 'published' }),
        },
      })
    );
    if (!row) throw notFound(`${q.type}`, q.slug);
    return ok(serializeEntry(row));
  });

  // Public lookup by id — used for `reference` field resolution where a
  // referenced entry has slug=null and can't be fetched via /by-slug. Honors
  // preview tokens the same way.
  app.get('/v1/public/content/entries/:id', async (request) => {
    const { id } = ByIdParams.parse(request.params);
    const q = ByIdQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const preview = await tryVerifyPreviewToken(app, request);
    const row = await withTenant({ tenantId }, (tx) =>
      tx.contentEntry.findFirst({
        where: {
          id,
          deletedAt: null,
          ...(preview?.entryId === id ? {} : { status: 'published' }),
        },
      })
    );
    if (!row) throw notFound('Entry', id);
    return ok(serializeEntry(row));
  });

  // Public navigation menu read — the storefront layout resolves a header/footer
  // SiteLayoutBlock's `navigationMenuId` into renderable links. Items are
  // resolved to an href: an internal CMS page (entryId → published page slug)
  // or an external URL. Unpublished / missing entries are dropped so the
  // storefront never renders a dead link. Tree-shaped via parentItemId.
  app.get('/v1/public/content/navigation/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const q = z.object({ tenant: z.string().min(1).max(63) }).parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);

    const menu = await withTenant({ tenantId }, (tx) =>
      tx.navigationMenu.findUnique({
        where: { id },
        select: { id: true, location: true, name: true, items: NAV_ITEM_SELECT },
      })
    );
    if (!menu) throw notFound('Navigation menu', id);
    return ok({
      id: menu.id,
      location: menu.location,
      name: menu.name,
      items: buildNavTree(menu.items),
    });
  });

  // Public navigation menu read BY LOCATION — the Builder site layout (docs/45)
  // binds its chrome nav to `site.primaryNav` (location 'header') /
  // `site.footerNav` (location 'footer'); the storefront resolves those here
  // without needing a menu id. One menu per (tenant, location). Same item
  // resolution as the by-id read. 404 when the tenant has no menu at that
  // location (the chrome nav then renders empty).
  app.get('/v1/public/content/navigation/by-location/:location', async (request) => {
    const { location } = z.object({ location: z.string().min(1).max(63) }).parse(request.params);
    const q = z.object({ tenant: z.string().min(1).max(63) }).parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);

    const menu = await withTenant({ tenantId }, (tx) =>
      tx.navigationMenu.findUnique({
        where: { tenantId_location: { tenantId, location } },
        select: { id: true, location: true, name: true, items: NAV_ITEM_SELECT },
      })
    );
    if (!menu) throw notFound('Navigation menu', location);
    return ok({
      id: menu.id,
      location: menu.location,
      name: menu.name,
      items: buildNavTree(menu.items),
    });
  });

  // Public legal-document placements — the storefront resolves a tenant's
  // legal pages (privacy/terms/cookie-policy/…) into footer/checkout/terms-gate
  // links (docs/42 §5). Like nav resolution, a placement whose entry is
  // unpublished / deleted / slugless is dropped so the storefront never renders
  // a dead link. `source_kind='integration_doc'` placements (no entry) are
  // skipped here until the integration-docs bridge lands.
  app.get('/v1/public/legal/placements', async (request) => {
    const q = z
      .object({
        tenant: z.string().min(1).max(63),
        placement: z.enum(['footer', 'checkout', 'terms_gate']).default('footer'),
      })
      .parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);

    const rows = await withTenant({ tenantId }, (tx) =>
      tx.storefrontDocPlacement.findMany({
        where: { placement: q.placement, enabled: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          label: true,
          legalKind: true,
          columnKey: true,
          entry: { select: { slug: true, status: true, deletedAt: true } },
        },
      })
    );

    const links = rows.flatMap((r) => {
      const e = r.entry;
      if (!e?.slug || e.status !== 'published' || e.deletedAt) return [];
      return [
        {
          label: r.label ?? prettifySlug(e.slug),
          href: `/${e.slug}`,
          legalKind: r.legalKind,
          columnKey: r.columnKey ?? 'legal',
        },
      ];
    });

    return ok(links);
  });

  app.get('/v1/public/content/types/:key', async (request) => {
    const { key } = TypeKeyParams.parse(request.params);
    const q = TypeKeyQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const row = await withTenant({ tenantId }, (tx) =>
      tx.contentType.findFirst({
        where: { key },
        orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
      })
    );
    if (!row) throw notFound('Content type', key);
    return ok(row);
  });

  // Trivial readiness probe for downstream caches (Cloudflare etc.) — checks
  // the tenant exists. Cheap and CDN-friendly.
  app.get('/v1/public/tenants/:slug', async (request) => {
    const params = z.object({ slug: z.string().min(1).max(63) }).parse(request.params);
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, slug: true, name: true, settings: true, socials: true },
    });
    if (!tenant) throw notFound('Tenant', params.slug);
    if (tenant.id === '00000000-0000-0000-0000-000000000000') {
      throw badRequest('Reserved tenant.');
    }

    // Storefront theme + commerce defaults travel with the tenant payload so
    // the storefront's root layout resolves everything in a single fetch.
    // Both rows are one-per-tenant (tenantId PK); a missing row means the
    // tenant hasn't customized, so we fall back to nulls/defaults that the
    // storefront's token layer interprets as "use the default theme".
    const [theme, storefront, brand, consent] = await withTenant({ tenantId: tenant.id }, (tx) =>
      Promise.all([
        // PRESENTATION tokens only. Identity (colours, type, logo, favicon) comes
        // from the tenant brand below — those StorefrontTheme columns were removed
        // in migration 20260610000200 (docs/30 §6).
        tx.storefrontTheme.findUnique({
          where: { tenantId: tenant.id },
          select: {
            colorBackground: true,
            colorMuted: true,
            radiusBase: true,
          },
        }),
        tx.storefrontSettings.findUnique({
          where: { tenantId: tenant.id },
          select: {
            defaultCurrency: true,
            defaultLocale: true,
            showStockBelow: true,
            hidePricesWhenSignedOut: true,
            requireAuthForCheckout: true,
          },
        }),
        // Tenant-level brand is the source of truth for IDENTITY (docs/30 §6):
        // logo/favicon + brand colours + brand type. It WINS over StorefrontTheme
        // here; the theme keeps only presentation tokens (background/muted/radius).
        tx.tenantBrand.findUnique({
          where: { tenantId: tenant.id },
          select: {
            businessName: true,
            colorPrimary: true,
            colorPrimaryForeground: true,
            colorAccent: true,
            fontHeading: true,
            fontBody: true,
            logoLightMediaId: true,
            logoDarkMediaId: true,
            faviconMediaId: true,
          },
        }),
        // Cookie-consent config travels with the tenant payload so the
        // storefront layout decides off/quiet-notice/banner server-side in
        // the same fetch — no second round-trip, no client flash (docs/42 §4).
        readPublicConsentConfig(tx, tenant.id),
      ])
    );

    // Brand identity overrides theme identity; theme supplies presentation +
    // fallback. All-null fields are interpreted by the storefront token layer as
    // "use the default theme". `businessName` (when set) is the display name the
    // storefront shows in the header/title/footer.
    const mergedTheme =
      theme || brand
        ? {
            // Identity — brand only (StorefrontTheme no longer stores these).
            colorPrimary: brand?.colorPrimary ?? null,
            colorPrimaryForeground: brand?.colorPrimaryForeground ?? null,
            colorAccent: brand?.colorAccent ?? null,
            fontHeading: brand?.fontHeading ?? null,
            fontBody: brand?.fontBody ?? null,
            logoMediaId: brand?.logoLightMediaId ?? null,
            logoDarkMediaId: brand?.logoDarkMediaId ?? null,
            faviconMediaId: brand?.faviconMediaId ?? null,
            // Presentation — theme-owned.
            colorBackground: theme?.colorBackground ?? null,
            colorMuted: theme?.colorMuted ?? null,
            radiusBase: theme?.radiusBase ?? null,
          }
        : null;

    return ok({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      businessName: brand?.businessName ?? null,
      settings: tenant.settings,
      // Site-wide social links (a SITE setting on the tenant, not brand/theme —
      // docs/45 §3): an ordered { platform, url }[] the storefront chrome renders.
      socials: Array.isArray(tenant.socials) ? tenant.socials : [],
      theme: mergedTheme,
      storefront: storefront ?? {
        defaultCurrency: 'USD',
        defaultLocale: 'en-US',
        showStockBelow: 10,
        hidePricesWhenSignedOut: false,
        requireAuthForCheckout: false,
      },
      consent,
    });
  });
  return Promise.resolve();
};

export default publicContentRoutes;
