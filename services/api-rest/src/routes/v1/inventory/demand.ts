// Preorders, stock ownership, consignment settlement and expiring stock
// (docs/146 Phase 9.4–9.8).
//
// Four small surfaces in one module because each is a handful of endpoints over
// one service, and four files of thirty lines read worse than one that says what
// they have in common: they are all about stock that is not simply "ours, here,
// now" — it is not here yet, not ours, or not going to last.
//
//   Preorders
//     GET    /v1/inventory/preorders
//     GET    /v1/inventory/preorders/:id
//     POST   /v1/inventory/variants/:variantId/preorder
//     PATCH  /v1/inventory/preorders/:id
//     POST   /v1/inventory/preorders/:id/close
//
//   Ownership
//     GET  /v1/inventory/ownership          — the exception list
//     POST /v1/inventory/ownership          — declare who owns a level
//
//   Consignment settlement
//     GET  /v1/inventory/consignment/settlements
//     GET  /v1/inventory/consignment/settlements/:id
//     GET  /v1/inventory/consignment/unsettled
//     POST /v1/inventory/consignment/settlements
//     POST /v1/inventory/consignment/settlements/:id/refresh
//     POST /v1/inventory/consignment/settlements/:id/close
//     POST /v1/inventory/consignment/settlements/:id/invoice
//     POST /v1/inventory/consignment/settlements/:id/paid
//     POST /v1/inventory/consignment/settlements/:id/cancel
//
//   Expiry
//     GET  /v1/inventory/expiring
//     POST /v1/inventory/expiring/markdown
//     POST /v1/inventory/expiring/write-off
//
// Role split. Reads are `viewer` throughout. Ownership and settlement writes are
// `admin`, not `editor`, and that is deliberate in both cases: declaring stock
// to be somebody else's removes it from the balance sheet, and closing a
// settlement creates a payable. Both are accounting decisions wearing an
// inventory screen. Preorders and expiry actions are `editor` — a merchandiser
// opening a preorder or marking down a short-dated batch is doing their job.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const IdPath = z.object({ id: z.string().uuid() });
const VariantPath = z.object({ variantId: z.string().uuid() });

