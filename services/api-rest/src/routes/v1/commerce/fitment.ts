// Commerce — fitment (domains + a generalized node tree + product
// applicability) and configurator (templates + bundles).
//
// "Fitment" is the generalized "this product fits that thing" concept. A domain
// declares an ordered list of DIMENSIONS (each a `level` tier or a `range`
// axis); a single self-referential node tree holds the values at any depth; a
// product fitment names the deepest level node it targets + a numeric window per
// range axis. See packages/commerce/src/services/fitment-service.ts.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { configuratorService, fitmentService } from '@sparx/commerce';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

// Fitment ids are generated/seeded uuids; z.guid() validates the 8-4-4-4-12
// shape without RFC-9562 version pedantry (some seeded ids zero the version
// bits), so reference path ids stay valid across services.
const FitmentId = z.guid();
const PathId = z.object({ id: FitmentId });
const DomainParam = z.object({ domainId: FitmentId });
const NodeParam = z.object({ nodeId: FitmentId });
const NodeListQuery = z.object({ parentId: FitmentId.optional() });
const ProductIdParam = z.object({ productId: z.string().uuid() });
const FitmentParam = z.object({ fitmentId: z.string().uuid() });

const ListBundlesQuery = z.object({
  q: z.string().optional(),
  // The wrapper product a bundle is sold as — lets a product-scoped surface ask
  // "is this product a bundle?" in one exact request instead of paging the whole
  // bundle list and filtering in the browser.
  product_id: z.string().uuid().optional(),
  pricing_mode: z.string().optional(),
  inventory_mode: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const ListTemplatesQuery = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const fitmentRoutes: FastifyPluginAsync = async (app) => {
  // Fitment dictionaries are installed through the cross-module preset seam
  // (`GET /v1/presets?module=commerce&kind=fitment` + `POST /v1/presets/
  // commerce/:slug/install`, routes/v1/presets.ts) — the commerce preset there
  // delegates to fitmentService.installFitmentDictionary. The bespoke
  // `/fitment/dictionaries` endpoints were retired so there is ONE install path.

  // ─── Domains ──────────────────────────────────────────────────────
  app.get('/v1/commerce/fitment/domains', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok(await fitmentService.listDomains(toCommerceContext(request)));
  });

  app.get('/v1/commerce/fitment/domains/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await fitmentService.getDomain(toCommerceContext(request), id));
  });

  app.post('/v1/commerce/fitment/domains', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await fitmentService.createDomain(toCommerceContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/commerce/fitment/domains/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await fitmentService.updateDomain(toCommerceContext(request), id, request.body));
  });

  // Uninstall a domain: drops it, its whole node tree, and every product fitment
  // that referenced it. Returns the count of affected products for the UI.
  app.delete('/v1/commerce/fitment/domains/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await fitmentService.deleteDomain(toCommerceContext(request), id));
  });

  // ─── Nodes (the value tree, any depth) ────────────────────────────
  // List children of `?parentId=` (or the domain's top-level nodes when absent).
  app.get('/v1/commerce/fitment/domains/:domainId/nodes', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { domainId } = DomainParam.parse(request.params);
    const { parentId } = NodeListQuery.parse(request.query);
    return ok(
      await fitmentService.listNodes(toCommerceContext(request), domainId, parentId ?? null)
    );
  });

  app.post('/v1/commerce/fitment/nodes', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await fitmentService.createNode(toCommerceContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/commerce/fitment/nodes/:nodeId', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { nodeId } = NodeParam.parse(request.params);
    return ok(await fitmentService.updateNode(toCommerceContext(request), nodeId, request.body));
  });

  // Delete a node + its subtree. Returns the count of affected products.
  app.delete('/v1/commerce/fitment/nodes/:nodeId', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { nodeId } = NodeParam.parse(request.params);
    return ok(await fitmentService.deleteNode(toCommerceContext(request), nodeId));
  });

  app.post('/v1/commerce/fitment/nodes/reorder', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    await fitmentService.reorderNodes(toCommerceContext(request), request.body);
    return ok({ reordered: true });
  });

  // ─── Product fitment ──────────────────────────────────────────────
  app.get('/v1/commerce/products/:productId/fitment', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { productId } = ProductIdParam.parse(request.params);
    return ok(await fitmentService.listForProduct(toCommerceContext(request), productId));
  });

  app.put('/v1/commerce/products/:productId/fitment', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { productId } = ProductIdParam.parse(request.params);
    // Body shape is validated by the service's Zod schema
    // (ProductFitmentInput, applied per-row inside setForProduct).
    const body = z.object({ fitments: z.array(z.unknown()) }).parse(request.body);
    await fitmentService.setForProduct(
      toCommerceContext(request),
      productId,
      body.fitments as Parameters<typeof fitmentService.setForProduct>[2]
    );
    return ok({ productId, updated: true });
  });

  app.post('/v1/commerce/fitment/bulk-assign', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    return ok(await fitmentService.bulkAssign(toCommerceContext(request), request.body));
  });

  app.delete('/v1/commerce/fitment/:fitmentId', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { fitmentId } = FitmentParam.parse(request.params);
    await fitmentService.deleteFitment(toCommerceContext(request), fitmentId);
    reply.code(204);
  });

  // ─── Lookup ───────────────────────────────────────────────────────
  app.get('/v1/commerce/fitment/lookup', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok(await fitmentService.lookup(toCommerceContext(request), request.query));
  });

  // ─── Configurator — bundles ───────────────────────────────────────
  app.get('/v1/commerce/bundles', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListBundlesQuery.parse(request.query);
    const { items, total } = await configuratorService.listBundles(toCommerceContext(request), {
      q: q.q,
      bundleProductId: q.product_id,
      pricingMode: q.pricing_mode,
      inventoryMode: q.inventory_mode,
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/commerce/bundles/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await configuratorService.getBundle(toCommerceContext(request), id));
  });

  app.post('/v1/commerce/bundles', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await configuratorService.createBundle(
      toCommerceContext(request),
      request.body
    );
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/commerce/bundles/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await configuratorService.updateBundle(toCommerceContext(request), id, request.body));
  });

  app.delete('/v1/commerce/bundles/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await configuratorService.deleteBundle(toCommerceContext(request), id);
    reply.code(204);
  });

  // ─── Configurator — templates ─────────────────────────────────────
  app.get('/v1/commerce/configurator-templates', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListTemplatesQuery.parse(request.query);
    const { items, total } = await configuratorService.listAllTemplates(
      toCommerceContext(request),
      {
        ...(q.q ? { q: q.q } : {}),
        ...(q.status ? { status: q.status } : {}),
        take: q.take,
        skip: q.skip,
      }
    );
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/commerce/configurator-templates/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await configuratorService.getTemplate(toCommerceContext(request), id));
  });

  // Per-product templates for the product detail's Configurator tab.
  app.get('/v1/commerce/products/:productId/configurator-templates', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { productId } = ProductIdParam.parse(request.params);
    return ok(
      await configuratorService.listTemplatesForProduct(toCommerceContext(request), productId)
    );
  });

  // Run a set of choices through the template exactly as the storefront would,
  // and hand back what the shopper would get: the resolved variant, the add-on
  // lines the rules pulled in, the price, and any rule that refused.
  //
  // A pure read — it writes no cart and no row. It exists because a rule engine
  // that can only be inspected as a list of rules cannot actually be checked: the
  // whole failure mode of a configurator is a combination of choices nobody
  // tried, and the only honest way to find those is to try them.
  app.post('/v1/commerce/configurator/preview', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok(await configuratorService.resolve(toCommerceContext(request), request.body));
  });

  app.post('/v1/commerce/configurator-templates', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await configuratorService.createTemplate(
      toCommerceContext(request),
      request.body
    );
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/commerce/configurator-templates/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(
      await configuratorService.updateTemplate(toCommerceContext(request), id, request.body)
    );
  });

  app.delete('/v1/commerce/configurator-templates/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await configuratorService.deleteTemplate(toCommerceContext(request), id);
    reply.code(204);
  });
};

export default fitmentRoutes;
