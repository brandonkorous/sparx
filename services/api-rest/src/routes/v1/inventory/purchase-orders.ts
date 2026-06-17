// Inventory module — Purchase Orders (docs/100 P3b). The inbound order: buy
// stock from a supplier, receive into a warehouse (receiving is P3c). All
// `requireInventoryModule` + `toInventoryContext`, so a standalone WMS tenant
// raises POs with no commerce; writes delegate to @sparx/inventory.
//
//   GET    /v1/inventory/purchase-orders                  ?status&supplier_id&search&take&skip
//   POST   /v1/inventory/purchase-orders
//   GET    /v1/inventory/purchase-orders/:id
//   PATCH  /v1/inventory/purchase-orders/:id               → draft header edit
//   DELETE /v1/inventory/purchase-orders/:id               → delete a draft
//   POST   /v1/inventory/purchase-orders/:id/submit
//   POST   /v1/inventory/purchase-orders/:id/cancel
//   POST   /v1/inventory/purchase-orders/:id/close
//   POST   /v1/inventory/purchase-orders/:id/lines         → add/upsert a line
//   PATCH  /v1/inventory/purchase-orders/:id/lines/:lineId
//   DELETE /v1/inventory/purchase-orders/:id/lines/:lineId
//   GET    /v1/inventory/purchase-orders/:id/document      → branded print HTML

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PurchaseOrderStatus } from '@sparx/commerce-schemas';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';
import { resolvePurchaseOrderBrand } from '../../../lib/purchase-order-render.js';

const PathId = z.object({ id: z.string().uuid() });
const PathIdLine = z.object({ id: z.string().uuid(), lineId: z.string().uuid() });

const ListQuery = z.object({
  status: PurchaseOrderStatus.optional(),
  supplier_id: z.string().uuid().optional(),
  search: z.string().max(160).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryPurchaseOrderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/purchase-orders', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listPurchaseOrders(
      toInventoryContext(request),
      {
        ...(q.status !== undefined ? { status: q.status } : {}),
        ...(q.supplier_id !== undefined ? { supplierId: q.supplier_id } : {}),
        ...(q.search !== undefined ? { search: q.search } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
      }
    );
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });

  app.post('/v1/inventory/purchase-orders', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createPurchaseOrder(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.get('/v1/inventory/purchase-orders/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await inventoryService.getPurchaseOrder(toInventoryContext(request), id)));
  });

  app.patch('/v1/inventory/purchase-orders/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.updatePurchaseOrder(toInventoryContext(request), id, request.body))
    );
  });

  app.delete('/v1/inventory/purchase-orders/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await inventoryService.deletePurchaseOrder(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  // ── Lifecycle transitions ────────────────────────────────────────────────────
  app.post('/v1/inventory/purchase-orders/:id/submit', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.submitPurchaseOrder(toInventoryContext(request), id, request.body))
    );
  });

  app.post('/v1/inventory/purchase-orders/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.cancelPurchaseOrder(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/purchase-orders/:id/close', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.closePurchaseOrder(toInventoryContext(request), id))
    );
  });

  // ── Lines (draft only) ───────────────────────────────────────────────────────
  app.post('/v1/inventory/purchase-orders/:id/lines', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.addPurchaseOrderLine(toInventoryContext(request), id, request.body))
    );
  });

  app.patch('/v1/inventory/purchase-orders/:id/lines/:lineId', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id, lineId } = PathIdLine.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.updatePurchaseOrderLine(
          toInventoryContext(request),
          id,
          lineId,
          request.body
        )
      )
    );
  });

  app.delete('/v1/inventory/purchase-orders/:id/lines/:lineId', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id, lineId } = PathIdLine.parse(request.params);
    return reply.send(
      ok(await inventoryService.removePurchaseOrderLine(toInventoryContext(request), id, lineId))
    );
  });

  // ── Print document (branded HTML → browser PDF) ───────────────────────────────
  app.get('/v1/inventory/purchase-orders/:id/document', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const ctx = toInventoryContext(request);
    const brand = await resolvePurchaseOrderBrand(ctx);
    const html = await inventoryService.buildPurchaseOrderDocumentHtml(ctx, id, brand);
    void reply.header('Content-Type', 'text/html; charset=utf-8');
    void reply.header('Content-Disposition', `inline; filename="purchase-order.html"`);
    return reply.send(html);
  });
};

export default inventoryPurchaseOrderRoutes;
