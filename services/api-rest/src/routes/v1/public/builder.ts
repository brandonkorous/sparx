// Public read for PUBLISHED Builder pages + the site layout (docs/44 §2.2,
// docs/45 §2.6) — the storefront render path's data source.
//
//   GET /v1/public/builder/page        ?tenant=<slug>&slug=<pageSlug>
//     → the published page tree + meta, or 404 if no published page has that slug
//   GET /v1/public/builder/collection  ?tenant=<slug>&recordType=<type>&recordId=<id?>
//     → the published COLLECTION template for a record type (commerce.product,
//       cms.page, …) — the generic per-record router (docs/44 §3 B). With an
//       optional recordId, a per-record template override wins over the type
//       default (docs/51 §6). 404 if none resolves.
//   GET /v1/public/builder/layout      ?tenant=<slug>
//     → the published chrome tree + meta, or 404 if no layout has been published
//
// No auth (`/v1/public/` is an auth-exempt prefix). Tenant resolved by slug (the
// tenants table is the only non-RLS row, safe to look up), then an RLS-scoped
// read via the service. Returns the PUBLISHED tree by default; with a valid
// `Authorization: Preview <site-preview jwt>` (minted by the workbench for its own
// tenant) EVERY read here serves the DRAFT instead — legacy page/home/styles AND
// the four silica reads (frame, home, page, collection), so the editor's Preview
// shows unpublished chrome and unpublished bodies together. An invalid/expired
// token throws (never silently downgraded to published). See `previewStage`.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pageService, layoutService, siteService, surfaceCssService } from '@sparx/builder';
import type { SiteStage } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';
import { isModuleEnabled } from '@sparx/auth';
import { tryVerifySitePreview } from '../../../lib/preview.js';
import { resolvePublicPropertyId } from '../../../lib/property.js';
import { requireTenantIdBySlug } from '../../../lib/tenant-slug.js';

// `property` (a stable property slug) scopes the read to one of the tenant's web
// PROPERTIES/sites (docs/49). Omitted → the tenant's primary site, so single-site
// storefronts are unaffected; Phase 2's host→property mapping passes it.
const PageQuery = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
  slug: z.string().min(1).max(160),
});

const CollectionQuery = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
  recordType: z.string().min(1).max(63),
  // The specific record being rendered — lets a per-record template override win
  // over the type default (docs/51 §6). Omitted on list/index renders.
  recordId: z.string().min(1).max(255).optional(),
});

const TenantQuery = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

/** The frame read also takes the route's PATH, so it can answer with the chrome that
 *  page asks for rather than the site default (doc 139 §5). Optional — a caller that
 *  omits it gets exactly what it got before per-page frames existed. */
const FrameQuery = TenantQuery.extend({
  path: z.string().max(2048).optional(),
});

// Cached in lib/tenant-slug.ts (docs/127 §5) — this ran uncached on every storefront
// read, ~6 per page render, while resolvePublicPropertyId beside it was already cached.
const resolveTenantBySlug = requireTenantIdBySlug;

/**
 * Which stage a silica read serves: `draft` under a valid site-preview token, else
 * `published`.
 *
 * Every silica handler must call this. They did not, and the consequence was not
 * subtle: the token was minted, sent, and ignored, so Preview showed the last
 * PUBLISHED site on every route — and because the storefront falls back to the code
 * starter when a property has published nothing, a tenant who had never published saw
 * the starter rather than their own work. The four legacy handlers above did honour
 * the token, which is why this read as working.
 *
 * `tryVerifySitePreview` still throws on an invalid/expired token rather than
 * downgrading to published: a preview link that silently shows the live site is worse
 * than one that says it expired.
 */
function previewStage(
  app: Parameters<typeof tryVerifySitePreview>[0],
  request: Parameters<typeof tryVerifySitePreview>[1],
  tenantId: string
): SiteStage {
  return tryVerifySitePreview(app, request, tenantId) ? 'draft' : 'published';
}

const publicBuilderRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/builder/page', async (request) => {
    const q = PageQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const ctx = { tenantId, propertyId };
    // A valid site-preview token serves the DRAFT page (the editor's Preview tab);
    // otherwise the published snapshot.
    const preview = tryVerifySitePreview(app, request, tenantId);
    const page = preview
      ? await pageService.getDraftBySlug(ctx, q.slug)
      : await pageService.getPublishedBySlug(ctx, q.slug);
    if (!page) throw notFound('Builder page', q.slug);
    return ok(page);
  });

  app.get('/v1/public/builder/home', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const ctx = { tenantId, propertyId };
    // A valid site-preview token serves the DRAFT home (the editor's Preview tab);
    // otherwise the published home. Per-property: each site has its own home.
    const preview = tryVerifySitePreview(app, request, tenantId);
    const page = preview
      ? await pageService.getDraftHome(ctx)
      : await pageService.getPublishedHome(ctx);
    if (!page) throw notFound('Builder home', q.tenant);
    return ok(page);
  });

  app.get('/v1/public/builder/collection', async (request) => {
    const q = CollectionQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const page = await pageService.getPublishedByRecordType(
      { tenantId, propertyId },
      q.recordType,
      q.recordId
    );
    if (!page) throw notFound('Builder collection template', q.recordType);
    return ok(page);
  });

  app.get('/v1/public/builder/layout', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const layout = await layoutService.getPublished({ tenantId, propertyId });
    if (!layout) throw notFound('Builder layout', q.tenant);
    return ok(layout);
  });

  // ── silica-native published reads (docs/118 Stage 6, the render cutover) ─────
  // The storefront renders these through `renderSilicaBody` (silicaui-html toHtml).
  // The frame is read ONCE by the site layout; each route reads its page body.
  // Always 200 for the frame (`frame` is null until a silica layout is published,
  // so the storefront can decide chrome unconditionally); page/home 404 when the
  // property has published no silica page owning that slug (storefront falls back).

  app.get('/v1/public/builder/silica/frame', async (request) => {
    const q = FrameQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const stage = previewStage(app, request, tenantId);
    const [frame, commerceEnabled, schedulingEnabled, cmsEnabled] = await Promise.all([
      // `path` asks for the chrome THIS route wears rather than the site default
      // (doc 139 §5) — a landing page can have none. Omitted by any caller that just
      // wants the default, which is every caller that predates per-page frames.
      siteService.getPublishedFrame({ tenantId, propertyId }, stage, q.path),
      // Drives the storefront's code-authored starter fallback (silica.ts) — a
      // tenant with no Commerce module never gets Shop/Cart/Orders chrome. Not a
      // gate on this route itself: the frame is always readable publicly.
      isModuleEnabled(tenantId, 'commerce'),
      // Same public module signal for Scheduling — drives the starter Book link/page
      // and lets the /book route 404 when the module is off.
      isModuleEnabled(tenantId, 'scheduling'),
      // Same for CMS — drives the starter Journal link + the `/blog` index page. A
      // publisher-only tenant had neither while Commerce and Scheduling both had a
      // flag here, so their posts were reachable only by typing the URL.
      isModuleEnabled(tenantId, 'cms'),
    ]);
    return ok({ ...frame, commerceEnabled, schedulingEnabled, cmsEnabled });
  });

  app.get('/v1/public/builder/silica/home', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const stage = previewStage(app, request, tenantId);
    const page = await siteService.getPublishedHome({ tenantId, propertyId }, stage);
    if (!page) throw notFound('Builder home', q.tenant);
    return ok(page);
  });

  app.get('/v1/public/builder/silica/page', async (request) => {
    const q = PageQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const stage = previewStage(app, request, tenantId);
    const page = await siteService.getPublishedPageBySlug({ tenantId, propertyId }, q.slug, stage);
    if (!page) throw notFound('Builder page', q.slug);
    return ok(page);
  });

  app.get('/v1/public/builder/silica/collection', async (request) => {
    const q = CollectionQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const stage = previewStage(app, request, tenantId);
    const page = await siteService.getPublishedByRecordType(
      { tenantId, propertyId },
      q.recordType,
      q.recordId,
      stage
    );
    if (!page) throw notFound('Builder collection template', q.recordType);
    return ok(page);
  });

  // The compiled per-tenant Surface stylesheet (docs/47 §5): the CSS for every
  // class authored across the tenant's published trees. Always 200 (never 404) —
  // `css` is '' until classes are authored, so the storefront can inject
  // unconditionally. Cached per class-set in the service.
  app.get('/v1/public/builder/styles', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    // Under a site-preview token, serve the DRAFT sheet (a superset) so classes
    // added since the last publish resolve in the preview tab.
    const preview = tryVerifySitePreview(app, request, tenantId);
    return ok(
      preview
        ? await surfaceCssService.getDraftStylesheet({ tenantId, propertyId })
        : await surfaceCssService.getPublishedStylesheet({ tenantId, propertyId })
    );
  });

  return Promise.resolve();
};

export default publicBuilderRoutes;
