// Inventory Sources CRUD + manual sync trigger.
//
//   GET    /v1/inventory/sources
//   POST   /v1/inventory/sources
//   GET    /v1/inventory/sources/:id
//   PATCH  /v1/inventory/sources/:id
//   DELETE /v1/inventory/sources/:id
//   POST   /v1/inventory/sources/:id/sync

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type TxClient } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { publishEvent } from '@sparx/events';
import { PubSub } from '@google-cloud/pubsub';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';
import { env } from '../../../env.js';

type AnyTx = TxClient & Record<string, any>;

const CreateSourceBody = z.object({
  name: z.string().min(1).max(255),
  // csv | api (api = generic HTTP-API based; only csv implemented in Ph2)
  type: z.enum(['csv', 'api']),
  config: z.record(z.unknown()).default({}),
  syncIntervalSec: z.number().int().min(0).max(86400).default(0),
  notes: z.string().max(2000).nullable().default(null),
});

const UpdateSourceBody = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'paused']).optional(),
  syncIntervalSec: z.number().int().min(0).max(86400).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const ListQuery = z.object({
  status: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const inventorySourceRoutes: FastifyPluginAsync = async (app) => {
  // ── List ─────────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/sources', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const q = ListQuery.parse(request.query);

    const [sources, total] = await withTenant({ tenantId } as any, async (tx) => {
      const anyTx = tx as AnyTx;
      const where: any = { tenantId, deletedAt: null };
      if (q.status) where.status = q.status;
      return Promise.all([
        anyTx.inventorySource.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        anyTx.inventorySource.count({ where }),
      ]);
    });

    return reply.send(paged(sources, { total, skip: q.skip, per_page: q.take }));
  });

  // ── Create ───────────────────────────────────────────────────────────────────

  app.post('/v1/inventory/sources', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toInventoryContext(request);
    const body = CreateSourceBody.parse(request.body);

    const source = await withTenant({ tenantId } as any, async (tx) => {
      const anyTx = tx as AnyTx;
      return anyTx.inventorySource.create({
        data: { tenantId, ...body },
      });
    });

    await publishEvent(
      new PubSub({ projectId: env.GCP_PROJECT_ID }),
      'inventory.source.created',
      tenantId,
      userId,
      { sourceId: source.id },
      request.log
    );

    return reply.status(201).send(ok(source));
  });

  // ── Get one ──────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/sources/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { id } = request.params as { id: string };

    const source = await withTenant({ tenantId } as any, async (tx) => {
      const anyTx = tx as AnyTx;
      return anyTx.inventorySource.findFirst({ where: { id, tenantId, deletedAt: null } });
    });

    if (!source) throw notFound('Inventory source not found');
    return reply.send(ok(source));
  });

  // ── Update ───────────────────────────────────────────────────────────────────

  app.patch('/v1/inventory/sources/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { id } = request.params as { id: string };
    const body = UpdateSourceBody.parse(request.body);

    const source = await withTenant({ tenantId } as any, async (tx) => {
      const anyTx = tx as AnyTx;
      const existing = await anyTx.inventorySource.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) throw notFound('Inventory source not found');
      return anyTx.inventorySource.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
      });
    });

    return reply.send(ok(source));
  });

  // ── Delete (soft) ─────────────────────────────────────────────────────────────

  app.delete('/v1/inventory/sources/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { id } = request.params as { id: string };

    await withTenant({ tenantId } as any, async (tx) => {
      const anyTx = tx as AnyTx;
      const existing = await anyTx.inventorySource.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) throw notFound('Inventory source not found');
      await anyTx.inventorySource.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'paused', updatedAt: new Date() },
      });
    });

    return reply.status(204).send();
  });

  // ── Manual sync trigger ───────────────────────────────────────────────────────

  app.post('/v1/inventory/sources/:id/sync', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toInventoryContext(request);
    const { id } = request.params as { id: string };

    const source = await withTenant({ tenantId } as any, async (tx) => {
      const anyTx = tx as AnyTx;
      const s = await anyTx.inventorySource.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!s) throw notFound('Inventory source not found');
      return s;
    });

    await publishEvent(
      new PubSub({ projectId: env.GCP_PROJECT_ID }),
      'inventory.source.sync_started',
      tenantId,
      userId,
      { tenantId, sourceId: source.id, userId },
      request.log
    );

    return reply.send(ok({ queued: true, sourceId: source.id }));
  });
};

export default inventorySourceRoutes;
