// Picking + packing (docs/146 Phase 4).
//
//   GET    /v1/inventory/pick-lists
//   POST   /v1/inventory/pick-lists                        → generate a walk
//   GET    /v1/inventory/pick-lists/:pickListId
//   POST   /v1/inventory/pick-lists/:pickListId/assign
//   POST   /v1/inventory/pick-lists/:pickListId/cancel
//   POST   /v1/inventory/pick-lists/:pickListId/pick       → confirm a line
//   POST   /v1/inventory/pick-lists/:pickListId/short
//   POST   /v1/inventory/pick-lists/:pickListId/skip
//   POST   /v1/inventory/pick-lists/:pickListId/scan       → one trigger pull
//   GET    /v1/inventory/packages
//   POST   /v1/inventory/packages
//   GET    /v1/inventory/packages/:packageId
//   PATCH  /v1/inventory/packages/:packageId
//   POST   /v1/inventory/packages/:packageId/items         → pack by hand
//   POST   /v1/inventory/packages/:packageId/scan
//   POST   /v1/inventory/packages/:packageId/close
//   POST   /v1/inventory/packages/:packageId/cancel
//   POST   /v1/inventory/packages/:packageId/fulfill       → hand to shipping
//   GET    /v1/inventory/packages/:packageId/packing-slip  → print (HTML)
//   GET    /v1/inventory/reports/pick-throughput
//
// ── Who may do what ───────────────────────────────────────────────────────────
//
// Walking and packing are `requireScanCapable`: they ARE the warehouse floor's
// work, and a `scanner` role that cannot pick an order is a role with nothing to
// do. GENERATING a walk, cancelling one, and handing a box to shipping stay
// `editor` — those are decisions about what the business is doing, made at a
// desk, and the last one spends money on a carrier label.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { closeAndFulfillPackage, fulfillPackedShipment } from '@wizeworks/commerce';
import { inventoryService } from '@wizeworks/inventory';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import {
  redactCosts,
  requireInventoryModule,
  requireScanCapable,
  toInventoryContext,
} from '../../../lib/inventory-context.js';
import { resolvePackingSlipBrand } from '../../../lib/packing-slip-render.js';

const ListParam = z.object({ pickListId: z.string().uuid() });
const PackageParam = z.object({ packageId: z.string().uuid() });

