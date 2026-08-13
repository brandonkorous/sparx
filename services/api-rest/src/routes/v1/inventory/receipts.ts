// Inventory module — Goods receipts (docs/100 P3c). Booking goods against a
// submitted PO: each line writes a `receive` movement (moving-average cost) and
// advances the PO to partial/received. Receipts are immutable once posted (a
// correction is a later adjustment/count), so the surface is POST + reads. All
// `requireInventoryModule` + `toInventoryContext` (standalone-usable).
//
//   GET  /v1/inventory/receipts                 ?purchase_order_id&take&skip
//   POST /v1/inventory/receipts                 → post a receipt against a PO
//   GET  /v1/inventory/receipts/:id

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  redactCosts,
  requireInventoryModule,
  requireScanCapable,
  toInventoryContext,
} from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  purchase_order_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

/** Drop any per-line cost a scanner supplied, so the PO's agreed price stands.
 *  Untyped-in, untyped-out on purpose: the body has not been Zod-parsed yet (the
 *  service owns that contract), and this only ever removes a key. */
function stripLineCostsForScanner(
  request: Parameters<typeof redactCosts>[0],
  body: unknown
): unknown {
  const auth = requireRole(request, 'viewer');
  if (auth.role !== 'scanner') return body;
  if (body === null || typeof body !== 'object') return body;
  const b = body as Record<string, unknown>;
  const lines: unknown = b.lines;
  if (!Array.isArray(lines)) return body;
  return {
    ...b,
    lines: (lines as unknown[]).map((line): unknown => {
      if (line === null || typeof line !== 'object') return line;
      const { unitCostCents: _dropped, ...rest } = line as Record<string, unknown>;
      return rest;
    }),
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryReceiptRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/receipts', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listGoodsReceipts(toInventoryContext(request), {
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.purchase_order_id !== undefined ? { purchaseOrderId: q.purchase_order_id } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(
      paged(redactCosts(request, items), { total, skip: q.skip ?? 0, per_page: q.take ?? 50 })
    );
  });

  // Receiving a delivery is the warehouse floor's job (docs/146 Phase 1), so the
  // scan-capable allow-list rather than the ranked `editor` gate.
  //
  // A scanner may not override the line cost: `unitCostCents` is optional on the
  // input and defaults to the PO line's agreed price, which is the right number
  // and the only one someone who cannot SEE costs could possibly supply
  // responsibly. Stripping it from the body rather than rejecting the request
  // keeps a shared client working for both roles — the office user's override is
  // honoured, the floor's is ignored, and neither has to know the other exists.
  app.post('/v1/inventory/receipts', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const created = await inventoryService.createGoodsReceipt(
      toInventoryContext(request),
      stripLineCostsForScanner(request, request.body)
    );
    return reply.status(201).send(ok(redactCosts(request, created)));
  });

  app.get('/v1/inventory/receipts/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.getGoodsReceipt(toInventoryContext(request), id)
        )
      )
    );
  });

  // ── Receipt → supplier bill (docs/146 Phase 10.10) ─────────────────────
  //
  // The path for a business with no accounting package: the delivery has just
  // been booked in, the invoice is in the driver's hand, and entering it should
  // be typing the invoice number.
  //
  // The draft is a READ, deliberately, and the operator confirms it against the
  // paper before anything is written. A bill created straight from the receipt
  // would match the receipt perfectly by construction, and a three-way match
  // that cannot fail is not a check.
  app.get('/v1/inventory/receipts/:id/bill-draft', async (request, reply) => {
    await requireInventoryModule(request);
    // Costs are the whole content of a bill draft, so this is not a scanner
    // surface — `editor` and up, and `redactCosts` would empty it anyway.
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.draftBillFromReceipt(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/receipts/:id/bill', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const body = BillFromReceiptBody.parse(request.body);
    return reply.status(201).send(
      ok(
        await inventoryService.createSupplierBillFromReceipt(toInventoryContext(request), {
          goodsReceiptId: id,
          number: body.number,
          ...(body.billed_at ? { billedAt: body.billed_at } : {}),
          ...(body.due_at ? { dueAt: body.due_at } : {}),
          ...(body.tax_cents !== undefined ? { taxCents: body.tax_cents } : {}),
          ...(body.shipping_cents !== undefined ? { shippingCents: body.shipping_cents } : {}),
          ...(body.notes ? { notes: body.notes } : {}),
          ...(body.lines ? { lines: body.lines } : {}),
        })
      )
    );
  });
};

/** What the operator corrected the draft to. `lines` omitted means "the delivery
 *  as recorded", which is the common case and the reason this is short. */
const BillFromReceiptBody = z.object({
  number: z.string().trim().min(1).max(40),
  billed_at: z.string().datetime().optional(),
  due_at: z.string().datetime().optional(),
  tax_cents: z.number().int().nonnegative().max(1_000_000_000).optional(),
  shipping_cents: z.number().int().nonnegative().max(1_000_000_000).optional(),
  notes: z.string().max(2000).optional(),
  lines: z
    .array(
      z.object({
        purchaseOrderLineId: z.string().uuid().optional(),
        variantId: z.string().uuid().optional(),
        description: z.string().trim().max(255).optional(),
        quantity: z.number().int().positive().max(10_000_000),
        unitCostCents: z.number().int().nonnegative().max(1_000_000_000),
        amountCents: z.number().int().max(1_000_000_000).optional(),
        uomCode: z.string().trim().min(1).max(12).optional(),
      })
    )
    .min(1)
    .max(500)
    .optional(),
});

export default inventoryReceiptRoutes;
