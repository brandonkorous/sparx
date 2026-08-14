// Barcodes + scanning (docs/146 Phase 3).
//
//   GET    /v1/inventory/barcodes                  ?variant_id&supplier_id&symbology&q&…
//   POST   /v1/inventory/barcodes                  → register a code
//   PATCH  /v1/inventory/barcodes/:id
//   DELETE /v1/inventory/barcodes/:id
//   POST   /v1/inventory/barcodes/:id/primary      → make it the item's main code
//   GET    /v1/inventory/barcodes/variant/:variantId
//   GET    /v1/inventory/barcodes/conflicts        → codes two items both claim
//   POST   /v1/inventory/barcodes/generate         → mint internal codes
//   GET    /v1/inventory/scan                      ?value&expect&warehouse_id
//   POST   /v1/inventory/scan                      → same, for a body too long for a URL
//
// ── Who may do what ─────────────────────────────────────────────────────────
//
// SCANNING is scan-capable, obviously — it is the whole job of the role. So is
// registering a code, because the moment someone on the floor finds a box whose
// barcode is not in the system, the useful thing is for them to scan it onto the
// item there and then. Making them queue it for an editor is how the registry
// stays permanently half-finished.
//
// DELETING a code and MINTING internal ones stay `editor`: one destroys a
// mapping that labels already depend on, and the other allocates from a counter
// that never goes backwards.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@sparx/api-core/query';
import { inventoryService } from '@sparx/inventory';
import {
  CreateVariantBarcodeInput,
  GenerateVariantBarcodesInput,
  UpdateVariantBarcodeInput,
} from '@sparx/commerce-schemas';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  requireInventoryModule,
  requireScanCapable,
  toInventoryContext,
} from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathVariantId = z.object({ variantId: z.string().uuid() });