// Only the two pagination keys, read here so the collection routes can echo them
// back in the envelope's page meta. The services parse the rest of the query
// themselves — this deliberately does not restate their filters.
const PageQuery = z.object({
  take: z.coerce.number().int().positive().max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const FulfillBody = z.object({
  carrier: z.string().trim().max(63).optional(),
  service: z.string().trim().max(63).optional(),
  trackingNumber: z.string().trim().max(127).optional(),
  trackingUrl: z.string().trim().url().max(2048).optional(),
  markShipped: z.boolean().optional(),
  notes: z.string().trim().max(10_000).optional(),
  /** Seal the box first when it is still open — the pack bench's one button. */
  close: z.boolean().optional(),
  allowPartial: z.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryPickingRoutes: FastifyPluginAsync = async (app) => {
  // ── Walks ───────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/pick-lists', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const page = PageQuery.parse(request.query ?? {});
    const { items, total } = await inventoryService.listPickLists(
      toInventoryContext(request),
      request.query ?? {}
    );
    // `paged`, not `ok` — a collection's envelope carries the rows as `data` and
    // the counts as page meta. Sending `ok({items,total})` nests the array one
    // level deeper than every client reads, which is a TypeError in the browser
    // rather than an error here.
    return reply.send(
      paged(redactCosts(request, items), {
        total,
        skip: page.skip ?? 0,
        per_page: page.take ?? 50,
      })
    );
  });

  app.post('/v1/inventory/pick-lists', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const list = await inventoryService.generatePickList(
      toInventoryContext(request),
      request.body ?? {}
    );
    return reply.code(201).send(ok(list));
  });

  app.get('/v1/inventory/pick-lists/:pickListId', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { pickListId } = ListParam.parse(request.params);
    const list = await inventoryService.getPickList(toInventoryContext(request), pickListId);
    return reply.send(ok(redactCosts(request, list)));
  });

  app.post('/v1/inventory/pick-lists/:pickListId/assign', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { pickListId } = ListParam.parse(request.params);
    const list = await inventoryService.assignPickList(
      toInventoryContext(request),
      pickListId,
      request.body ?? {}
    );
    return reply.send(ok(redactCosts(request, list)));
  });

  app.post('/v1/inventory/pick-lists/:pickListId/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { pickListId } = ListParam.parse(request.params);
    const list = await inventoryService.cancelPickList(
      toInventoryContext(request),
      pickListId,
      request.body ?? {}
    );
    return reply.send(ok(list));
  });

  app.post('/v1/inventory/pick-lists/:pickListId/pick', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { pickListId } = ListParam.parse(request.params);
    const result = await inventoryService.confirmPick(
      toInventoryContext(request),
      pickListId,
      request.body ?? {}
    );
    return reply.send(ok(redactCosts(request, result)));
  });

  app.post('/v1/inventory/pick-lists/:pickListId/short', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { pickListId } = ListParam.parse(request.params);
    const result = await inventoryService.shortPick(
      toInventoryContext(request),
      pickListId,
      request.body ?? {}
    );
    return reply.send(ok(redactCosts(request, result)));
  });

  app.post('/v1/inventory/pick-lists/:pickListId/skip', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { pickListId } = ListParam.parse(request.params);
    const result = await inventoryService.skipPick(
      toInventoryContext(request),
      pickListId,
      request.body ?? {}
    );
    return reply.send(ok(redactCosts(request, result)));
  });

  app.post('/v1/inventory/pick-lists/:pickListId/scan', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { pickListId } = ListParam.parse(request.params);
    const result = await inventoryService.scanToPick(
      toInventoryContext(request),
      pickListId,
      request.body ?? {}
    );
    return reply.send(ok(redactCosts(request, result)));
  });

  // ── Boxes ───────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/packages', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const page = PageQuery.parse(request.query ?? {});
    const { items, total } = await inventoryService.listPackages(
      toInventoryContext(request),
      request.query ?? {}
    );
    return reply.send(
      paged(redactCosts(request, items), {
        total,
        skip: page.skip ?? 0,
        per_page: page.take ?? 50,
      })
    );
  });

  app.post('/v1/inventory/packages', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const box = await inventoryService.createPackage(
      toInventoryContext(request),
      request.body ?? {}
    );
    return reply.code(201).send(ok(redactCosts(request, box)));
  });

  app.get('/v1/inventory/packages/:packageId', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { packageId } = PackageParam.parse(request.params);
    const box = await inventoryService.getPackage(toInventoryContext(request), packageId);
    return reply.send(ok(redactCosts(request, box)));
  });

  app.patch('/v1/inventory/packages/:packageId', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { packageId } = PackageParam.parse(request.params);
    const box = await inventoryService.updatePackage(
      toInventoryContext(request),
      packageId,
      request.body ?? {}
    );
    return reply.send(ok(redactCosts(request, box)));
  });

  app.post('/v1/inventory/packages/:packageId/items', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { packageId } = PackageParam.parse(request.params);
    const box = await inventoryService.packItem(
      toInventoryContext(request),
      packageId,
      request.body ?? {}
    );
    return reply.send(ok(redactCosts(request, box)));
  });

  app.post('/v1/inventory/packages/:packageId/scan', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { packageId } = PackageParam.parse(request.params);
    const result = await inventoryService.scanToPack(
      toInventoryContext(request),
      packageId,
      request.body ?? {}
    );
    return reply.send(ok(redactCosts(request, result)));
  });

  app.post('/v1/inventory/packages/:packageId/close', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { packageId } = PackageParam.parse(request.params);
    const box = await inventoryService.closePackage(
      toInventoryContext(request),
      packageId,
      request.body ?? {}
    );
    return reply.send(ok(redactCosts(request, box)));
  });

  app.post('/v1/inventory/packages/:packageId/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { packageId } = PackageParam.parse(request.params);
    const box = await inventoryService.cancelPackage(toInventoryContext(request), packageId);
    return reply.send(ok(box));
  });

  // Handing a box to shipping is where a carrier label gets bought, so it is an
  // office decision rather than a floor one.
  app.post('/v1/inventory/packages/:packageId/fulfill', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { packageId } = PackageParam.parse(request.params);
    const body = FulfillBody.parse(request.body ?? {});
    const ctx = toInventoryContext(request);

    const result = body.close
      ? await closeAndFulfillPackage(ctx, { ...body, packageId })
      : await fulfillPackedShipment(ctx, { ...body, packageId });
    return reply.send(ok(result));
  });

  // The sheet that goes IN the box. HTML rather than JSON for the same reason the
  // purchase order is: the browser is the PDF renderer.
  app.get('/v1/inventory/packages/:packageId/packing-slip', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { packageId } = PackageParam.parse(request.params);
    const ctx = toInventoryContext(request);
    const brand = await resolvePackingSlipBrand(ctx, packageId);
    const html = await inventoryService.buildPackingSlipHtml(ctx, packageId, brand);
    void reply.header('Content-Type', 'text/html; charset=utf-8');
    void reply.header('Content-Disposition', 'inline; filename="packing-slip.html"');
    return reply.send(html);
  });

  // ── Throughput ──────────────────────────────────────────────────────────────

  app.get('/v1/inventory/reports/pick-throughput', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const report = await inventoryService.pickThroughput(
      toInventoryContext(request),
      request.query ?? {}
    );
    return reply.send(ok(report));
  });
};

export default inventoryPickingRoutes;
