// Inventory module — True cost (docs/146 Phase 5). What the goods actually cost
// to get onto the shelf, what they cost when they left, and how the business
// wants stock valued. All `requireInventoryModule` + `toInventoryContext`
// (standalone-usable — a WMS-lite tenant lands costs with no commerce).
//
//   GET    /v1/inventory/costing/policy
//   PATCH  /v1/inventory/costing/policy
//   POST   /v1/inventory/costing/variant-method
//
//   GET    /v1/inventory/purchase-orders/:id/charges
//   POST   /v1/inventory/purchase-orders/:id/charges
//   PATCH  /v1/inventory/purchase-order-charges/:id
//   DELETE /v1/inventory/purchase-order-charges/:id
//
//   GET    /v1/inventory/receipts/:id/charges
//   POST   /v1/inventory/receipts/:id/charges
//   PATCH  /v1/inventory/receipt-charges/:id
//   DELETE /v1/inventory/receipt-charges/:id
//   GET    /v1/inventory/receipts/:id/landed-cost
//
//   GET    /v1/inventory/costing/layers            ?variant_id&warehouse_id
//   GET    /v1/inventory/costing/movement/:id
//   GET    /v1/inventory/reports/valuation-as-of   ?as_of&warehouse_id
//   GET    /v1/inventory/reports/price-variance    ?from&to&warehouse_id&supplier_id
//   GET    /v1/inventory/reports/cogs              ?from&to&warehouse_id
//
// EVERY endpoint here is about money, so every one is `editor` or above and none
// of them is on the scan-capable allow-list. A warehouse role deliberately
// cannot see costs at all (`redactCosts`), and a costing surface it could reach
// would be a hole straight through that.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@wizeworks/inventory';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });

const LayersQuery = z.object({
  variant_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
});

const AsOfQuery = z.object({
  as_of: z.string().datetime(),
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(1000).optional(),
});

const WindowQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  warehouse_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryCostingRoutes: FastifyPluginAsync = async (app) => {
  // ─── Policy ────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/costing/policy', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply.send(ok(await inventoryService.getCostingPolicy(toInventoryContext(request))));
  });

  app.patch('/v1/inventory/costing/policy', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    return reply.send(
      ok(await inventoryService.updateCostingPolicy(toInventoryContext(request), request.body))
    );
  });

  app.post('/v1/inventory/costing/variant-method', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    return reply.send(
      ok(await inventoryService.setVariantCostingMethod(toInventoryContext(request), request.body))
    );
  });

  // ─── Charges on an order (the estimate) ────────────────────────────────────

  app.get('/v1/inventory/purchase-orders/:id/charges', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.listPurchaseOrderCharges(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/purchase-orders/:id/charges', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const body = request.body as Record<string, unknown> | null;
    const created = await inventoryService.createPurchaseOrderCharge(toInventoryContext(request), {
      ...(body ?? {}),
      // The path wins over the body: an id in two places is an id that can
      // disagree with itself.
      purchaseOrderId: id,
    });
    return reply.status(201).send(ok(created));
  });

  app.patch('/v1/inventory/purchase-order-charges/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.updatePurchaseOrderCharge(
          toInventoryContext(request),
          id,
          request.body
        )
      )
    );
  });

  app.delete('/v1/inventory/purchase-order-charges/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.deletePurchaseOrderCharge(toInventoryContext(request), id))
    );
  });

  // ─── Charges on a delivery (the actual) ────────────────────────────────────

  app.get('/v1/inventory/receipts/:id/charges', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.listGoodsReceiptCharges(toInventoryContext(request), id))
    );
  });

  // Adding a charge to a POSTED delivery re-allocates the order and revalues
  // what is still on the shelf — the freight invoice arriving a fortnight after
  // the pallet is the ordinary case, not an exception.
  app.post('/v1/inventory/receipts/:id/charges', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const body = request.body as Record<string, unknown> | null;
    const created = await inventoryService.createGoodsReceiptCharge(toInventoryContext(request), {
      ...(body ?? {}),
      goodsReceiptId: id,
    });
    return reply.status(201).send(ok(created));
  });

  app.patch('/v1/inventory/receipt-charges/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.updateGoodsReceiptCharge(
          toInventoryContext(request),
          id,
          request.body
        )
      )
    );
  });

  app.delete('/v1/inventory/receipt-charges/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.deleteGoodsReceiptCharge(toInventoryContext(request), id))
    );
  });

  // "£4.00 of part, £0.62 of freight, £4.62 landed" — per line, with each charge
  // named and the basis it was spread on.
  app.get('/v1/inventory/receipts/:id/landed-cost', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.getLandedCostBreakdown(toInventoryContext(request), id))
    );
  });

  // ─── Layers + reports ──────────────────────────────────────────────────────

  app.get('/v1/inventory/costing/layers', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const q = LayersQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.variantCostLayers(toInventoryContext(request), {
          variantId: q.variant_id,
          ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
        })
      )
    );
  });

  app.get('/v1/inventory/costing/movement/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.movementCostLayers(toInventoryContext(request), id))
    );
  });

  app.get('/v1/inventory/reports/valuation-as-of', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const q = AsOfQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.valuationAsOf(toInventoryContext(request), {
          asOf: new Date(q.as_of),
          ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
        })
      )
    );
  });

  app.get('/v1/inventory/reports/price-variance', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const q = WindowQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.priceVarianceReport(toInventoryContext(request), {
          from: new Date(q.from),
          to: new Date(q.to),
          ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
          ...(q.supplier_id !== undefined ? { supplierId: q.supplier_id } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
        })
      )
    );
  });

  app.get('/v1/inventory/reports/cogs', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const q = WindowQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.cogsReport(toInventoryContext(request), {
          from: new Date(q.from),
          to: new Date(q.to),
          ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
        })
      )
    );
  });
};

export default inventoryCostingRoutes;
