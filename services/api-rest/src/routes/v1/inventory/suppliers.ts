// Inventory module — Suppliers + per-variant purchasing detail (docs/100 P3a).
// The inbound vendor record; purchase orders + receiving build on these. All
// `requireInventoryModule` + `toInventoryContext`, so a standalone WMS tenant
// (no commerce) manages suppliers here; writes delegate to @sparx/inventory.
//
//   GET    /v1/inventory/suppliers                       ?search&include_archived&take&skip
//   POST   /v1/inventory/suppliers
//   GET    /v1/inventory/suppliers/:id                    → supplier + variant links
//   PATCH  /v1/inventory/suppliers/:id
//   DELETE /v1/inventory/suppliers/:id                    → archive
//   GET    /v1/inventory/suppliers/:id/variants
//   PUT    /v1/inventory/suppliers/:id/variants           → upsert a (supplier,variant) link
//   DELETE /v1/inventory/suppliers/:id/variants/:variantId

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@sparx/api-core/query';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathIdVariant = z.object({ id: z.string().uuid(), variantId: z.string().uuid() });

const ListQuery = z.object({
  search: z.string().max(160).optional(),
  include_archived: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const VariantLookupQuery = z.object({ sku: z.string().min(1).max(127) });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventorySupplierRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/suppliers', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listSuppliers(toInventoryContext(request), {
      includeInactive: q.include_archived === true,
      ...(q.search !== undefined ? { search: q.search } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });

  app.post('/v1/inventory/suppliers', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createSupplier(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  // SKU → variant resolver for the add-purchasing-link form (static path, so it
  // is matched before the parametric `/:id` route).
  app.get('/v1/inventory/suppliers/variant-lookup', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { sku } = VariantLookupQuery.parse(request.query);
    return reply.send(
      ok(await inventoryService.lookupVariantBySku(toInventoryContext(request), sku))
    );
  });

  app.get('/v1/inventory/suppliers/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const ctx = toInventoryContext(request);
    const [supplier, variants] = await Promise.all([
      inventoryService.getSupplier(ctx, id),
      inventoryService.listSupplierVariants(ctx, id),
    ]);
    return reply.send(ok({ ...supplier, variants }));
  });

  app.patch('/v1/inventory/suppliers/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.updateSupplier(toInventoryContext(request), id, request.body))
    );
  });

  app.delete('/v1/inventory/suppliers/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await inventoryService.archiveSupplier(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  app.get('/v1/inventory/suppliers/:id/variants', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.listSupplierVariants(toInventoryContext(request), id))
    );
  });

  app.put('/v1/inventory/suppliers/:id/variants', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.upsertSupplierVariant(toInventoryContext(request), id, request.body)
      )
    );
  });

  app.delete('/v1/inventory/suppliers/:id/variants/:variantId', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id, variantId } = PathIdVariant.parse(request.params);
    await inventoryService.removeSupplierVariant(toInventoryContext(request), id, variantId);
    return reply.status(204).send();
  });
};

export default inventorySupplierRoutes;
