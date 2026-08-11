// Scan-driven operations (docs/146 Phase 3.5–3.7, 3.9).
//
//   GET  /v1/inventory/receiving/:purchaseOrderId          → session state
//   POST /v1/inventory/receiving/:purchaseOrderId/scan     → one trigger pull
//   DELETE /v1/inventory/receiving/:purchaseOrderId/scan/:scanEventId
//   POST /v1/inventory/receiving/:purchaseOrderId/post     → session → goods receipt
//   POST /v1/inventory/counts/:countId/scan
//   POST /v1/inventory/transfers/:transferId/scan
//   POST /v1/inventory/put-away/scan
//   POST /v1/inventory/scan/replay                         → the offline queue
//
// Every one of these is scan-capable rather than editor: they ARE the warehouse
// floor's work, and a `scanner` role that cannot receive a delivery or count a
// shelf is a role with nothing to do. The one exception is POSTING a receipt,
// which turns a session into ledger movements and money — that stays `editor`.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  redactCosts,
  requireInventoryModule,
  requireScanCapable,
  toInventoryContext,
} from '../../../lib/inventory-context.js';

/**
 * The common half of every scan body.
 *
 * `idempotencyKey` is REQUIRED, not optional. A scan endpoint that accepts a
 * request without one cannot be replayed safely, and the moment one caller omits
 * it the offline queue is quietly broken for everybody — so the contract refuses
 * the request rather than inventing a key that would not survive a retry.
 */
const ScanEnvelope = z.object({
  value: z.string().trim().min(1).max(256),
  idempotencyKey: z.string().trim().min(8).max(127),
  quantity: z.number().int().min(1).max(1_000_000).optional(),
  damagedQuantity: z.number().int().min(0).max(1_000_000).optional(),
  deviceId: z.string().trim().max(64).nullish(),
  scannedAt: z.string().datetime().optional(),
});

const PoParam = z.object({ purchaseOrderId: z.string().uuid() });
const PoScanParam = z.object({
  purchaseOrderId: z.string().uuid(),
  scanEventId: z.string().uuid(),
});
const CountParam = z.object({ countId: z.string().uuid() });
const TransferParam = z.object({ transferId: z.string().uuid() });

const ReceiveScanBody = ScanEnvelope.extend({ binId: z.string().uuid().nullish() });
const PostReceiptBody = z.object({
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(2000).optional(),
  binId: z.string().uuid().nullish(),
});
const CountScanBody = ScanEnvelope.extend({ accumulate: z.boolean().optional() });
const PutAwayScanBody = ScanEnvelope.extend({
  warehouseId: z.string().uuid(),
  toBinId: z.string().uuid(),
  fromBinId: z.string().uuid().nullish(),
});

const ReplayBody = z.object({
  scans: z
    .array(
      ScanEnvelope.extend({
        contextType: z.enum(['count', 'receipt', 'transfer', 'put_away', 'lookup']),
        contextId: z.string().uuid(),
        warehouseId: z.string().uuid().optional(),
        toBinId: z.string().uuid().optional(),
        fromBinId: z.string().uuid().nullish(),
        binId: z.string().uuid().nullish(),
      })
    )
    .min(1)
    // A queue longer than this is not an outage, it is a bug — and replaying
    // 5,000 scans in one request would hold a connection long enough to matter.
    .max(500),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryScanningRoutes: FastifyPluginAsync = async (app) => {
  // ── Receiving ─────────────────────────────────────────────────────────────

  app.get('/v1/inventory/receiving/:purchaseOrderId', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { purchaseOrderId } = PoParam.parse(request.params);
    const session = await inventoryService.receivingSession(
      toInventoryContext(request),
      purchaseOrderId
    );
    // A receiving session carries no cost figures today, but it runs through the
    // same redaction as every other scanner-reachable read so it cannot start to.
    return reply.send(ok(redactCosts(request, session)));
  });

  app.post('/v1/inventory/receiving/:purchaseOrderId/scan', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { purchaseOrderId } = PoParam.parse(request.params);
    const body = ReceiveScanBody.parse(request.body);
    const result = await inventoryService.scanToReceive(toInventoryContext(request), {
      purchaseOrderId,
      ...body,
    });
    return reply.send(ok(result));
  });

  app.delete(
    '/v1/inventory/receiving/:purchaseOrderId/scan/:scanEventId',
    async (request, reply) => {
      await requireInventoryModule(request);
      requireScanCapable(request);
      const { purchaseOrderId, scanEventId } = PoScanParam.parse(request.params);
      const session = await inventoryService.undoReceivingScan(
        toInventoryContext(request),
        purchaseOrderId,
        scanEventId
      );
      return reply.send(ok(redactCosts(request, session)));
    }
  );

  // Posting writes the ledger and moves money. Editor.
  app.post('/v1/inventory/receiving/:purchaseOrderId/post', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { purchaseOrderId } = PoParam.parse(request.params);
    const body = PostReceiptBody.parse(request.body ?? {});
    const receipt = await inventoryService.postScannedReceipt(toInventoryContext(request), {
      purchaseOrderId,
      ...body,
    });
    return reply.status(201).send(ok(receipt));
  });

  // ── Counting ──────────────────────────────────────────────────────────────

  app.post('/v1/inventory/counts/:countId/scan', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { countId } = CountParam.parse(request.params);
    const body = CountScanBody.parse(request.body);
    const result = await inventoryService.scanToCountAndReload(toInventoryContext(request), {
      countId,
      ...body,
    });
    // The count comes back with it so the sheet on screen is the sheet on the
    // server — and on a blind count the expected quantities are already withheld
    // by the serializer, not by anything this route has to remember to do.
    return reply.send(ok(redactCosts(request, result)));
  });

  // ── Transfers ─────────────────────────────────────────────────────────────

  app.post('/v1/inventory/transfers/:transferId/scan', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { transferId } = TransferParam.parse(request.params);
    const body = ScanEnvelope.parse(request.body);
    const result = await inventoryService.scanToTransfer(toInventoryContext(request), {
      transferId,
      ...body,
    });
    return reply.send(ok(result));
  });

  // ── Put-away ──────────────────────────────────────────────────────────────

  app.post('/v1/inventory/put-away/scan', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const body = PutAwayScanBody.parse(request.body);
    const result = await inventoryService.scanPutAway(toInventoryContext(request), body);
    return reply.send(ok(result));
  });

  // ── The offline queue ─────────────────────────────────────────────────────

  app.post('/v1/inventory/scan/replay', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const body = ReplayBody.parse(request.body);
    const results = await inventoryService.replayScanQueue(toInventoryContext(request), body.scans);
    return reply.send(ok({ results }));
  });
};

export default inventoryScanningRoutes;
