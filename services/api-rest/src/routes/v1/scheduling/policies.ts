// Scheduling booking policies — deposit / cancellation / fee / reminder rules a
// service attaches to (docs/79 §9).
//
//   GET    /v1/scheduling/policies         → list
//   POST   /v1/scheduling/policies         → create
//   GET    /v1/scheduling/policies/:id     → get one
//   PATCH  /v1/scheduling/policies/:id     → update
//   DELETE /v1/scheduling/policies/:id     → delete (detaches from services/bookings)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { BookingPolicy } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { CreateBookingPolicyInput, UpdateBookingPolicyInput } from '@sparx/scheduling-schemas';
import {
  createBookingPolicy,
  deleteBookingPolicy,
  getBookingPolicy,
  listBookingPolicies,
  updateBookingPolicy,
} from '@sparx/scheduling';
import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';

const PathId = z.object({ id: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingPolicyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/policies', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const rows = await listBookingPolicies(tenantId);
    return ok(rows.map(policyView));
  });

  app.post('/v1/scheduling/policies', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const input = CreateBookingPolicyInput.parse(request.body);
    const row = await createBookingPolicy(tenantId, input);
    return reply.code(201).send(ok(policyView(row)));
  });

  app.get('/v1/scheduling/policies/:id', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    return ok(policyView(await getBookingPolicy(tenantId, id)));
  });

  app.patch('/v1/scheduling/policies/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = UpdateBookingPolicyInput.parse({ ...(request.body as object), id });
    return ok(policyView(await updateBookingPolicy(tenantId, input)));
  });

  app.delete('/v1/scheduling/policies/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await deleteBookingPolicy(tenantId, id);
    return ok({ id, deleted: true });
  });
};

function policyView(p: BookingPolicy) {
  return {
    id: p.id,
    name: p.name,
    depositType: p.depositType,
    depositAmountCents: p.depositAmountCents,
    depositPercent: p.depositPercent,
    cancellationWindowHours: p.cancellationWindowHours,
    lateCancelFeeType: p.lateCancelFeeType,
    lateCancelFeeValue: p.lateCancelFeeValue,
    noShowFeeType: p.noShowFeeType,
    noShowFeeValue: p.noShowFeeValue,
    policyText: p.policyText,
    reminderOffsetsMin: p.reminderOffsetsMin,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export default schedulingPolicyRoutes;