const PreorderQuery = z.object({
  variant_id: z.string().uuid().optional(),
  status: z.enum(['scheduled', 'open', 'closed', 'cancelled']).optional(),
  live_only: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const OwnershipQuery = z.object({
  ownership: z.enum(['owned', 'consignment', 'customer_owned', '3pl_owned']).optional(),
  warehouse_id: z.string().uuid().optional(),
  owner_supplier_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const SettlementQuery = z.object({
  status: z.enum(['draft', 'closed', 'invoiced', 'paid', 'cancelled']).optional(),
  supplier_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const InvoiceBody = z.object({ supplierBillId: z.string().uuid().nullable().optional() });

const ExpiringQuery = z.object({
  within_days: z.coerce.number().int().min(1).max(730).optional(),
  warehouse_id: z.string().uuid().optional(),
  include_undated: z.coerce.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const demandRoutes: FastifyPluginAsync = async (app) => {
  // ── Preorders (9.4) ────────────────────────────────────────────────────────

  app.get('/v1/inventory/preorders', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = PreorderQuery.parse(request.query);
    const take = q.take ?? 50;
    const skip = q.skip ?? 0;
    const result = await inventoryService.listPreorderWindows(toInventoryContext(request), {
      ...(q.variant_id ? { variantId: q.variant_id } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.live_only !== undefined ? { liveOnly: q.live_only } : {}),
      take,
      skip,
    });
    return reply.send(paged(result.items, { total: result.total, skip, per_page: take }));
  });

  app.get('/v1/inventory/preorders/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.getPreorderWindow(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/variants/:variantId/preorder', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { variantId } = VariantPath.parse(request.params);
    return reply
      .status(201)
      .send(
        ok(
          await inventoryService.openPreorderWindow(
            toInventoryContext(request),
            variantId,
            request.body ?? {}
          )
        )
      );
  });

  app.patch('/v1/inventory/preorders/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.updatePreorderWindow(
          toInventoryContext(request),
          id,
          request.body ?? {}
        )
      )
    );
  });

  app.post('/v1/inventory/preorders/:id/close', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    const body = z
      .object({ status: z.enum(['closed', 'cancelled']).optional() })
      .parse(request.body ?? {});
    return reply.send(
      ok(
        await inventoryService.closePreorderWindow(
          toInventoryContext(request),
          id,
          body.status ?? 'closed'
        )
      )
    );
  });

  // ── Ownership (9.5) ────────────────────────────────────────────────────────

  app.get('/v1/inventory/ownership', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = OwnershipQuery.parse(request.query);
    const take = q.take ?? 50;
    const skip = q.skip ?? 0;
    const result = await inventoryService.listNonOwnedStock(toInventoryContext(request), {
      ...(q.ownership ? { ownership: q.ownership } : {}),
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
      ...(q.owner_supplier_id ? { ownerSupplierId: q.owner_supplier_id } : {}),
      take,
      skip,
    });
    // The total value rides in the body — see the note in backorders.ts about
    // `api.list` dropping extra page meta.
    return reply.send(
      ok({
        items: result.items,
        total: result.total,
        totalValueCents: result.totalValueCents,
        skip,
        take,
      })
    );
  });

  app.post('/v1/inventory/ownership', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    await inventoryService.setStockOwnership(toInventoryContext(request), request.body);
    return reply.send(ok({ updated: true }));
  });

  // ── Consignment settlement (9.6) ───────────────────────────────────────────

  app.get('/v1/inventory/consignment/settlements', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = SettlementQuery.parse(request.query);
    const take = q.take ?? 50;
    const skip = q.skip ?? 0;
    const result = await inventoryService.listConsignmentSettlements(toInventoryContext(request), {
      ...(q.status ? { status: q.status } : {}),
      ...(q.supplier_id ? { supplierId: q.supplier_id } : {}),
      take,
      skip,
    });
    return reply.send(
      ok({ items: result.items, total: result.total, owedCents: result.owedCents, skip, take })
    );
  });

  // Registered before `/settlements/:id` for readability only — Fastify already
  // prefers the static segment.
  app.get('/v1/inventory/consignment/unsettled', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const rows = await inventoryService.listUnsettledConsignment(toInventoryContext(request));
    return reply.send(paged(rows, { total: rows.length, skip: 0, per_page: rows.length || 1 }));
  });

  app.get('/v1/inventory/consignment/settlements/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.getConsignmentSettlement(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/consignment/settlements', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    return reply
      .status(201)
      .send(
        ok(
          await inventoryService.createConsignmentSettlement(
            toInventoryContext(request),
            request.body
          )
        )
      );
  });

  app.post('/v1/inventory/consignment/settlements/:id/refresh', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.refreshConsignmentSettlement(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/consignment/settlements/:id/close', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.closeConsignmentSettlement(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/consignment/settlements/:id/invoice', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    const body = InvoiceBody.parse(request.body ?? {});
    return reply.send(
      ok(
        await inventoryService.invoiceConsignmentSettlement(
          toInventoryContext(request),
          id,
          body.supplierBillId ?? null
        )
      )
    );
  });

  app.post('/v1/inventory/consignment/settlements/:id/paid', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.markConsignmentSettlementPaid(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/consignment/settlements/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    const ctx = toInventoryContext(request);
    await inventoryService.cancelConsignmentSettlement(ctx, id);
    return reply.send(ok(await inventoryService.getConsignmentSettlement(ctx, id)));
  });

  // ── Expiring stock (9.8) ───────────────────────────────────────────────────

  app.get('/v1/inventory/expiring', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ExpiringQuery.parse(request.query);
    const report = await inventoryService.listExpiringStock(toInventoryContext(request), {
      ...(q.within_days !== undefined ? { withinDays: q.within_days } : {}),
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
      ...(q.include_undated !== undefined ? { includeUndated: q.include_undated } : {}),
    });
    // A report, not a list: the bucket tallies ARE the answer, and paging meta
    // would strip them.
    return reply.send(ok(report));
  });

  app.post('/v1/inventory/expiring/markdown', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply.send(
      ok(await inventoryService.markdownExpiringLot(toInventoryContext(request), request.body))
    );
  });

  app.post('/v1/inventory/expiring/write-off', async (request, reply) => {
    await requireInventoryModule(request);
    // `editor`, not `admin`: writing off expired stock is a warehouse job, and
    // requiring an admin means it does not get recorded until somebody chases it.
    // The reason is mandatory in the schema, which is the control that matters.
    requireRole(request, 'editor');
    return reply.send(
      ok(await inventoryService.writeOffExpiringLot(toInventoryContext(request), request.body))
    );
  });
};

export default demandRoutes;
