// Inventory Source Links — maps external SKU/location to (variant, location).
//
//   GET    /v1/inventory/sources/:sourceId/links
//   POST   /v1/inventory/sources/:sourceId/links
//   DELETE /v1/inventory/sources/:sourceId/links/:id

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type TxClient } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound, conflict } from '@sparx/api-core/errors';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

type AnyTx = TxClient & Record<string, any>;

const CreateLinkBody = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  externalSku: z.string().min(1).max(255),
  externalLocation: z.string().max(255).nullable().default(null),
});

const ListQuery = z.object({
  take: z.coerce.number().int().min(1).max(500).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

const inventoryLinkRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/sources/:sourceId/links', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { sourceId } = request.params as { sourceId: string };
    const q = ListQuery.parse(request.query);

    const [links, total] = await withTenant({ tenantId } as any, async (tx) => {
      const anyTx = tx as AnyTx;
      const source = await anyTx.inventorySource.findFirst({
        where: { id: sourceId, tenantId, deletedAt: null },
      });
      if (!source) throw notFound('Inventory source not found');
      return Promise.all([
        anyTx.inventorySourceLink.findMany({
          where: { tenantId, sourceId },
          include: {
            variant: { select: { id: true, sku: true, title: true } },
            location: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        anyTx.inventorySourceLink.count({ where: { tenantId, sourceId } }),
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

    const link = await withTenant({ tenantId } as any, async (tx) => {
      const anyTx = tx as AnyTx;
      const source = await anyTx.inventorySource.findFirst({
        where: { id: sourceId, tenantId, deletedAt: null },
      });
      if (!source) throw notFound('Inventory source not found');

      // Check unique constraint before hitting DB error
      const existing = await anyTx.inventorySourceLink.findFirst({
        where: {
          tenantId,
          sourceId,
          externalSku: body.externalSku,
          externalLocation: body.externalLocation,
        },
      });
      if (existing) throw conflict('A link for this SKU/location already exists on this source');

      return anyTx.inventorySourceLink.create({
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

    await withTenant({ tenantId } as any, async (tx) => {
      const anyTx = tx as AnyTx;
      const link = await anyTx.inventorySourceLink.findFirst({
        where: { id, tenantId, sourceId },
      });
      if (!link) throw notFound('Link not found');
      await anyTx.inventorySourceLink.delete({ where: { id } });
    });

    return reply.status(204).send();
  });
};

export default inventoryLinkRoutes;
