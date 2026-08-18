// B2B inventory — the B2B module as a CONSUMER of the master (docs/100 P6d,
// docs/99 §4.0). Account-scoped availability (what an account can see + reserve +
// its purchasing limits), fitment-filtered availability (in-stock parts that fit a
// vehicle/equipment), and fleet / work-order holds (reserve stock for a job before
// the order exists, then release or consume it). Holds route through the inventory
// reservation engine; reads compose inventory availability with B2B + fitment data.
//
//   POST /v1/b2b/accounts/:id/availability            account-scoped availability
//   GET  /v1/b2b/accounts/:id/fitment-availability    fitment-filtered availability
//   GET  /v1/b2b/accounts/:id/holds                    list the account's holds
//   POST /v1/b2b/accounts/:id/holds                    place a fleet/work-order hold
//   POST /v1/b2b/holds/:holdId/release                 free a hold
//   POST /v1/b2b/holds/:holdId/consume                 commit a hold (job shipped)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@wizeworks/inventory';
import { fitmentService } from '@wizeworks/commerce';
import { withTenant } from '@wizeworks/db';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';
import { requireInventoryModule } from '../../../lib/inventory-context.js';

const AccountParam = z.object({ id: z.string().uuid() });
const HoldParam = z.object({ holdId: z.string().uuid() });

const HoldsQuery = z.object({
  status: z.enum(['active', 'released', 'consumed']).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const FitmentQuery = z.object({
  domain_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  item_id: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  range_value: z.coerce.number().optional(),
  warehouse_id: z.string().uuid().optional(),
});

const FITMENT_VARIANT_CAP = 200;

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bInventoryRoutes: FastifyPluginAsync = async (app) => {
  // Account-scoped availability for a set of variants.
  app.post('/v1/b2b/accounts/:id/availability', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const { id } = AccountParam.parse(request.params);
    const rows = await inventoryService.accountAvailability(toB2bContext(request), {
      ...(request.body as object),
      accountId: id,
    });
    return ok(rows);
  });

  // Fitment-filtered availability: parts that fit the queried vehicle/equipment,
  // annotated with the account's availability + limits.
  app.get('/v1/b2b/accounts/:id/fitment-availability', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const { id } = AccountParam.parse(request.params);
    const q = FitmentQuery.parse(request.query);
    const ctx = toB2bContext(request);

    const fit = await fitmentService.lookup(ctx, {
      ...(q.domain_id ? { domainId: q.domain_id } : {}),
      ...(q.category_id ? { categoryId: q.category_id } : {}),
      ...(q.item_id ? { itemId: q.item_id } : {}),
      ...(q.variant_id ? { variantId: q.variant_id } : {}),
      ...(q.range_value !== undefined ? { rangeValue: q.range_value } : {}),
    });
    if (fit.productIds.length === 0) {
      return ok({ rows: [], productCount: 0, truncated: false });
    }

    const variantIds = await withTenant(ctx, (tx) =>
      tx.productVariant
        .findMany({
          where: { productId: { in: fit.productIds }, tenantId: ctx.tenantId, deletedAt: null },
          select: { id: true },
          take: FITMENT_VARIANT_CAP + 1,
        })
        .then((rows) => rows.map((r) => r.id))
    );
    const truncated = variantIds.length > FITMENT_VARIANT_CAP;
    const rows = await inventoryService.accountAvailability(ctx, {
      accountId: id,
      variantIds: variantIds.slice(0, FITMENT_VARIANT_CAP),
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
    });
    return ok({ rows, productCount: fit.productIds.length, truncated });
  });

  // List the account's fleet holds.
  app.get('/v1/b2b/accounts/:id/holds', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const { id } = AccountParam.parse(request.params);
    const q = HoldsQuery.parse(request.query);
    const { items, total } = await inventoryService.listFleetHolds(toB2bContext(request), {
      accountId: id,
      ...(q.status ? { status: q.status } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });

  // Place a fleet / work-order hold (requires inventory — it reserves stock).
  app.post('/v1/b2b/accounts/:id/holds', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    await requireInventoryModule(request);
    const { id } = AccountParam.parse(request.params);
    const hold = await inventoryService.createFleetHold(toB2bContext(request), {
      ...(request.body as object),
      accountId: id,
    });
    return reply.status(201).send(ok(hold));
  });

  // Free a hold — returns the units to available.
  app.post('/v1/b2b/holds/:holdId/release', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const { holdId } = HoldParam.parse(request.params);
    return ok(await inventoryService.releaseFleetHold(toB2bContext(request), holdId));
  });

  // Consume a hold — the job shipped, so the held stock leaves (a sale movement).
  app.post('/v1/b2b/holds/:holdId/consume', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const { holdId } = HoldParam.parse(request.params);
    return ok(await inventoryService.consumeFleetHold(toB2bContext(request), holdId));
  });
};

export default b2bInventoryRoutes;
