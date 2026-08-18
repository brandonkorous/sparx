// Commerce — surcharge rules (docs/48 §6). Document-level fee pass-through
// (card processing fee, handling, etc.). CRUD only; the fee is computed at
// checkout completion + reversed on refund inside the checkout/refund services.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { surchargeService } from '@wizeworks/commerce';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const PathId = z.object({ id: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; registration is sync.
const surchargeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/surcharge-rules', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = request.query as Record<string, string | undefined>;
    return ok(
      await surchargeService.listRules(toCommerceContext(request), {
        ...(q?.is_active != null ? { isActive: q.is_active === 'true' } : {}),
      })
    );
  });

  app.post('/v1/surcharge-rules', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await surchargeService.createRule(toCommerceContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.get('/v1/surcharge-rules/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await surchargeService.getRule(toCommerceContext(request), id));
  });

  app.patch('/v1/surcharge-rules/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await surchargeService.updateRule(toCommerceContext(request), id, request.body));
  });

  app.delete('/v1/surcharge-rules/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await surchargeService.deleteRule(toCommerceContext(request), id);
    reply.code(204);
  });
};

export default surchargeRoutes;
