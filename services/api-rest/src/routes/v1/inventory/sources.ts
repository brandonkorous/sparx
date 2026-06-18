// Inventory Sources CRUD + manual sync trigger + external push.
//
//   GET    /v1/inventory/sources
//   POST   /v1/inventory/sources
//   GET    /v1/inventory/sources/:id
//   PATCH  /v1/inventory/sources/:id
//   DELETE /v1/inventory/sources/:id
//   POST   /v1/inventory/sources/:id/sync
//   POST   /v1/inventory/sources/:id/push   ← external systems (API key auth)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@sparx/db';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { publishEvent, createPublisher, type PublisherLogger } from '@sparx/events';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';
import { env } from '../../../env.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

const PushRow = z.object({
  sku: z.string().min(1).max(255),
  location: z.string().max(255).optional(),
  quantity: z.number().int().min(0),
});

const PushBody = z.object({
  rows: z.array(PushRow).min(1).max(10_000),
});

const CreateSourceBody = z.object({
  name: z.string().min(1).max(255),
  // csv | api (api = generic HTTP-API based; only csv implemented in Ph2)
  type: z.enum(['csv', 'api']),
  config: z.record(z.string(), z.unknown()).default({}),
  syncIntervalSec: z.number().int().min(0).max(86400).default(0),
  notes: z.string().max(2000).nullable().default(null),
});

const UpdateSourceBody = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'paused']).optional(),
  syncIntervalSec: z.number().int().min(0).max(86400).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const ListQuery = z.object({
  status: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventorySourceRoutes: FastifyPluginAsync = async (app) => {
  // ── List ─────────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/sources', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const q = ListQuery.parse(request.query);

    const [sources, total] = await withTenant({ tenantId }, async (tx) => {
      const where: Prisma.InventorySourceWhereInput = { tenantId, deletedAt: null };
      if (q.status) where.status = q.status;
      return Promise.all([
        tx.inventorySource.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.inventorySource.count({ where }),
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

    const source = await withTenant({ tenantId }, async (tx) => {
      return tx.inventorySource.create({
        data: { tenantId, ...body, config: body.config as Prisma.InputJsonValue },
      });
    });

    await publishEvent(
      publisher,
      'inventory.source.created',
      tenantId,
      userId,
      { sourceId: source.id },
      pubLogger
    );

    return reply.status(201).send(ok(source));
  });

  // ── Get one ──────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/sources/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toInventoryContext(request);
    const { id } = request.params as { id: string };

    const source = await withTenant({ tenantId }, async (tx) => {
      return tx.inventorySource.findFirst({ where: { id, tenantId, deletedAt: null } });
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

    const source = await withTenant({ tenantId }, async (tx) => {
      const existing = await tx.inventorySource.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) throw notFound('Inventory source not found');
      const { config: rawConfig, ...restBody } = body;
      return tx.inventorySource.update({
        where: { id },
        data: {
          ...restBody,
          ...(rawConfig !== undefined ? { config: rawConfig as Prisma.InputJsonValue } : {}),
          updatedAt: new Date(),
        },
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

    await withTenant({ tenantId }, async (tx) => {
      const existing = await tx.inventorySource.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) throw notFound('Inventory source not found');
      await tx.inventorySource.update({
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

    const source = await withTenant({ tenantId }, async (tx) => {
      const s = await tx.inventorySource.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!s) throw notFound('Inventory source not found');
      return s;
    });

    await publishEvent(
      publisher,
      'inventory.source.sync_started',
      tenantId,
      userId,
      { tenantId, sourceId: source.id, userId, trigger: 'manual' },
      pubLogger
    );

    return reply.send(ok({ queued: true, sourceId: source.id }));
  });

  // ── External push ─────────────────────────────────────────────────────────────
  //
  // Allows any external system (warehouse, ERP, bridge agent) authenticated with
  // a tenant API key (sk_live_*) to POST stock levels directly. Rows go through
  // `ingestFeed` — the SAME funnel the CSV worker uses — which matches each row to
  // a link, reconciles matches into the master `inventory_levels` (a corrective
  // `sync` movement), queues unmatched SKUs for review, and records the run.

  app.post('/v1/inventory/sources/:id/push', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const ctx = toInventoryContext(request);
    const { tenantId, userId } = ctx;
    const { id } = request.params as { id: string };
    const { rows } = PushBody.parse(request.body);

    const source = await withTenant({ tenantId }, async (tx) => {
      const s = await tx.inventorySource.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!s) throw notFound('Inventory source not found');
      return s;
    });

    if (source.status === 'paused') {
      return reply.send(
        ok({ processed: 0, unmatched: 0, skipped: rows.length, reason: 'source_paused' })
      );
    }

    const result = await inventoryService.ingestFeed(ctx, {
      source: { id: source.id, name: source.name },
      rows: rows.map((r) => ({
        externalSku: r.sku,
        externalLocation: r.location ?? null,
        quantity: r.quantity,
      })),
      trigger: 'push',
    });

    await publishEvent(
      publisher,
      'inventory.source.sync_completed',
      tenantId,
      userId,
      {
        sourceId: id,
        syncedAt: new Date().toISOString(),
        via: 'push',
        rowsTotal: result.rowsTotal,
        rowsChanged: result.rowsChanged,
        rowsUnmatched: result.rowsUnmatched,
      },
      pubLogger
    );

    return reply.send(
      ok({
        processed: result.rowsChanged + result.rowsUnchanged,
        unmatched: result.rowsUnmatched,
        skipped: result.rowsSkipped,
        runId: result.runId,
      })
    );
  });
};

export default inventorySourceRoutes;
