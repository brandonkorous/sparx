// Bins — where INSIDE a location a thing is (docs/146 Phase 2).
//
//   GET    /v1/inventory/bins                    ?warehouse_id&zone&type&q&…
//   POST   /v1/inventory/bins                    → add a shelf
//   GET    /v1/inventory/bins/:id
//   PATCH  /v1/inventory/bins/:id
//   DELETE /v1/inventory/bins/:id                → archive (refused if it holds stock)
//   GET    /v1/inventory/bins/:id/contents       → what is on this shelf
//   GET    /v1/inventory/bins/variant/:variantId → where one item sits
//   POST   /v1/inventory/bins/move               → shelf → shelf, same location
//   GET    /v1/inventory/bins/suggest            → where should this go?
//   PUT    /v1/inventory/bins/home/:variantId    → pin an item's home shelf
//   POST   /v1/inventory/warehouses/:id/bins/enable  → provision + seat existing stock
//   POST   /v1/inventory/warehouses/:id/bins/disable
//
// Reads are `viewer`. Moving stock between shelves and putting stock away are
// scan-capable — they are what the warehouse floor DOES, and gating them behind
// `editor` would mean the role built for pickers cannot pick. Creating,
// re-shaping and archiving shelves stay `editor`: deciding what the racking IS
// is a different job from working it.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@sparx/api-core/query';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  redactCosts,
  requireInventoryModule,
  requireScanCapable,
  toInventoryContext,
} from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  zone: z.string().max(60).optional(),
  type: z.enum(['pick', 'bulk', 'receiving', 'staging', 'quarantine', 'damaged']).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  include_system: queryBool.optional(),
  include_inactive: queryBool.optional(),
  non_empty_only: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const ContentsQuery = z.object({
  include_empty: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(1000).optional(),
});

const VariantBinsQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  include_empty: queryBool.optional(),
});

const SuggestQuery = z.object({
  variant_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(0).max(10_000_000).optional(),
});

const HomeBinBody = z.object({
  /** Null clears the pin, so put-away goes back to inferring. */
  binId: z.string().uuid().nullable(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryBinRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/bins', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listBins(toInventoryContext(request), {
      ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
      ...(q.zone !== undefined ? { zone: q.zone } : {}),
      ...(q.type !== undefined ? { type: q.type } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.include_system !== undefined ? { includeSystem: q.include_system } : {}),
      ...(q.include_inactive !== undefined ? { includeInactive: q.include_inactive } : {}),
      ...(q.non_empty_only !== undefined ? { nonEmptyOnly: q.non_empty_only } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 100 }));
  });

  app.post('/v1/inventory/bins', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createBin(toInventoryContext(request), request.body);
    return reply.status(201).send(ok(created));
  });

  app.get('/v1/inventory/bins/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await inventoryService.getBin(toInventoryContext(request), id)));
  });

  app.patch('/v1/inventory/bins/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.updateBin(toInventoryContext(request), id, request.body))
    );
  });

  app.delete('/v1/inventory/bins/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await inventoryService.archiveBin(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  // Reading a shelf is a scan-capable action, not merely a viewer one — "what is
  // on this shelf" is the lookup a picker makes twenty times an hour, and it
  // carries no cost figures to protect.
  app.get('/v1/inventory/bins/:id/contents', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { id } = PathId.parse(request.params);
    const q = ContentsQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.binContents(toInventoryContext(request), id, {
          ...(q.include_empty !== undefined ? { includeEmpty: q.include_empty } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
        })
      )
    );
  });

  app.get('/v1/inventory/bins/variant/:variantId', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { variantId } = z.object({ variantId: z.string().uuid() }).parse(request.params);
    const q = VariantBinsQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.binsForVariant(toInventoryContext(request), variantId, {
          ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
          ...(q.include_empty !== undefined ? { includeEmpty: q.include_empty } : {}),
        })
      )
    );
  });

  // Moving stock between shelves IS the floor's work.
  app.post('/v1/inventory/bins/move', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.moveBetweenBins(toInventoryContext(request), request.body)
        )
      )
    );
  });

  app.get('/v1/inventory/bins/suggest', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const q = SuggestQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.suggestPutAway(toInventoryContext(request), {
          variantId: q.variant_id,
          warehouseId: q.warehouse_id,
          ...(q.quantity !== undefined ? { quantity: q.quantity } : {}),
        })
      )
    );
  });

  // Pinning an item's home shelf is a decision about how the warehouse is
  // organised, not a physical act — `editor`, unlike the moves above.
  app.put('/v1/inventory/bins/home/:variantId', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { variantId } = z.object({ variantId: z.string().uuid() }).parse(request.params);
    const body = HomeBinBody.parse(request.body);
    await inventoryService.setVariantHomeBin(toInventoryContext(request), variantId, body.binId);
    return reply.send(ok({ variantId, binId: body.binId }));
  });

  // Turning bins on provisions the system shelves and seats every existing
  // quantity in DEFAULT — a real operation, not a flag. `admin`, because it
  // changes how an entire location is worked.
  app.post('/v1/inventory/warehouses/:id/bins/enable', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.enableBinsForWarehouse(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/warehouses/:id/bins/disable', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    await inventoryService.disableBinsForWarehouse(toInventoryContext(request), id);
    // The shelves and their history are KEPT, so turning it back on finds them
    // where they were left. Said in the response rather than only in the docs.
    return reply.send(ok({ warehouseId: id, usesBins: false, shelvesKept: true }));
  });
};

export default inventoryBinRoutes;
