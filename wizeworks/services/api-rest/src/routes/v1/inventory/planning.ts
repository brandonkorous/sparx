// Inventory planning API (docs/146 Phase 7) — how much to keep, when to buy it
// again, and what keeping it costs.
//
// Settings:
//   GET  /v1/inventory/planning/policy
//   PUT  /v1/inventory/planning/policy
//
// Reads:
//   GET  /v1/inventory/planning/stockout-risk        — the buying worklist, by money
//   GET  /v1/inventory/planning/slow-movers          — dead, overstocked, slowing
//   GET  /v1/inventory/planning/holding-cost         — what it costs to keep
//   GET  /v1/inventory/planning/lead-times           — measured supplier delivery times
//   GET  /v1/inventory/planning/reorder-plans        — computed points vs the ones in force
//   GET  /v1/inventory/planning/demand/:variant_id/:warehouse_id
//   GET  /v1/inventory/planning/explain/:variant_id/:warehouse_id  — why that number
//
// Writes:
//   PUT  /v1/inventory/planning/reorder-plan         — service level, overrides, auto-manage
//   POST /v1/inventory/planning/reorder-plan/apply   — adopt the computed point, once
//   POST /v1/inventory/planning/recompute            — run the pass now
//
// Roles. Everything readable is `viewer`: a warehouse hand who can see that
// something runs out on Thursday is a warehouse hand who mentions it. Changing
// planning inputs is `editor`. Running the pass is `editor` too — it recomputes
// derived numbers and creates nothing, and making people ask an admin to refresh
// a forecast is how a forecast goes stale. The `recompute` route deliberately
// skips count generation, because generating counts creates real work for real
// people and a refresh button must not do that as a side effect.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { inventoryService } from '@wizeworks/inventory';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const LevelPath = z.object({
  variant_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
});

const RiskQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  at_risk_only: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
});

const SlowMoverQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
});

const LeadTimeQuery = z.object({
  supplier_id: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  include_variants: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
});

const PlansQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  divergent_only: queryBool.optional(),
  auto_managed_only: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const RecomputeBody = z.object({
  warehouse_id: z.string().uuid().optional(),
  /** Off by default — see the header. */
  generate_counts: queryBool.optional(),
});

const ApplyBody = z.object({
  variantId: z.string().uuid(),
  warehouseId: z.string().uuid(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryPlanningRoutes: FastifyPluginAsync = async (app) => {
  // ── Settings ───────────────────────────────────────────────────────────────

  app.get('/v1/inventory/planning/policy', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    return reply.send(ok(await inventoryService.getPlanningPolicy(toInventoryContext(request))));
  });

  app.put('/v1/inventory/planning/policy', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply.send(
      ok(await inventoryService.updatePlanningPolicy(toInventoryContext(request), request.body))
    );
  });

  // ── Reads ──────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/planning/stockout-risk', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = RiskQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.stockoutRiskReport(toInventoryContext(request), {
          ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
          ...(q.at_risk_only !== undefined ? { atRiskOnly: q.at_risk_only } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
        })
      )
    );
  });

  app.get('/v1/inventory/planning/slow-movers', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = SlowMoverQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.slowMoverReport(toInventoryContext(request), {
          ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
        })
      )
    );
  });

  app.get('/v1/inventory/planning/holding-cost', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = SlowMoverQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.holdingCostReport(toInventoryContext(request), {
          ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
        })
      )
    );
  });

  app.get('/v1/inventory/planning/lead-times', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = LeadTimeQuery.parse(request.query);
    const result = await inventoryService.listLeadTimes(toInventoryContext(request), {
      ...(q.supplier_id ? { supplierId: q.supplier_id } : {}),
      ...(q.variant_id ? { variantId: q.variant_id } : {}),
      ...(q.include_variants !== undefined ? { includeVariants: q.include_variants } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
    });
    return reply.send(paged(result.items, { total: result.total, per_page: q.take ?? 100 }));
  });

  app.get('/v1/inventory/planning/reorder-plans', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = PlansQuery.parse(request.query);
    const result = await inventoryService.listReorderPlans(toInventoryContext(request), {
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
      ...(q.divergent_only !== undefined ? { divergentOnly: q.divergent_only } : {}),
      ...(q.auto_managed_only !== undefined ? { autoManagedOnly: q.auto_managed_only } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(
      paged(result.items, { total: result.total, skip: q.skip ?? 0, per_page: q.take ?? 50 })
    );
  });

  app.get('/v1/inventory/planning/demand/:variant_id/:warehouse_id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const p = LevelPath.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.getDemandVelocity(toInventoryContext(request), {
          variantId: p.variant_id,
          warehouseId: p.warehouse_id,
        })
      )
    );
  });

  // The whole point of Phase 7.12: one call that says why the number is the
  // number, which inputs are measured and which are guessed, and what would
  // improve it.
  app.get('/v1/inventory/planning/explain/:variant_id/:warehouse_id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const p = LevelPath.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.planningProvenance(toInventoryContext(request), {
          variantId: p.variant_id,
          warehouseId: p.warehouse_id,
        })
      )
    );
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  app.put('/v1/inventory/planning/reorder-plan', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply.send(
      ok(await inventoryService.setReorderPlanningPolicy(toInventoryContext(request), request.body))
    );
  });

  app.post('/v1/inventory/planning/reorder-plan/apply', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const body = ApplyBody.parse(request.body);
    return reply.send(
      ok(await inventoryService.applyComputedReorderPoint(toInventoryContext(request), body))
    );
  });

  app.post('/v1/inventory/planning/recompute', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const body = RecomputeBody.parse(request.body ?? {});
    return reply.send(
      ok(
        await inventoryService.runPlanningSweep(toInventoryContext(request), {
          ...(body.warehouse_id ? { warehouseId: body.warehouse_id } : {}),
          skipCountGeneration: body.generate_counts !== true,
        })
      )
    );
  });
};

export default inventoryPlanningRoutes;
