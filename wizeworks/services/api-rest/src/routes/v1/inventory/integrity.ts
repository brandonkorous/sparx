// Inventory integrity API (docs/146 Phase 1) — the endpoints behind "your stock
// number is right, and here is how you check it".
//
// Reconciliation:
//   GET  /v1/inventory/integrity/reconciliation           — run history
//   POST /v1/inventory/integrity/reconciliation           — run a pass now
//   GET  /v1/inventory/integrity/drifts                   — open (or all) drifts
//
// Oversell:
//   GET  /v1/inventory/integrity/oversell                 — the incident log
//   GET  /v1/inventory/integrity/oversell/summary         — headline counts
//
// Provenance:
//   GET  /v1/inventory/stock/:variant_id/:warehouse_id/provenance
//                                                          — explain one number
//
// Channel buffers:
//   GET    /v1/inventory/channel-buffers
//   PUT    /v1/inventory/channel-buffers                  — upsert (default or override)
//   DELETE /v1/inventory/channel-buffers/:id
//
// Freshness:
//   GET  /v1/inventory/sources/freshness                  — every source's SLO state
//   PUT  /v1/inventory/sources/:id/freshness              — declare the SLO
//   POST /v1/inventory/sources/freshness/sweep            — evaluate now
//
// Running a reconciliation pass is a WRITE (it records a run row and can resolve
// drifts) but it mutates no stock, so it sits at `editor` rather than `admin` —
// the person who notices a number looks wrong is usually not the person with
// billing rights, and making them ask is how nobody checks.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { inventoryService } from '@wizeworks/inventory';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const RunsQuery = z.object({
  status: z.enum(['running', 'ok', 'drift', 'error']).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const RunBody = z.object({
  scope: z.enum(['full', 'sample', 'variant']).optional(),
  variant_id: z.string().uuid().optional(),
  sample_size: z.coerce.number().int().min(1).max(10_000).optional(),
});

const DriftsQuery = z.object({
  run_id: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  include_resolved: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const OversellQuery = z.object({
  variant_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  kind: z.enum(['blocked', 'allowed', 'negative_on_hand']).optional(),
  channel: z.string().max(63).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const SummaryQuery = z.object({
  window_days: z.coerce.number().int().min(1).max(365).optional(),
});

const ProvenanceParams = z.object({
  variant_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
});

const ProvenanceQuery = z.object({
  channel: z.string().max(63).optional(),
  movement_limit: z.coerce.number().int().min(1).max(100).optional(),
});

const BuffersQuery = z.object({
  channel: z.string().max(63).optional(),
  variant_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  kind: z.enum(['default', 'override']).optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const FreshnessQuery = z.object({
  stale_only: queryBool.optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryIntegrityRoutes: FastifyPluginAsync = async (app) => {
  // ── Reconciliation ──────────────────────────────────────────────────────────

  app.get('/v1/inventory/integrity/reconciliation', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = RunsQuery.parse(request.query);
    const { items, total } = await inventoryService.listReconciliationRuns(
      toInventoryContext(request),
      {
        ...(q.status !== undefined ? { status: q.status } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
      }
    );
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 25 }));
  });

  app.post('/v1/inventory/integrity/reconciliation', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const body = RunBody.parse(request.body ?? {});
    const run = await inventoryService.runReconciliation(toInventoryContext(request), {
      ...(body.scope !== undefined ? { scope: body.scope } : {}),
      ...(body.variant_id !== undefined ? { variantId: body.variant_id } : {}),
      ...(body.sample_size !== undefined ? { sampleSize: body.sample_size } : {}),
    });
    return reply.send(ok(run));
  });

  app.get('/v1/inventory/integrity/drifts', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = DriftsQuery.parse(request.query);
    const { items, total } = await inventoryService.listReconciliationDrifts(
      toInventoryContext(request),
      {
        ...(q.run_id !== undefined ? { runId: q.run_id } : {}),
        ...(q.variant_id !== undefined ? { variantId: q.variant_id } : {}),
        ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
        ...(q.include_resolved !== undefined ? { includeResolved: q.include_resolved } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
      }
    );
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });

  // ── Oversell incidents ──────────────────────────────────────────────────────

  app.get('/v1/inventory/integrity/oversell', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = OversellQuery.parse(request.query);
    const { items, total } = await inventoryService.listOversellIncidents(
      toInventoryContext(request),
      {
        ...(q.variant_id !== undefined ? { variantId: q.variant_id } : {}),
        ...(q.product_id !== undefined ? { productId: q.product_id } : {}),
        ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
        ...(q.kind !== undefined ? { kind: q.kind } : {}),
        ...(q.channel !== undefined ? { channel: q.channel } : {}),
        ...(q.from !== undefined ? { from: q.from } : {}),
        ...(q.to !== undefined ? { to: q.to } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
      }
    );
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });

  app.get('/v1/inventory/integrity/oversell/summary', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = SummaryQuery.parse(request.query);
    const summary = await inventoryService.oversellSummary(toInventoryContext(request), {
      ...(q.window_days !== undefined ? { windowDays: q.window_days } : {}),
    });
    return reply.send(ok(summary));
  });

  // ── Provenance ──────────────────────────────────────────────────────────────

  app.get('/v1/inventory/stock/:variant_id/:warehouse_id/provenance', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const params = ProvenanceParams.parse(request.params);
    const q = ProvenanceQuery.parse(request.query);
    const result = await inventoryService.stockProvenance(
      toInventoryContext(request),
      { variantId: params.variant_id, warehouseId: params.warehouse_id },
      {
        ...(q.channel !== undefined ? { channel: q.channel } : {}),
        ...(q.movement_limit !== undefined ? { movementLimit: q.movement_limit } : {}),
      }
    );
    return reply.send(ok(result));
  });

  // ── Per-channel buffers ─────────────────────────────────────────────────────

  app.get('/v1/inventory/channel-buffers', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = BuffersQuery.parse(request.query);
    const { items, total } = await inventoryService.listChannelBuffers(
      toInventoryContext(request),
      {
        ...(q.channel !== undefined ? { channel: q.channel } : {}),
        ...(q.variant_id !== undefined ? { variantId: q.variant_id } : {}),
        ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
        ...(q.kind !== undefined ? { kind: q.kind } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
      }
    );
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 100 }));
  });

  // PUT rather than POST: the caller's intent is "this channel withholds three",
  // which is idempotent, and making them discover whether a row already exists
  // first is API busywork.
  app.put('/v1/inventory/channel-buffers', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const saved = await inventoryService.setChannelBuffer(
      toInventoryContext(request),
      request.body
    );
    return reply.send(ok(saved));
  });

  app.delete('/v1/inventory/channel-buffers/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await inventoryService.deleteChannelBuffer(toInventoryContext(request), id);
    return reply.send(ok({ id, deleted: true }));
  });

  // ── Source freshness ────────────────────────────────────────────────────────

  app.get('/v1/inventory/sources/freshness', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = FreshnessQuery.parse(request.query);
    const rows = await inventoryService.listSourceFreshness(toInventoryContext(request), {
      ...(q.stale_only !== undefined ? { staleOnly: q.stale_only } : {}),
    });
    return reply.send(ok(rows));
  });

  app.put('/v1/inventory/sources/:id/freshness', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const row = await inventoryService.setSourceFreshness(
      toInventoryContext(request),
      id,
      request.body
    );
    return reply.send(ok(row));
  });

  app.post('/v1/inventory/sources/freshness/sweep', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const result = await inventoryService.sweepSourceFreshness(toInventoryContext(request));
    return reply.send(ok(result));
  });
};

export default inventoryIntegrityRoutes;
