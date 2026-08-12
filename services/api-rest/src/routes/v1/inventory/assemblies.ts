// Inventory module — Bills of materials + assembly orders (docs/146 Phase 6.4–6.7).
// Making things out of other things, and taking them back apart. All
// `requireInventoryModule` + `toInventoryContext` (standalone-usable — a
// workshop with no commerce builds and stocks perfectly well).
//
//   GET    /v1/inventory/boms                       ?q&status&output_variant_id&take&skip
//   POST   /v1/inventory/boms
//   GET    /v1/inventory/boms/:id
//   PATCH  /v1/inventory/boms/:id
//   POST   /v1/inventory/boms/:id/status
//   DELETE /v1/inventory/boms/:id
//   GET    /v1/inventory/boms/:id/buildable          ?warehouse_id
//   GET    /v1/inventory/variants/:variantId/bom     the ACTIVE recipe, if any
//
//   GET    /v1/inventory/assemblies                 ?q&status&kind&warehouse_id&take&skip
//   POST   /v1/inventory/assemblies
//   GET    /v1/inventory/assemblies/:id
//   PATCH  /v1/inventory/assemblies/:id
//   POST   /v1/inventory/assemblies/:id/release
//   POST   /v1/inventory/assemblies/:id/complete
//   POST   /v1/inventory/assemblies/:id/cancel
//
// COMPLETING is the one call here that moves stock, and it is `editor` like every
// other stock-moving write. It is deliberately NOT on the scan-capable allow
// list: finishing a build settles a cost, and the warehouse role cannot see
// costs at all.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  redactCosts,
  requireInventoryModule,
  toInventoryContext,
} from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathVariant = z.object({ variantId: z.string().uuid() });

const BomListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  output_variant_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const BuildableQuery = z.object({ warehouse_id: z.string().uuid() });

const AssemblyListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['planned', 'released', 'completed', 'cancelled']).optional(),
  kind: z.enum(['assemble', 'disassemble']).optional(),
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryAssemblyRoutes: FastifyPluginAsync = async (app) => {
  // ─── Bills of materials ────────────────────────────────────────────────────

  app.get('/v1/inventory/boms', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = BomListQuery.parse(request.query);
    const { items, total } = await inventoryService.listBoms(toInventoryContext(request), {
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.output_variant_id !== undefined ? { outputVariantId: q.output_variant_id } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(
      paged(redactCosts(request, items), { total, skip: q.skip ?? 0, per_page: q.take ?? 50 })
    );
  });

  app.post('/v1/inventory/boms', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createBom(toInventoryContext(request), request.body);
    return reply.status(201).send(ok(redactCosts(request, created)));
  });

  app.get('/v1/inventory/boms/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(redactCosts(request, await inventoryService.getBom(toInventoryContext(request), id)))
    );
  });

  app.patch('/v1/inventory/boms/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.updateBom(toInventoryContext(request), id, request.body)
        )
      )
    );
  });

  app.post('/v1/inventory/boms/:id/status', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.setBomStatus(toInventoryContext(request), id, request.body)
        )
      )
    );
  });

  app.delete('/v1/inventory/boms/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await inventoryService.deleteBom(toInventoryContext(request), id)));
  });

  // "How many can I make right now, and what runs out first." A viewer read on
  // purpose: it is the question the floor asks before anyone raises a run.
  app.get('/v1/inventory/boms/:id/buildable', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const q = BuildableQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.buildableQuantity(toInventoryContext(request), {
          bomId: id,
          warehouseId: q.warehouse_id,
        })
      )
    );
  });

  app.get('/v1/inventory/variants/:variantId/bom', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { variantId } = PathVariant.parse(request.params);
    const bom = await inventoryService.activeBomFor(toInventoryContext(request), variantId);
    return reply.send(ok(bom === null ? null : redactCosts(request, bom)));
  });

  // ─── Assembly orders ───────────────────────────────────────────────────────

  app.get('/v1/inventory/assemblies', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = AssemblyListQuery.parse(request.query);
    const { items, total } = await inventoryService.listAssemblyOrders(
      toInventoryContext(request),
      {
        ...(q.q !== undefined ? { q: q.q } : {}),
        ...(q.status !== undefined ? { status: q.status } : {}),
        ...(q.kind !== undefined ? { kind: q.kind } : {}),
        ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
      }
    );
    return reply.send(
      paged(redactCosts(request, items), { total, skip: q.skip ?? 0, per_page: q.take ?? 50 })
    );
  });

  app.post('/v1/inventory/assemblies', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createAssemblyOrder(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(redactCosts(request, created)));
  });

  app.get('/v1/inventory/assemblies/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.getAssemblyOrder(toInventoryContext(request), id)
        )
      )
    );
  });

  app.patch('/v1/inventory/assemblies/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.updateAssemblyOrder(toInventoryContext(request), id, request.body)
        )
      )
    );
  });

  app.post('/v1/inventory/assemblies/:id/release', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.releaseAssemblyOrder(toInventoryContext(request), id)
        )
      )
    );
  });

  app.post('/v1/inventory/assemblies/:id/complete', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.completeAssemblyOrder(
            toInventoryContext(request),
            id,
            request.body ?? {}
          )
        )
      )
    );
  });

  app.post('/v1/inventory/assemblies/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.cancelAssemblyOrder(
            toInventoryContext(request),
            id,
            request.body ?? {}
          )
        )
      )
    );
  });
};

export default inventoryAssemblyRoutes;
