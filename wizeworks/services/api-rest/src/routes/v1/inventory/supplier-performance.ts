// Supplier performance API (docs/146 Phase 8.1, 8.3, 8.4) — how the people you
// buy from actually behave, and what they charge at what quantity.
//
// Scorecards:
//   GET  /v1/inventory/suppliers/scorecards            — the league table
//   GET  /v1/inventory/suppliers/:id/scorecard         — one supplier's card
//   POST /v1/inventory/suppliers/scorecards/recompute  — measure now
//
// Late orders:
//   GET  /v1/inventory/purchase-orders/late            — overdue, worst first
//
// Price breaks:
//   GET  /v1/inventory/supplier-variants/:id/price-breaks
//   PUT  /v1/inventory/supplier-variants/:id/price-breaks
//
// Roles. Everything readable is `viewer`: a scorecard is an operational fact,
// and the person raising the order is the person who needs it. Recomputing is
// `editor` — it derives numbers and creates nothing, and making somebody ask an
// admin to refresh a measurement is how the measurement goes stale. Editing a
// price ladder is `editor`, because it changes what future orders cost.
//
// One deliberate shape: a supplier with no scorecard row returns 404 rather than
// a zeroed card. "We have not measured this supplier" and "this supplier scores
// nothing" are different answers, and an envelope full of zeroes cannot say the
// first.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { inventoryService } from '@wizeworks/inventory';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const IdPath = z.object({ id: z.string().uuid() });

const ScorecardQuery = z.object({
  supplier_id: z.string().uuid().optional(),
  scored_only: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const RecomputeBody = z.object({
  window_days: z.coerce.number().int().min(28).max(1095).optional(),
});

const LateQuery = z.object({
  supplier_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const supplierPerformanceRoutes: FastifyPluginAsync = async (app) => {
  // ── Scorecards ─────────────────────────────────────────────────────────────

  app.get('/v1/inventory/suppliers/scorecards', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ScorecardQuery.parse(request.query);
    // `ok(report)` rather than `paged(items)`: the headline figures — when the
    // pass last ran, and how many suppliers could not be graded — are the two
    // things that stop an empty league table reading as "everyone is perfect",
    // and pagination meta is the wrong place for a finding.
    return reply.send(
      ok(
        await inventoryService.listSupplierScorecards(toInventoryContext(request), {
          ...(q.supplier_id ? { supplierId: q.supplier_id } : {}),
          ...(q.scored_only !== undefined ? { scoredOnly: q.scored_only } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
          ...(q.skip !== undefined ? { skip: q.skip } : {}),
        })
      )
    );
  });

  app.get('/v1/inventory/suppliers/:id/scorecard', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    const card = await inventoryService.getSupplierScorecard(toInventoryContext(request), id);
    if (!card) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message:
            'This supplier has not been measured yet. Run a measurement, or wait for tonight’s pass.',
        },
      });
    }
    return reply.send(ok(card));
  });

  app.post('/v1/inventory/suppliers/scorecards/recompute', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const body = RecomputeBody.parse(request.body ?? {});
    return reply.send(
      ok(
        await inventoryService.recomputeSupplierScorecards(toInventoryContext(request), {
          ...(body.window_days !== undefined ? { windowDays: body.window_days } : {}),
        })
      )
    );
  });

  // ── Late purchase orders ───────────────────────────────────────────────────

  app.get('/v1/inventory/purchase-orders/late', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = LateQuery.parse(request.query);
    // Same shape as the scorecards above, for the same reason: `undated` (open
    // orders nobody CAN be late on) is what stops an empty list being read as a
    // punctual supply chain.
    return reply.send(
      ok(
        await inventoryService.listLatePurchaseOrders(toInventoryContext(request), {
          ...(q.supplier_id ? { supplierId: q.supplier_id } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
        })
      )
    );
  });

  // ── Quantity price breaks ──────────────────────────────────────────────────

  app.get('/v1/inventory/supplier-variants/:id/price-breaks', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return reply.send(ok(await inventoryService.getPriceLadder(toInventoryContext(request), id)));
  });

  app.put('/v1/inventory/supplier-variants/:id/price-breaks', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.setPriceBreaks(toInventoryContext(request), id, request.body))
    );
  });
};

export default supplierPerformanceRoutes;
