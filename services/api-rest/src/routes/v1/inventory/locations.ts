// Stock Locations CRUD.
//
//   GET    /v1/inventory/locations
//   POST   /v1/inventory/locations
//   GET    /v1/inventory/locations/:id
//   PATCH  /v1/inventory/locations/:id
//   DELETE /v1/inventory/locations/:id
//   GET    /v1/inventory/locations/:id/levels    → stock levels for this location

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const CreateLocationBody = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['warehouse', 'bin', '3pl', 'virtual', 'transit']).default('warehouse'),
  countryCode: z.string().length(2).nullable().default(null),
  address: z.string().max(1000).nullable().default(null),
  isDefault: z.boolean().default(false),
});

const UpdateLocationBody = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['warehouse', 'bin', '3pl', 'virtual', 'transit']).optional(),
  countryCode: z.string().length(2).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

const ListLocationsQuery = z.object({
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const LevelsQuery = z.object({
  take: z.coerce.number().int().min(1).max(500).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryLocationRoutes: FastifyPluginAsync = async (app) => {
  // ── List ─────────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/locations', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const q = ListLocationsQuery.parse(request.query);

    const where = { tenantId, active: true };
    const [locations, total] = await withTenant({ tenantId }, async (tx) => {
      return Promise.all([
        tx.stockLocation.findMany({
          where,
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
          take: q.take,
          skip: q.skip,
        }),
        tx.stockLocation.count({ where }),
      ]);
    });

    return reply.send(paged(locations, { total, skip: q.skip, per_page: q.take ?? 50 }));
  });

  // ── Create ───────────────────────────────────────────────────────────────────

  app.post('/v1/inventory/locations', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const body = CreateLocationBody.parse(request.body);

    const location = await withTenant({ tenantId }, async (tx) => {
      if (body.isDefault) {
        await tx.stockLocation.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.stockLocation.create({ data: { tenantId, ...body } });
    });

    return reply.status(201).send(ok(location));
  });

  // ── Get one ──────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/locations/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { id } = request.params as { id: string };

    const location = await withTenant({ tenantId }, async (tx) => {
      return tx.stockLocation.findFirst({ where: { id, tenantId } });
    });

    if (!location) throw notFound('Stock location not found');
    return reply.send(ok(location));
  });

  // ── Update ───────────────────────────────────────────────────────────────────

  app.patch('/v1/inventory/locations/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { id } = request.params as { id: string };
    const body = UpdateLocationBody.parse(request.body);

    const location = await withTenant({ tenantId }, async (tx) => {
      const existing = await tx.stockLocation.findFirst({ where: { id, tenantId } });
      if (!existing) throw notFound('Stock location not found');
      if (body.isDefault) {
        await tx.stockLocation.updateMany({
          where: { tenantId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.stockLocation.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
      });
    });

    return reply.send(ok(location));
  });

  // ── Deactivate ────────────────────────────────────────────────────────────────

  app.delete('/v1/inventory/locations/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { id } = request.params as { id: string };

    await withTenant({ tenantId }, async (tx) => {
      const existing = await tx.stockLocation.findFirst({ where: { id, tenantId } });
      if (!existing) throw notFound('Stock location not found');
      await tx.stockLocation.update({
        where: { id },
        data: { active: false, isDefault: false, updatedAt: new Date() },
      });
    });

    return reply.status(204).send();
  });

  // ── Stock levels at this location ────────────────────────────────────────────

  app.get('/v1/inventory/locations/:id/levels', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { id } = request.params as { id: string };
    const q = LevelsQuery.parse(request.query);

    const [levels, total] = await withTenant({ tenantId }, async (tx) => {
      const loc = await tx.stockLocation.findFirst({ where: { id, tenantId } });
      if (!loc) throw notFound('Stock location not found');
      return Promise.all([
        tx.stockLevel.findMany({
          where: { tenantId, locationId: id },
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                title: true,
                product: { select: { id: true, title: true, handle: true } },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.stockLevel.count({ where: { tenantId, locationId: id } }),
      ]);
    });

    return reply.send(paged(levels, { total, skip: q.skip, per_page: q.take }));
  });
};

export default inventoryLocationRoutes;
