// Inventory Source Links — maps external SKU/location to (variant, warehouse).
//
//   GET    /v1/inventory/sources/:sourceId/links
//   POST   /v1/inventory/sources/:sourceId/links
//   DELETE /v1/inventory/sources/:sourceId/links/:id
//
// Creation goes through `inventoryService.createSourceLink`, which enforces the
// docs/28 §6 conflict rules (one source per variant, no duplicate SKU/location) and
// carries the P5b sync controls (UoM conversion + safety buffer). The list enriches
// each link with its (variant, warehouse) level's safety buffer for the mapping UI.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';
import { CreateSourceLinkInput } from '@wizeworks/commerce-schemas';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const ListQuery = z.object({
  take: z.coerce.number().int().min(1).max(500).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

const levelKey = (variantId: string, warehouseId: string): string => `${variantId}|${warehouseId}`;

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryLinkRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/sources/:sourceId/links', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { sourceId } = request.params as { sourceId: string };
    const q = ListQuery.parse(request.query);

    const { links, total } = await withTenant({ tenantId }, async (tx) => {
      const source = await tx.inventorySource.findFirst({
        where: { id: sourceId, tenantId, deletedAt: null },
      });
      if (!source) throw notFound('Inventory source not found');

      const [rows, count] = await Promise.all([
        tx.inventorySourceLink.findMany({
          where: { tenantId, sourceId },
          include: {
            variant: { select: { id: true, sku: true, title: true } },
            warehouse: { select: { id: true, name: true, code: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.inventorySourceLink.count({ where: { tenantId, sourceId } }),
      ]);

      // Merge each (variant, warehouse) level's safety buffer (the enforcement home).
      const keys = rows.map((l) => ({ variantId: l.variantId, warehouseId: l.warehouseId }));
      const levels = keys.length
        ? await tx.inventoryLevel.findMany({
            where: { tenantId, OR: keys },
            select: { variantId: true, warehouseId: true, safetyBuffer: true },
          })
        : [];
      const bufferByKey = new Map(
        levels.map((l) => [levelKey(l.variantId, l.warehouseId), l.safetyBuffer])
      );

      const enriched = rows.map((l) => ({
        ...l,
        safetyBuffer: bufferByKey.get(levelKey(l.variantId, l.warehouseId)) ?? 0,
      }));
      return { links: enriched, total: count };
    });

    return reply.send(paged(links, { total, skip: q.skip, per_page: q.take }));
  });

  app.post('/v1/inventory/sources/:sourceId/links', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const ctx = toInventoryContext(request);
    const { sourceId } = request.params as { sourceId: string };
    const body = CreateSourceLinkInput.parse(request.body);

    const result = await inventoryService.createSourceLink(ctx, sourceId, body);
    return reply.status(201).send(ok(result));
  });

  app.delete('/v1/inventory/sources/:sourceId/links/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { sourceId, id } = request.params as { sourceId: string; id: string };

    await withTenant({ tenantId }, async (tx) => {
      const link = await tx.inventorySourceLink.findFirst({
        where: { id, tenantId, sourceId },
      });
      if (!link) throw notFound('Link not found');
      await tx.inventorySourceLink.delete({ where: { id } });
    });

    return reply.status(204).send();
  });
};

export default inventoryLinkRoutes;
