// Inventory Source Links — maps external SKU/location to (variant, warehouse).
//
//   GET    /v1/inventory/sources/:sourceId/links
//   POST   /v1/inventory/sources/:sourceId/links
//   DELETE /v1/inventory/sources/:sourceId/links/:id

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound, conflict } from '@sparx/api-core/errors';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const CreateLinkBody = z.object({
  variantId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  externalSku: z.string().min(1).max(255),
  externalLocation: z.string().max(255).nullable().default(null),
});

const ListQuery = z.object({
  take: z.coerce.number().int().min(1).max(500).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryLinkRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/sources/:sourceId/links', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { sourceId } = request.params as { sourceId: string };
    const q = ListQuery.parse(request.query);

    const [links, total] = await withTenant({ tenantId }, async (tx) => {
      const source = await tx.inventorySource.findFirst({
        where: { id: sourceId, tenantId, deletedAt: null },
      });
      if (!source) throw notFound('Inventory source not found');
      return Promise.all([
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
    });

    return reply.send(paged(links, { total, skip: q.skip, per_page: q.take }));
  });

  app.post('/v1/inventory/sources/:sourceId/links', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { sourceId } = request.params as { sourceId: string };
    const body = CreateLinkBody.parse(request.body);

    const link = await withTenant({ tenantId }, async (tx) => {
      const source = await tx.inventorySource.findFirst({
        where: { id: sourceId, tenantId, deletedAt: null },
      });
      if (!source) throw notFound('Inventory source not found');

      // Check unique constraint before hitting DB error
      const existing = await tx.inventorySourceLink.findFirst({
        where: {
          tenantId,
          sourceId,
          externalSku: body.externalSku,
          externalLocation: body.externalLocation,
        },
      });
      if (existing) throw conflict('A link for this SKU/location already exists on this source');

      return tx.inventorySourceLink.create({
        data: { tenantId, sourceId, ...body },
      });
    });

    return reply.status(201).send(ok(link));
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
