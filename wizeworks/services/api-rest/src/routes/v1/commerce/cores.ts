// Commerce — core charges on rebuilt parts (sparx persona issue 051).
//
// A core charge is a refundable deposit taken with a remanufactured part and given
// back when the old part (the "core") comes back fit to rebuild. These routes are
// the parts counter's jobs: see which cores are still owed, record old parts that
// came back, keep the deposits on cores that will not, and ship a part bought by
// sending the old one first before it arrives (issue 057). Plus the one-time job a
// store moving in has: turn a core charge it faked as a choice into a real one.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { coreChoiceService, coreService } from '@wizeworks/commerce';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';

import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const PathId = z.object({ id: z.string().uuid() });

const ListCoresQuery = z.object({
  customer_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  older_than_days: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; registration is sync.
const coreRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/commerce/cores', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListCoresQuery.parse(request.query);
    return ok(
      await coreService.listOwed(toCommerceContext(request), {
        ...(q.customer_id ? { customerId: q.customer_id } : {}),
        ...(q.company_id ? { companyId: q.company_id } : {}),
        ...(q.order_id ? { orderId: q.order_id } : {}),
        ...(q.older_than_days !== undefined ? { olderThanDays: q.older_than_days } : {}),
        ...(q.limit !== undefined ? { limit: q.limit } : {}),
      })
    );
  });

  // Old parts came back for one order line. Moves money, so an editor or above.
  app.post('/v1/commerce/order-items/:id/cores/received', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown> | undefined) ?? {};
    return ok(
      await coreService.receiveCores(toCommerceContext(request), { ...body, orderItemId: id })
    );
  });

  app.post('/v1/commerce/order-items/:id/cores/kept', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown> | undefined) ?? {};
    return ok(
      await coreService.keepDeposits(toCommerceContext(request), { ...body, orderItemId: id })
    );
  });

  // Ship a send-the-old-part-first line before the old part arrives (issue 057).
  // Lets goods leave with nothing held against them, so an editor or above.
  app.post('/v1/commerce/order-items/:id/cores/release', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown> | undefined) ?? {};
    return ok(
      await coreService.releaseHold(toCommerceContext(request), { ...body, orderItemId: id })
    );
  });

  // Products whose core charge is a choice today, and what each would become.
  app.get('/v1/commerce/core-choices', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok(await coreChoiceService.listCandidates(toCommerceContext(request)));
  });

  // Turn them into real deposits. Rewrites prices and retires versions, so an
  // editor or above.
  app.post('/v1/commerce/core-choices/convert', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    return ok(await coreChoiceService.convert(toCommerceContext(request), request.body ?? {}));
  });
};

export default coreRoutes;