const ListQuery = z.object({
  variant_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  symbology: z.string().max(20).optional(),
  source: z.string().max(20).optional(),
  q: z.string().trim().min(1).max(64).optional(),
  include_inactive: queryBool.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const SCAN_KINDS = [
  'variant',
  'bin',
  'purchase_order',
  'goods_receipt',
  'transfer',
  'count',
  'lot',
  'serial',
] as const;

const ScanQuery = z.object({
  value: z.string().trim().min(1).max(256),
  /** Comma-separated, so a receiving screen can say `variant,purchase_order,bin`. */
  expect: z.string().trim().max(200).optional(),
  warehouse_id: z.string().uuid().optional(),
});

const ScanBody = z.object({
  value: z.string().trim().min(1).max(256),
  expect: z.array(z.enum(SCAN_KINDS)).optional(),
  warehouseId: z.string().uuid().optional(),
});

const ResolveConflictBody = z.object({
  variantId: z.string().uuid(),
  /** `take` moves the code to this item; `clear` says this item never owned it. */
  action: z.enum(['take', 'clear']),
});

const ScanEventsQuery = z.object({
  context_type: z.enum(['count', 'receipt', 'transfer', 'put_away', 'pick', 'lookup']).optional(),
  context_id: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  outcome: z.enum(['applied', 'duplicate', 'not_found', 'rejected']).optional(),
  device_id: z.string().max(64).optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

function parseExpect(raw: string | undefined): (typeof SCAN_KINDS)[number][] | undefined {
  if (!raw) return undefined;
  const kinds = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is (typeof SCAN_KINDS)[number] => (SCAN_KINDS as readonly string[]).includes(s));
  return kinds.length > 0 ? kinds : undefined;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryBarcodeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/barcodes', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listBarcodes(toInventoryContext(request), {
      ...(q.variant_id !== undefined ? { variantId: q.variant_id } : {}),
      ...(q.supplier_id !== undefined ? { supplierId: q.supplier_id } : {}),
      ...(q.symbology !== undefined
        ? {
            symbology: q.symbology as Parameters<
              typeof inventoryService.listBarcodes
            >[1]['symbology'],
          }
        : {}),
      ...(q.source !== undefined
        ? { source: q.source as Parameters<typeof inventoryService.listBarcodes>[1]['source'] }
        : {}),
      ...(q.q !== undefined ? { search: q.q } : {}),
      includeInactive: q.include_inactive ?? false,
      limit: q.limit ?? 50,
      offset: q.offset ?? 0,
    });
    return reply.send(paged(items, { total, skip: q.offset ?? 0, per_page: q.limit ?? 50 }));
  });

  app.get('/v1/inventory/barcodes/conflicts', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    return reply.send(ok(await inventoryService.listBarcodeConflicts(toInventoryContext(request))));
  });

  // Settling a conflict rewrites which item a code points at, which changes what
  // a scan does. Editor, not scan-capable.
  app.post('/v1/inventory/barcodes/conflicts/resolve', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const body = ResolveConflictBody.parse(request.body);
    await inventoryService.resolveBarcodeConflict(
      toInventoryContext(request),
      body.variantId,
      body.action
    );
    return reply.status(204).send();
  });

  app.get('/v1/inventory/barcodes/variant/:variantId', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { variantId } = PathVariantId.parse(request.params);
    return reply.send(
      ok(await inventoryService.barcodesForVariant(toInventoryContext(request), variantId))
    );
  });

  // Scan-capable: somebody on the floor holding an unlabelled box is exactly who
  // should be able to fix it, at the moment they find it.
  app.post('/v1/inventory/barcodes', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const input = CreateVariantBarcodeInput.parse(request.body);
    const created = await inventoryService.createBarcode(toInventoryContext(request), input);
    return reply.status(201).send(ok(created));
  });

  app.patch('/v1/inventory/barcodes/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const input = UpdateVariantBarcodeInput.parse(request.body);
    return reply.send(
      ok(await inventoryService.updateBarcode(toInventoryContext(request), id, input))
    );
  });

  app.post('/v1/inventory/barcodes/:id/primary', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.setPrimaryBarcode(toInventoryContext(request), id))
    );
  });

  app.delete('/v1/inventory/barcodes/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await inventoryService.deleteBarcode(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  app.post('/v1/inventory/barcodes/generate', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const input = GenerateVariantBarcodesInput.parse(request.body);
    return reply.send(
      ok(await inventoryService.generateBarcodes(toInventoryContext(request), input))
    );
  });

  // ── The scan endpoint ─────────────────────────────────────────────────────
  //
  // GET so a scan is a plain, cacheable-looking read that a hand terminal can
  // fire without ceremony; POST for the same thing when the payload is a long
  // 2D code that has no business in a query string.
  app.get('/v1/inventory/scan', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const q = ScanQuery.parse(request.query);
    const expect = parseExpect(q.expect);
    return reply.send(
      ok(
        await inventoryService.resolveScan(toInventoryContext(request), q.value, {
          ...(expect ? { expect } : {}),
          ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
        })
      )
    );
  });

  app.post('/v1/inventory/scan', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const body = ScanBody.parse(request.body);
    return reply.send(
      ok(
        await inventoryService.resolveScan(toInventoryContext(request), body.value, {
          ...(body.expect ? { expect: body.expect } : {}),
          ...(body.warehouseId !== undefined ? { warehouseId: body.warehouseId } : {}),
        })
      )
    );
  });

  // ── Scan history ──────────────────────────────────────────────────────────
  //
  // Editor, not scan-capable: this is the audit view of who scanned what, and a
  // shared-handheld role should not be able to read the whole floor's activity.
  app.get('/v1/inventory/scan/events', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const q = ScanEventsQuery.parse(request.query);
    const { items, total } = await inventoryService.listScanEvents(toInventoryContext(request), {
      ...(q.context_type !== undefined ? { contextType: q.context_type } : {}),
      ...(q.context_id !== undefined ? { contextId: q.context_id } : {}),
      ...(q.variant_id !== undefined ? { variantId: q.variant_id } : {}),
      ...(q.outcome !== undefined ? { outcome: q.outcome } : {}),
      ...(q.device_id !== undefined ? { deviceId: q.device_id } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 100 }));
  });
};

export default inventoryBarcodeRoutes;
